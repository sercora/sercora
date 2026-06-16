import base64
import ipaddress
import json
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
PROJECT_RW_ROOT = Path(
    os.getenv(
        "SERCORA_PROJECT_RW_ROOT",
        "/NAS_SERCORA_RW"
    )
)


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


def safe_project_folder_part(
    value: str,
    fallback: str
):

    name = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "-", value or "")
    name = re.sub(r"\s+", " ", name).strip(" .")

    if not name:
        name = fallback

    return name[:150]


def project_folder_name_from_values(
    project_name: str,
    bid_due_date
):

    date_part = (
        bid_due_date.strftime("%Y %m %d")
        if bid_due_date
        else "0000 00 00"
    )

    return f"{date_part}, {safe_project_folder_part(project_name, 'Projet')}"


def project_folder_root(
    project_id: int
):

    db = SessionLocal()

    try:
        row = db.execute(
            text(
                """
                SELECT
                    project_name,
                    bid_due_date
                FROM project
                WHERE id = :project_id
                """
            ),
            {
                "project_id": project_id
            }
        ).fetchone()
    finally:
        db.close()

    if row is None:
        raise HTTPException(
            status_code=404,
            detail="Project not found"
        )

    if not PROJECT_RW_ROOT.exists():
        raise HTTPException(
            status_code=503,
            detail="Project NAS folder is not mounted"
        )

    root = PROJECT_RW_ROOT.resolve()
    project_root = (
        root /
        project_folder_name_from_values(
            row.project_name,
            row.bid_due_date
        )
    ).resolve()

    if root != project_root and root not in project_root.parents:
        raise HTTPException(
            status_code=400,
            detail="Invalid project folder"
        )

    return root, project_root


def resolve_project_path(
    project_id: int,
    relative_path: str | None
):

    _root, project_root = project_folder_root(project_id)
    clean_path = (relative_path or "").strip("/")

    if Path(clean_path).is_absolute() or ".." in Path(clean_path).parts:
        raise HTTPException(
            status_code=400,
            detail="Invalid project path"
        )

    target = (project_root / clean_path).resolve()

    if project_root != target and project_root not in target.parents:
        raise HTTPException(
            status_code=400,
            detail="Invalid project path"
        )

    return project_root, target


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
                "PATH": (
                    "/usr/local/sbin:/usr/local/bin:"
                    "/usr/sbin:/usr/bin:/sbin:/bin:"
                    "{existing_path}"
                ).format(
                    existing_path=env.get("PATH", "")
                ),
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


@router.get("/project-folders")
def get_project_folders(
    project_id: int = Query(..., ge=1),
    path: str = ""
):

    root, target = resolve_project_path(
        project_id,
        path
    )

    if not target.exists() or not target.is_dir():
        raise HTTPException(
            status_code=404,
            detail="Project folder not found"
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
        "project_id": project_id,
        "path": str(target.relative_to(root)) if target != root else "",
        "root_name": root.name,
        "items": items
    }


@router.get("/project-files")
def get_project_file(
    project_id: int = Query(..., ge=1),
    path: str = Query(..., min_length=1)
):

    _root, target = resolve_project_path(
        project_id,
        path
    )

    if not target.exists() or not target.is_file():
        raise HTTPException(
            status_code=404,
            detail="Project file not found"
        )

    return FileResponse(
        target,
        filename=target.name
    )


