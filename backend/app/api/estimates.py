import base64
import html
import ipaddress
import posixpath
import re
import socket
import zipfile
from pathlib import Path
from urllib.parse import unquote, urlparse
from urllib.request import HTTPRedirectHandler, Request, build_opener
from xml.etree import ElementTree as ET

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy import text

from app.database.database import SessionLocal
from app.schemas.estimate import EstimateCreate

router = APIRouter()


NAS_ESTIMATE_ROOTS = {
    "in_progress": Path("/NAS/Soumissions en cours"),
    "sent": Path("/NAS/Soumissions envoyées"),
    "rejected": Path("/NAS/@Recycle/Soumissions en cours")
}


ESTIMATE_FOLDER_STATUS_PATTERN = "^(in_progress|sent|rejected)$"
PREVIEW_EXTENSIONS = {
    ".docx",
    ".pdf",
    ".msg",
    ".xlsx"
}
MSG_IMAGE_MAX_BYTES = 5 * 1024 * 1024
MSG_REMOTE_IMAGE_TIMEOUT = 5
OFFICE_PREVIEW_MAX_COLUMNS = 60
OFFICE_PREVIEW_MAX_ROWS = 300
OFFICE_PREVIEW_MAX_SHEETS = 12
IMG_SRC_PATTERN = re.compile(
    r"(<img\b[^>]*?\bsrc\s*=\s*)([\"'])(.*?)(\2)",
    re.IGNORECASE
)
WORD_NAMESPACE = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
SPREADSHEET_NAMESPACE = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
RELATIONSHIP_NAMESPACE = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"


class NoRedirectHandler(HTTPRedirectHandler):

    def redirect_request(
        self,
        req,
        fp,
        code,
        msg,
        headers,
        newurl
    ):

        return None


def estimate_root(
    status: str
):

    root = NAS_ESTIMATE_ROOTS.get(status)

    if root is None:
        raise HTTPException(
            status_code=400,
            detail="Unknown estimate folder status"
        )

    if not root.exists():
        raise HTTPException(
            status_code=503,
            detail="NAS estimate folder is not mounted"
        )

    return root


def resolve_estimate_path(
    status: str,
    relative_path: str | None
):

    root = estimate_root(status).resolve()
    clean_path = (relative_path or "").strip("/")

    if Path(clean_path).is_absolute() or ".." in Path(clean_path).parts:
        raise HTTPException(
            status_code=400,
            detail="Invalid NAS path"
        )

    target = (root / clean_path).resolve()

    if root != target and root not in target.parents:
        raise HTTPException(
            status_code=400,
            detail="Invalid NAS path"
        )

    return root, target


def folder_item_payload(
    root: Path,
    entry: Path
):

    stat = entry.stat()

    return {
        "name": entry.name,
        "relative_path": str(entry.relative_to(root)),
        "is_dir": entry.is_dir(),
        "size": stat.st_size,
        "modified_at": stat.st_mtime
    }


def office_preview_document(
    title,
    content
):

    escaped_title = html.escape(title)

    return """<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>{title}</title>
<style>
body {{
    margin: 0;
    padding: 24px;
    background: #f6f7f8;
    color: #171a1f;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 13px;
    line-height: 1.45;
}}
.page {{
    max-width: 980px;
    margin: 0 auto;
    padding: 28px;
    border: 1px solid #d8dce2;
    background: #fff;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
}}
h1 {{
    margin: 0 0 18px;
    font-size: 18px;
}}
h2 {{
    margin: 22px 0 10px;
    font-size: 15px;
}}
p {{
    margin: 0 0 10px;
}}
table {{
    width: 100%;
    margin: 0 0 16px;
    border-collapse: collapse;
    table-layout: fixed;
}}
th,
td {{
    padding: 5px 7px;
    border: 1px solid #d0d7de;
    vertical-align: top;
    overflow-wrap: anywhere;
}}
th {{
    background: #eef1f2;
    font-weight: 700;
    text-align: left;
}}
.sheet-note {{
    margin: 8px 0 18px;
    color: #5c6670;
    font-size: 12px;
}}
</style>
</head>
<body>
<main class="page">
<h1>{title}</h1>
{content}
</main>
</body>
</html>""".format(
        title=escaped_title,
        content=content
    )


