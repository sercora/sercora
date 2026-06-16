import base64
import ipaddress
import os
import re
import shutil
import socket
import subprocess
import tempfile
from pathlib import Path
from urllib.parse import unquote, urlparse
from urllib.request import HTTPRedirectHandler, Request, build_opener

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse, Response
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
    ".doc",
    ".docx",
    ".xls",
    ".xlsm",
    ".pdf",
    ".msg",
    ".xlsx"
}
MSG_IMAGE_MAX_BYTES = 5 * 1024 * 1024
MSG_REMOTE_IMAGE_TIMEOUT = 5
OFFICE_PREVIEW_TIMEOUT = 60
IMG_SRC_PATTERN = re.compile(
    r"(<img\b[^>]*?\bsrc\s*=\s*)([\"'])(.*?)(\2)",
    re.IGNORECASE
)
OFFICE_PREVIEW_EXTENSIONS = {
    ".doc",
    ".docx",
    ".xls",
    ".xlsm",
    ".xlsx"
}


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


def office_preview_pdf_response(
    target: Path
):

    libreoffice_path = (
        shutil.which("libreoffice")
        or shutil.which("soffice")
        or (
            "/usr/bin/libreoffice"
            if Path("/usr/bin/libreoffice").exists()
            else ""
        )
        or (
            "/usr/bin/soffice"
            if Path("/usr/bin/soffice").exists()
            else ""
        )
    )

    if not libreoffice_path:
        raise HTTPException(
            status_code=503,
            detail="LibreOffice preview support is not installed"
        )

    with tempfile.TemporaryDirectory(
        prefix="sercora-office-preview-"
    ) as temp_dir_name:
        temp_dir = Path(temp_dir_name)
        output_dir = temp_dir / "output"
        profile_dir = temp_dir / "profile"
        output_dir.mkdir()

        env = os.environ.copy()
        env.update(
            {
                "HOME": str(temp_dir),
                "XDG_RUNTIME_DIR": str(temp_dir),
                "TMPDIR": str(temp_dir)
            }
        )

        try:
            result = subprocess.run(
                [
                    libreoffice_path,
                    "--headless",
                    "-env:UserInstallation={profile}".format(
                        profile=profile_dir.as_uri()
                    ),
                    "--convert-to",
                    "pdf",
                    "--outdir",
                    str(output_dir),
                    str(target)
                ],
                check=False,
                capture_output=True,
                text=True,
                timeout=OFFICE_PREVIEW_TIMEOUT,
                env=env
            )
        except subprocess.TimeoutExpired as error:
            raise HTTPException(
                status_code=504,
                detail="Office file preview timed out"
            ) from error

        pdf_files = list(
            output_dir.glob("*.pdf")
        )

        if result.returncode != 0 or not pdf_files:
            raise HTTPException(
                status_code=422,
                detail="Office file could not be converted to PDF"
            )

        pdf_content = pdf_files[0].read_bytes()

    return Response(
        content=pdf_content,
        media_type="application/pdf",
        headers={
            "Content-Disposition": (
                "inline; filename=\"{filename}.pdf\""
            ).format(
                filename=target.stem.replace(
                    "\"",
                    ""
                )
            )
        }
    )


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

    if extension in OFFICE_PREVIEW_EXTENSIONS:
        return office_preview_pdf_response(target)

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