@router.get("/project-file-preview")
def get_project_file_preview(
    project_id: int = Query(..., ge=1),
    path: str = Query(..., min_length=1)
):

    _root, target = resolve_project_path(
        project_id,
        path
    )

    if not target.exists() or not target.is_file():
        raise HTTPException(
            status_code=404,
            detail="Project file not found"
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


def mapped_json_id_list(
    value,
    line_id_map: dict[int, int]
):

    if not value:
        return []

    raw_ids = value

    if isinstance(value, str):
        try:
            raw_ids = json.loads(value)
        except json.JSONDecodeError:
            return []

    if not isinstance(raw_ids, list):
        return []

    mapped_ids = []

    for raw_id in raw_ids:
        try:
            source_id = int(raw_id)
        except (TypeError, ValueError):
            continue

        next_id = line_id_map.get(source_id)

        if next_id:
            mapped_ids.append(next_id)

    return mapped_ids


@router.post("/estimates/{estimate_id}/revisions")
def create_estimate_revision(estimate_id: int):

    db = SessionLocal()

    try:
        source = db.execute(
            text(
                """
                SELECT
                    id,
                    project_id,
                    estimate_type,
                    used_hourly_rate,
                    global_profit_percent,
                    description
                FROM estimate
                WHERE id = :estimate_id
                """
            ),
            {
                "estimate_id": estimate_id
            }
        ).fetchone()

        if source is None:
            raise HTTPException(
                status_code=404,
                detail="Estimate not found"
            )

        next_revision = db.execute(
            text(
                """
                SELECT COALESCE(MAX(revision_number), -1) + 1
                FROM estimate
                WHERE project_id = :project_id
                """
            ),
            {
                "project_id": source.project_id
            }
        ).scalar_one()

        new_estimate = db.execute(
            text(
                """
                INSERT INTO estimate (
                    project_id,
                    parent_estimate_id,
                    revision_number,
                    estimate_type,
                    used_hourly_rate,
                    global_profit_percent,
                    description
                )
                VALUES (
                    :project_id,
                    :parent_estimate_id,
                    :revision_number,
                    :estimate_type,
                    :used_hourly_rate,
                    :global_profit_percent,
                    :description
                )
                RETURNING id
                """
            ),
            {
                "project_id": source.project_id,
                "parent_estimate_id": source.id,
                "revision_number": next_revision,
                "estimate_type": source.estimate_type,
                "used_hourly_rate": source.used_hourly_rate,
                "global_profit_percent": source.global_profit_percent,
                "description": source.description
            }
        ).fetchone()

        room_id_map: dict[int, int] = {}

        room_rows = db.execute(
            text(
                """
                SELECT
                    id,
                    phase_name,
                    phase_label,
                    floor_name,
                    floor_label,
                    room_name,
                    sort_order
                FROM room
                WHERE estimate_id = :estimate_id
                ORDER BY sort_order, id
                """
            ),
            {
                "estimate_id": estimate_id
            }
        ).mappings().all()

        for row in room_rows:
            copied_room = db.execute(
                text(
                    """
                    INSERT INTO room (
                        estimate_id,
                        phase_name,
                        phase_label,
                        floor_name,
                        floor_label,
                        room_name,
                        sort_order
                    )
                    VALUES (
                        :estimate_id,
                        :phase_name,
                        :phase_label,
                        :floor_name,
                        :floor_label,
                        :room_name,
                        :sort_order
                    )
                    RETURNING id
                    """
                ),
                {
                    "estimate_id": new_estimate.id,
                    "phase_name": row["phase_name"],
                    "phase_label": row["phase_label"],
                    "floor_name": row["floor_name"],
                    "floor_label": row["floor_label"],
                    "room_name": row["room_name"],
                    "sort_order": row["sort_order"]
                }
            ).fetchone()
            room_id_map[int(row["id"])] = int(copied_room.id)

        line_id_map: dict[int, int] = {}
        source_line_links = []

        line_rows = db.execute(
            text(
                """
                SELECT
                    id,
                    product_id,
                    surface_type_id,
                    unit_id,
                    plan_code,
                    grout_color,
                    loss_percent,
                    purchase_price,
                    profit_percent,
                    profit_forced,
                    installation_cost,
                    installation_link_source_line_id,
                    installation_link_multiplier,
                    quantity_link_source_line_ids,
                    quantity_link_multiplier,
                    manpower_multiplier,
                    sort_order,
                    notes
                FROM estimate_line
                WHERE estimate_id = :estimate_id
                ORDER BY sort_order, id
                """
            ),
            {
                "estimate_id": estimate_id
            }
        ).mappings().all()

        for row in line_rows:
            copied_line = db.execute(
                text(
                    """
                    INSERT INTO estimate_line (
                        estimate_id,
                        product_id,
                        surface_type_id,
                        unit_id,
                        plan_code,
                        grout_color,
                        loss_percent,
                        purchase_price,
                        profit_percent,
                        profit_forced,
                        installation_cost,
                        installation_link_source_line_id,
                        installation_link_multiplier,
                        quantity_link_source_line_ids,
                        quantity_link_multiplier,
                        manpower_multiplier,
                        sort_order,
                        notes
                    )
                    VALUES (
                        :estimate_id,
                        :product_id,
                        :surface_type_id,
                        :unit_id,
                        :plan_code,
                        :grout_color,
                        :loss_percent,
                        :purchase_price,
                        :profit_percent,
                        :profit_forced,
                        :installation_cost,
                        NULL,
                        :installation_link_multiplier,
                        '[]'::jsonb,
                        :quantity_link_multiplier,
                        :manpower_multiplier,
                        :sort_order,
                        :notes
                    )
                    RETURNING id
                    """
                ),
                {
                    "estimate_id": new_estimate.id,
                    "product_id": row["product_id"],
                    "surface_type_id": row["surface_type_id"],
                    "unit_id": row["unit_id"],
                    "plan_code": row["plan_code"],
                    "grout_color": row["grout_color"],
                    "loss_percent": row["loss_percent"],
                    "purchase_price": row["purchase_price"],
                    "profit_percent": row["profit_percent"],
                    "profit_forced": row["profit_forced"],
                    "installation_cost": row["installation_cost"],
                    "installation_link_multiplier": row["installation_link_multiplier"],
                    "quantity_link_multiplier": row["quantity_link_multiplier"],
                    "manpower_multiplier": row["manpower_multiplier"],
                    "sort_order": row["sort_order"],
                    "notes": row["notes"]
                }
            ).fetchone()
            line_id_map[int(row["id"])] = int(copied_line.id)
            source_line_links.append(row)

        for row in source_line_links:
            new_line_id = line_id_map[int(row["id"])]
            source_installation_line_id = (
                int(row["installation_link_source_line_id"])
                if row["installation_link_source_line_id"]
                else None
            )
            mapped_installation_line_id = (
                line_id_map.get(source_installation_line_id)
                if source_installation_line_id
                else None
            )
            mapped_quantity_line_ids = mapped_json_id_list(
                row["quantity_link_source_line_ids"],
                line_id_map
            )

            db.execute(
                text(
                    """
                    UPDATE estimate_line
                    SET
                        installation_link_source_line_id = :installation_link_source_line_id,
                        quantity_link_source_line_ids = CAST(:quantity_link_source_line_ids AS JSONB)
                    WHERE id = :line_id
                    """
                ),
                {
                    "line_id": new_line_id,
                    "installation_link_source_line_id": mapped_installation_line_id,
                    "quantity_link_source_line_ids": json.dumps(mapped_quantity_line_ids)
                }
            )

        quantity_rows = db.execute(
            text(
                """
                SELECT
                    q.estimate_line_id,
                    q.room_id,
                    q.quantity
                FROM estimate_quantity q
                JOIN estimate_line l
                    ON l.id = q.estimate_line_id
                WHERE l.estimate_id = :estimate_id
                """
            ),
            {
                "estimate_id": estimate_id
            }
        ).mappings().all()

        for row in quantity_rows:
            if not row["estimate_line_id"] or not row["room_id"]:
                continue

            next_line_id = line_id_map.get(int(row["estimate_line_id"]))
            next_room_id = room_id_map.get(int(row["room_id"]))

            if not next_line_id or not next_room_id:
                continue

            db.execute(
                text(
                    """
                    INSERT INTO estimate_quantity (
                        estimate_line_id,
                        room_id,
                        quantity
                    )
                    VALUES (
                        :estimate_line_id,
                        :room_id,
                        :quantity
                    )
                    """
                ),
                {
                    "estimate_line_id": next_line_id,
                    "room_id": next_room_id,
                    "quantity": row["quantity"]
                }
            )

        db.execute(
            text(
                """
                INSERT INTO estimate_supplier_quote (
                    estimate_id,
                    supplier_id,
                    supplier_name,
                    expires_on,
                    quote_reference,
                    notes,
                    active
                )
                SELECT
                    :new_estimate_id,
                    supplier_id,
                    supplier_name,
                    expires_on,
                    quote_reference,
                    notes,
                    active
                FROM estimate_supplier_quote
                WHERE estimate_id = :source_estimate_id
                """
            ),
            {
                "new_estimate_id": new_estimate.id,
                "source_estimate_id": estimate_id
            }
        )

        db.commit()

        return {
            "id": new_estimate.id,
            "project_id": source.project_id,
            "parent_estimate_id": source.id,
            "revision_number": next_revision,
            "estimate_type": source.estimate_type,
            "description": source.description
        }

    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


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