def word_text_from_node(
    node
):

    parts = []

    for child in node.iter():
        if child.tag == WORD_NAMESPACE + "t":
            parts.append(
                html.escape(child.text or "")
            )
        elif child.tag == WORD_NAMESPACE + "tab":
            parts.append(" ")
        elif child.tag == WORD_NAMESPACE + "br":
            parts.append("<br>")

    return "".join(parts).strip()


def word_paragraph_html(
    node
):

    paragraph = word_text_from_node(node)

    if not paragraph:
        return ""

    return "<p>{paragraph}</p>".format(
        paragraph=paragraph
    )


def word_table_html(
    node
):

    rows = []

    for row in node.findall(
        WORD_NAMESPACE + "tr"
    ):
        cells = []

        for cell in row.findall(
            WORD_NAMESPACE + "tc"
        ):
            cell_content = []

            for paragraph in cell.findall(
                WORD_NAMESPACE + "p"
            ):
                paragraph_text = word_text_from_node(paragraph)

                if paragraph_text:
                    cell_content.append(paragraph_text)

            cells.append(
                "<td>{content}</td>".format(
                    content="<br>".join(cell_content) or "&nbsp;"
                )
            )

        if cells:
            rows.append(
                "<tr>{cells}</tr>".format(
                    cells="".join(cells)
                )
            )

    if not rows:
        return ""

    return "<table>{rows}</table>".format(
        rows="".join(rows)
    )


def docx_preview_html(
    target: Path
):

    with zipfile.ZipFile(target) as archive:
        document_xml = archive.read("word/document.xml")

    document = ET.fromstring(document_xml)
    body = document.find(
        WORD_NAMESPACE + "body"
    )

    if body is None:
        return office_preview_document(
            target.name,
            "<p>Document Word vide.</p>"
        )

    blocks = []

    for child in body:
        if child.tag == WORD_NAMESPACE + "p":
            block = word_paragraph_html(child)
        elif child.tag == WORD_NAMESPACE + "tbl":
            block = word_table_html(child)
        else:
            block = ""

        if block:
            blocks.append(block)

    return office_preview_document(
        target.name,
        "".join(blocks) or "<p>Document Word vide.</p>"
    )


def xlsx_column_index(
    cell_reference
):

    letters = re.match(
        r"[A-Z]+",
        cell_reference or ""
    )

    if not letters:
        return 0

    column = 0

    for character in letters.group(0):
        column = column * 26 + ord(character) - ord("A") + 1

    return column


def xlsx_shared_strings(
    archive
):

    try:
        shared_strings_xml = archive.read("xl/sharedStrings.xml")
    except KeyError:
        return []

    shared_strings = []
    root = ET.fromstring(shared_strings_xml)

    for item in root.findall(
        SPREADSHEET_NAMESPACE + "si"
    ):
        parts = []

        for text_node in item.iter(
            SPREADSHEET_NAMESPACE + "t"
        ):
            parts.append(text_node.text or "")

        shared_strings.append(
            "".join(parts)
        )

    return shared_strings


def xlsx_workbook_relationships(
    archive
):

    relationships = {}

    try:
        relationships_xml = archive.read("xl/_rels/workbook.xml.rels")
    except KeyError:
        return relationships

    root = ET.fromstring(relationships_xml)

    for relationship in root:
        relationship_id = relationship.attrib.get("Id")
        target = relationship.attrib.get("Target")

        if relationship_id and target:
            if target.startswith("/"):
                sheet_path = target.strip("/")
            else:
                sheet_path = posixpath.normpath(
                    posixpath.join(
                        "xl",
                        target
                    )
                )

            relationships[relationship_id] = sheet_path

    return relationships


def xlsx_workbook_sheets(
    archive
):

    workbook_xml = archive.read("xl/workbook.xml")
    root = ET.fromstring(workbook_xml)
    relationships = xlsx_workbook_relationships(archive)
    sheets = []

    sheets_node = root.find(
        SPREADSHEET_NAMESPACE + "sheets"
    )

    if sheets_node is None:
        return sheets

    for sheet in sheets_node.findall(
        SPREADSHEET_NAMESPACE + "sheet"
    ):
        relationship_id = sheet.attrib.get(
            RELATIONSHIP_NAMESPACE + "id"
        )
        sheet_path = relationships.get(relationship_id or "")

        if sheet_path:
            sheets.append(
                {
                    "name": sheet.attrib.get("name") or "Feuille",
                    "path": sheet_path
                }
            )

    return sheets


