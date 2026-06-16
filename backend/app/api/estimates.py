from pathlib import Path

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
    ".pdf",
    ".msg"
}


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


def msg_preview_payload(
    target: Path
):

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