def xlsx_cell_value(
    cell,
    shared_strings
):

    cell_type = cell.attrib.get("t")

    if cell_type == "inlineStr":
        parts = []

        for text_node in cell.iter(
            SPREADSHEET_NAMESPACE + "t"
        ):
            parts.append(text_node.text or "")

        return "".join(parts)

    value_node = cell.find(
        SPREADSHEET_NAMESPACE + "v"
    )

    if value_node is None or value_node.text is None:
        return ""

    value = value_node.text

    if cell_type == "s":
        try:
            return shared_strings[int(value)]
        except (IndexError, ValueError):
            return value

    if cell_type == "b":
        return "TRUE" if value == "1" else "FALSE"

    return value


def xlsx_sheet_html(
    archive,
    sheet,
    shared_strings
):

    sheet_xml = archive.read(sheet["path"])
    root = ET.fromstring(sheet_xml)
    rows = []
    truncated = False

    for row_index, row in enumerate(
        root.findall(
            ".//" + SPREADSHEET_NAMESPACE + "row"
        )
    ):
        if row_index >= OFFICE_PREVIEW_MAX_ROWS:
            truncated = True
            break

        values = {}
        max_column = 0

        for cell in row.findall(
            SPREADSHEET_NAMESPACE + "c"
        ):
            column = xlsx_column_index(
                cell.attrib.get("r", "")
            )

            if not column or column > OFFICE_PREVIEW_MAX_COLUMNS:
                continue

            max_column = max(
                max_column,
                column
            )
            values[column] = xlsx_cell_value(
                cell,
                shared_strings
            )

        if max_column:
            rows.append(
                "<tr>{cells}</tr>".format(
                    cells="".join(
                        "<td>{value}</td>".format(
                            value=html.escape(
                                values.get(column, "")
                            )
                        )
                        for column in range(
                            1,
                            max_column + 1
                        )
                    )
                )
            )

    if not rows:
        table = "<p>Feuille vide.</p>"
    else:
        table = "<table>{rows}</table>".format(
            rows="".join(rows)
        )

    note = ""

    if truncated:
        note = (
            "<p class=\"sheet-note\">"
            "Aperçu limité aux {rows} premières lignes."
            "</p>"
        ).format(
            rows=OFFICE_PREVIEW_MAX_ROWS
        )

    return "<h2>{name}</h2>{note}{table}".format(
        name=html.escape(sheet["name"]),
        note=note,
        table=table
    )


def xlsx_preview_html(
    target: Path
):

    with zipfile.ZipFile(target) as archive:
        shared_strings = xlsx_shared_strings(archive)
        sheets = xlsx_workbook_sheets(archive)
        blocks = []

        for index, sheet in enumerate(sheets):
            if index >= OFFICE_PREVIEW_MAX_SHEETS:
                blocks.append(
                    "<p class=\"sheet-note\">"
                    "Aperçu limité aux {sheets} premières feuilles."
                    "</p>".format(
                        sheets=OFFICE_PREVIEW_MAX_SHEETS
                    )
                )
                break

            blocks.append(
                xlsx_sheet_html(
                    archive,
                    sheet,
                    shared_strings
                )
            )

    return office_preview_document(
        target.name,
        "".join(blocks) or "<p>Classeur Excel vide.</p>"
    )


def office_preview_payload(
    target: Path
):

    try:
        if target.suffix.lower() == ".docx":
            preview_html = docx_preview_html(target)
            office_format = "word"
        else:
            preview_html = xlsx_preview_html(target)
            office_format = "excel"
    except (KeyError, zipfile.BadZipFile, ET.ParseError) as error:
        raise HTTPException(
            status_code=422,
            detail="Office file could not be read"
        ) from error

    return {
        "type": "office",
        "name": target.name,
        "format": office_format,
        "html": preview_html
    }


def decode_msg_value(
    value
):

    if not value:
        return ""

    if isinstance(value, bytes):
        for encoding in ("utf-8", "cp1252", "latin-1"):
            try:
                return value.decode(encoding)
            except UnicodeDecodeError:
                pass

        return value.decode("utf-8", errors="replace")

    return str(value)


def normalize_msg_content_id(
    value
):

    if not value:
        return ""

    content_id = unquote(str(value).strip().strip("<>"))

    if content_id.lower().startswith("cid:"):
        content_id = content_id[4:]

    return content_id.strip()


def msg_image_data_uri(
    data,
    mime_type
):

    if not data or not mime_type.lower().startswith("image/"):
        return ""

    if len(data) > MSG_IMAGE_MAX_BYTES:
        return ""

    return "data:{mime_type};base64,{payload}".format(
        mime_type=mime_type,
        payload=base64.b64encode(data).decode("ascii")
    )


def msg_attachment_image_map(
    attachments
):

    images = {}

    for attachment in attachments:
        mime_type = getattr(attachment, "mimetype", None) or ""
        data_uri = msg_image_data_uri(
            getattr(attachment, "data", None),
            mime_type
        )

        if not data_uri:
            continue

        for key in (
            getattr(attachment, "cid", None),
            getattr(attachment, "contentId", None),
            getattr(attachment, "longFilename", None),
            getattr(attachment, "shortFilename", None)
        ):
            content_id = normalize_msg_content_id(key)

            if content_id:
                images[content_id] = data_uri

    return images


def host_is_public(
    hostname: str
):

    try:
        addresses = socket.getaddrinfo(
            hostname,
            None
        )
    except socket.gaierror:
        return False

    for address in addresses:
        ip_address = ipaddress.ip_address(address[4][0])

        if (
            ip_address.is_private
            or ip_address.is_loopback
            or ip_address.is_link_local
            or ip_address.is_multicast
            or ip_address.is_reserved
            or ip_address.is_unspecified
        ):
            return False

    return True


def download_remote_image_data_uri(
    image_url: str
):

    parsed_url = urlparse(image_url)

    if parsed_url.scheme not in ("http", "https") or not parsed_url.hostname:
        return ""

    if not host_is_public(parsed_url.hostname):
        return ""

    request = Request(
        image_url,
        headers={
            "User-Agent": "Sercora/1.0"
        }
    )

    try:
        opener = build_opener(NoRedirectHandler)

        with opener.open(
            request,
            timeout=MSG_REMOTE_IMAGE_TIMEOUT
        ) as response:
            mime_type = response.headers.get_content_type()

            if not mime_type.lower().startswith("image/"):
                return ""

            data = response.read(MSG_IMAGE_MAX_BYTES + 1)

            if len(data) > MSG_IMAGE_MAX_BYTES:
                return ""

            return msg_image_data_uri(
                data,
                mime_type
            )
    except Exception:
        return ""


def inline_msg_html_images(
    message_html,
    cid_images
):

    if not message_html:
        return ""

    remote_images = {}

    def replace_image_src(
        match
    ):

        prefix, quote, source, suffix = match.groups()
        replacement = ""

        if source.lower().startswith("cid:"):
            replacement = cid_images.get(
                normalize_msg_content_id(source)
            )
        elif source.lower().startswith(("http://", "https://")):
            replacement = remote_images.get(source)

            if replacement is None:
                replacement = download_remote_image_data_uri(source)
                remote_images[source] = replacement

        if not replacement:
            return match.group(0)

        return "{prefix}{quote}{replacement}{suffix}".format(
            prefix=prefix,
            quote=quote,
            replacement=replacement,
            suffix=suffix
        )

    return IMG_SRC_PATTERN.sub(
        replace_image_src,
        message_html
    )


def msg_preview_payload(
    target: Path
):

    try:
        import extract_msg
    except ImportError as error:
        raise HTTPException(
            status_code=503,
            detail="MSG preview support is not installed"
        ) from error

    try:
        message = extract_msg.Message(str(target))
        message_sender = message.sender or ""
        message_to = message.to or ""
        message_cc = message.cc or ""
        message_date = str(message.date or "")
        message_subject = message.subject or target.name
        message_body = message.body or ""
        message_html = decode_msg_value(
            getattr(message, "htmlBody", None)
            or getattr(message, "html_body", None)
        )
        cid_images = msg_attachment_image_map(message.attachments)
        message_html = inline_msg_html_images(
            message_html,
            cid_images
        )
        attachments = [
            attachment.longFilename or attachment.shortFilename or "Pièce jointe"
            for attachment in message.attachments
        ]
        message.close()
    except Exception as error:
        raise HTTPException(
            status_code=422,
            detail="MSG file could not be read"
        ) from error

    return {
        "type": "msg",
        "name": target.name,
        "subject": message_subject,
        "from": message_sender,
        "to": message_to,
        "cc": message_cc,
        "date": message_date,
        "body": message_body,
        "html": message_html,
        "attachments": attachments
    }


@router.get("/estimate-folders")
def get_estimate_folders(
    status: str = Query(..., pattern=ESTIMATE_FOLDER_STATUS_PATTERN),
    path: str = ""
):

    root, target = resolve_estimate_path(
        status,
        path
    )

    if not target.exists() or not target.is_dir():
        raise HTTPException(
            status_code=404,
            detail="NAS folder not found"
        )

    items = []

    for entry in target.iterdir():
        try:
            items.append(
                folder_item_payload(
                    root,
                    entry
                )
            )
        except OSError:
            continue

    items.sort(
        key=lambda item: (
            not item["is_dir"],
            item["name"].lower()
        )
    )

    return {
        "status": status,
        "path": str(target.relative_to(root)) if target != root else "",
        "root_name": root.name,
        "items": items
    }


@router.get("/estimate-files")
def get_estimate_file(
    status: str = Query(..., pattern=ESTIMATE_FOLDER_STATUS_PATTERN),
    path: str = Query(..., min_length=1)
):

    _root, target = resolve_estimate_path(
        status,
        path
    )

    if not target.exists() or not target.is_file():
        raise HTTPException(
            status_code=404,
            detail="NAS file not found"
        )

    return FileResponse(
        target,
        filename=target.name
    )


@router.get("/estimate-file-preview")
def get_estimate_file_preview(
    status: str = Query(..., pattern=ESTIMATE_FOLDER_STATUS_PATTERN),
    path: str = Query(..., min_length=1)
):

    _root, target = resolve_estimate_path(
        status,
        path
    )

    if not target.exists() or not target.is_file():
        raise HTTPException(
            status_code=404,
            detail="NAS file not found"
        )

    extension = target.suffix.lower()

    if extension not in PREVIEW_EXTENSIONS:
        raise HTTPException(
            status_code=415,
            detail="Preview is not supported for this file type"
        )

    if extension == ".pdf":
        return FileResponse(
            target,
            media_type="application/pdf",
            filename=target.name,
            content_disposition_type="inline"
        )

    if extension in (".docx", ".xlsx"):
        return office_preview_payload(target)

    return msg_preview_payload(target)


@router.get("/estimates")
def get_estimates():

    db = SessionLocal()

    rows = db.execute(
        text(
            """
            SELECT
                e.id,
                e.project_id,
                e.revision_number,
                e.estimate_type,
                e.description,
                p.project_name
            FROM estimate e
            JOIN project p
                ON p.id = e.project_id
            ORDER BY
                p.project_name,
                e.revision_number
            """
        )
    )

    estimates = []

    for row in rows:

        estimates.append(
            {
                "id": row.id,
                "project_id": row.project_id,
                "project_name": row.project_name,
                "revision_number": row.revision_number,
                "estimate_type": row.estimate_type,
                "description": row.description
            }
        )

    db.close()

    return estimates


@router.get("/estimates/{estimate_id}")
def get_estimate(estimate_id: int):

    db = SessionLocal()

    row = db.execute(
        text(
            """
            SELECT
                id,
                project_id,
                revision_number,
                estimate_type,
                description
            FROM estimate
            WHERE id = :id
            """
        ),
        {
            "id": estimate_id
        }
    ).fetchone()

    db.close()

    if row is None:

        raise HTTPException(
            status_code=404,
            detail="Estimate not found"
        )

    return {
        "id": row.id,
        "project_id": row.project_id,
        "revision_number": row.revision_number,
        "estimate_type": row.estimate_type,
        "description": row.description
    }


@router.post("/estimates")
def create_estimate(estimate: EstimateCreate):

    db = SessionLocal()

    row = db.execute(
        text(
            """
            INSERT INTO estimate (
                project_id,
                revision_number,
                estimate_type,
                description
            )
            VALUES (
                :project_id,
                :revision_number,
                :estimate_type,
                :description
            )
            RETURNING id
            """
        ),
        {
            "project_id": estimate.project_id,
            "revision_number": estimate.revision_number,
            "estimate_type": estimate.estimate_type,
            "description": estimate.description
        }
    ).fetchone()

    db.commit()

    db.close()

    return {
        "id": row.id,
        "message": "Estimate created"
    }
