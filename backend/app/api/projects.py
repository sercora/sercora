import os
import re
from datetime import date
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile
from sqlalchemy import text

from app.database.database import SessionLocal
from app.schemas.project import ProjectCreate

router = APIRouter()

PROJECT_TEMPLATE_ROOT = Path(
    os.getenv(
        "SERCORA_PROJECT_TEMPLATE_ROOT",
        "/NAS/Soumissions en cours/000-Dossier type"
    )
)
PROJECT_RW_ROOT = Path(
    os.getenv(
        "SERCORA_PROJECT_RW_ROOT",
        "/NAS_SERCORA_RW"
    )
)
PROJECT_TEMPLATE_PARENT = Path("/NAS/Soumissions en cours")
PROJECT_INVITATION_DIR = Path("Soumission") / "Invitations a soumissionner"
UPLOAD_CHUNK_SIZE = 1024 * 1024
UPLOAD_MAX_BYTES = 500 * 1024 * 1024


def ensure_project_columns(
    db
):

    db.execute(
        text(
            """
            ALTER TABLE project
            ADD COLUMN IF NOT EXISTS bid_due_date DATE
            """
        )
    )
    db.commit()


def clean_optional_text(
    value
):

    return (value or "").strip() or None


def project_address(
    row
):

    return ", ".join(
        part
        for part in [
            row["address_line1"],
            row["address_line2"],
            row["city"],
            row["province"],
            row["postal_code"]
        ]
        if part
    )


def parse_optional_date(
    value
):

    if value is None or value == "":
        return None

    if isinstance(value, date):
        return value

    try:
        return date.fromisoformat(value)
    except ValueError:
        raise HTTPException(
            status_code=422,
            detail=f"Date invalide: {value}"
        )


def safe_name(
    value: str,
    fallback: str
):

    name = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "-", value or "")
    name = re.sub(r"\s+", " ", name).strip(" .")

    if not name:
        name = fallback

    return name[:150]


def safe_upload_relative_path(
    filename: str
):

    parts = []

    for raw_part in filename.replace("\\", "/").split("/"):
        part = raw_part.strip()

        if not part or part == ".":
            continue

        if part == "..":
            raise HTTPException(
                status_code=422,
                detail="Chemin de fichier invalide"
            )

        parts.append(
            safe_name(
                part,
                "fichier"
            )
        )

    if not parts:
        parts.append("fichier")

    return Path(*parts)


def unique_path(
    path: Path
):

    if not path.exists():
        return path

    for index in range(2, 1000):
        candidate = path.with_name(
            f"{path.stem} ({index}){path.suffix}"
        )

        if not candidate.exists():
            return candidate

    raise HTTPException(
        status_code=409,
        detail=f"Le fichier existe deja: {path.name}"
    )


def project_folder_name(
    project: ProjectCreate
):

    due_date = project.bid_due_date
    date_part = (
        due_date.strftime("%Y %m %d")
        if due_date
        else "0000 00 00"
    )

    return f"{date_part}, {safe_name(project.project_name, 'Projet')}"


def resolve_template_path(
    source_template_path: str | None
):

    template = Path(source_template_path) if source_template_path else PROJECT_TEMPLATE_ROOT

    try:
        resolved_template = template.resolve()
        resolved_parent = PROJECT_TEMPLATE_PARENT.resolve()
    except OSError:
        raise HTTPException(
            status_code=500,
            detail="Le dossier modele NAS n'est pas accessible"
        )

    try:
        resolved_template.relative_to(resolved_parent)
    except ValueError:
        raise HTTPException(
            status_code=422,
            detail="Le dossier modele doit rester dans Soumissions en cours"
        )

    if not resolved_template.is_dir():
        raise HTTPException(
            status_code=500,
            detail="Le dossier modele NAS est introuvable"
        )

    return resolved_template


def copy_template_tree(
    source: Path,
    destination: Path
):

    if not PROJECT_RW_ROOT.is_dir():
        raise HTTPException(
            status_code=500,
            detail="Le dossier Sercora RW n'est pas accessible"
        )

    if destination.exists():
        raise HTTPException(
            status_code=409,
            detail="Un dossier de projet existe deja avec ce nom"
        )

    destination.mkdir(
        parents=True
    )

    for current_root, directories, _files in os.walk(source):
        current_path = Path(current_root)
        relative_path = current_path.relative_to(source)

        for directory in directories:
            (destination / relative_path / directory).mkdir(
                exist_ok=True
            )


def create_project_folder(
    project: ProjectCreate
):

    template = resolve_template_path(project.source_template_path)
    folder_name = project_folder_name(project)
    destination = PROJECT_RW_ROOT / folder_name

    copy_template_tree(
        template,
        destination
    )

    return {
        "folder_name": folder_name,
        "folder_path": str(destination),
        "folder_status": "created",
        "folder_message": "Arborescence creee depuis le dossier modele"
    }


async def save_upload_file(
    upload: UploadFile,
    destination: Path
):

    total_bytes = 0
    destination.parent.mkdir(
        parents=True,
        exist_ok=True
    )

    with destination.open("wb") as output_file:
        while True:
            chunk = await upload.read(UPLOAD_CHUNK_SIZE)

            if not chunk:
                break

            total_bytes += len(chunk)

            if total_bytes > UPLOAD_MAX_BYTES:
                raise HTTPException(
                    status_code=413,
                    detail="Le fichier televerse est trop volumineux"
                )

            output_file.write(chunk)


async def save_msg_uploads(
    project_folder: Path,
    uploads: list[UploadFile] | None
):

    saved_count = 0

    for upload in uploads or []:
        filename = upload.filename or ""

        if not filename:
            continue

        if not filename.lower().endswith(".msg"):
            raise HTTPException(
                status_code=422,
                detail="Seuls les fichiers .msg sont acceptes ici"
            )

        relative_path = safe_upload_relative_path(
            Path(filename).name
        )
        destination = unique_path(
            project_folder / PROJECT_INVITATION_DIR / relative_path
        )

        await save_upload_file(
            upload,
            destination
        )
        saved_count += 1

    return saved_count


async def save_folder_uploads(
    project_folder: Path,
    uploads: list[UploadFile] | None
):

    saved_count = 0

    for upload in uploads or []:
        filename = upload.filename or ""

        if not filename:
            continue

        relative_path = safe_upload_relative_path(filename)
        destination = unique_path(project_folder / relative_path)

        await save_upload_file(
            upload,
            destination
        )
        saved_count += 1

    return saved_count


def insert_project_record(
    db,
    project: ProjectCreate
):

    row = db.execute(
        text(
            """
            INSERT INTO project (
                project_number,
                project_name,
                status,
                start_date,
                end_date,
                bid_due_date,
                address_line1,
                address_line2,
                city,
                province,
                postal_code,
                architect_name,
                probable_schedule,
                warranty_years,
                tile_holdback_percent
            )
            VALUES (
                :project_number,
                :project_name,
                :status,
                :start_date,
                :end_date,
                :bid_due_date,
                :address_line1,
                :address_line2,
                :city,
                :province,
                :postal_code,
                :architect_name,
                :probable_schedule,
                :warranty_years,
                :tile_holdback_percent
            )
            RETURNING id
            """
        ),
        {
            "project_number": clean_optional_text(project.project_number),
            "project_name": project.project_name.strip(),
            "status": project.status,
            "start_date": project.start_date,
            "end_date": project.end_date,
            "bid_due_date": project.bid_due_date,
            "address_line1": clean_optional_text(project.address_line1),
            "address_line2": clean_optional_text(project.address_line2),
            "city": clean_optional_text(project.city),
            "province": clean_optional_text(project.province),
            "postal_code": clean_optional_text(project.postal_code),
            "architect_name": clean_optional_text(project.architect_name),
            "probable_schedule": clean_optional_text(project.probable_schedule),
            "warranty_years": project.warranty_years,
            "tile_holdback_percent": project.tile_holdback_percent
        }
    ).fetchone()

    if project.client_id:
        db.execute(
            text(
                """
                INSERT INTO project_client (
                    project_id,
                    client_id
                )
                VALUES (
                    :project_id,
                    :client_id
                )
                """
            ),
            {
                "project_id": row.id,
                "client_id": project.client_id
            }
        )

    db.commit()

    return row.id


@router.get("/projects")
def get_projects(
    scope: str = Query("all", pattern="^(all|current)$")
):

    db = SessionLocal()
    ensure_project_columns(db)

    filters = []

    if scope == "current":
        filters.append(
            """
            COALESCE(p.status, 'PENDING') NOT IN (
                'CLOSED',
                'REFUSED',
                'REFUSE',
                'ARCHIVED',
                'SENT'
            )
            """
        )

    where_clause = (
        "WHERE " + " AND ".join(filters)
        if filters
        else ""
    )

    rows = db.execute(
        text(
            f"""
            SELECT
                p.id,
                p.project_number,
                p.project_name,
                p.status,
                p.start_date,
                p.end_date,
                p.bid_due_date,
                p.address_line1,
                p.address_line2,
                p.city,
                p.province,
                p.postal_code,
                p.architect_name,
                p.probable_schedule,
                p.created_at,
                COALESCE(
                    STRING_AGG(c.name, ', ' ORDER BY c.name)
                        FILTER (WHERE c.id IS NOT NULL),
                    ''
                ) AS client_names
            FROM project p
            LEFT JOIN project_client pc
                ON pc.project_id = p.id
            LEFT JOIN client c
                ON c.id = pc.client_id
            {where_clause}
            GROUP BY
                p.id,
                p.project_number,
                p.project_name,
                p.status,
                p.start_date,
                p.end_date,
                p.bid_due_date,
                p.address_line1,
                p.address_line2,
                p.city,
                p.province,
                p.postal_code,
                p.architect_name,
                p.probable_schedule,
                p.created_at
            ORDER BY
                p.bid_due_date NULLS LAST,
                p.project_name
            """
        )
    ).mappings().all()

    projects = []

    for row in rows:
        projects.append(
            {
                "id": row["id"],
                "project_number": row["project_number"],
                "project_name": row["project_name"],
                "status": row["status"],
                "start_date": row["start_date"],
                "end_date": row["end_date"],
                "bid_due_date": row["bid_due_date"],
                "address": project_address(row),
                "address_line1": row["address_line1"],
                "address_line2": row["address_line2"],
                "city": row["city"],
                "province": row["province"],
                "postal_code": row["postal_code"],
                "architect_name": row["architect_name"],
                "probable_schedule": row["probable_schedule"],
                "client_names": row["client_names"],
                "created_at": row["created_at"]
            }
        )

    db.close()

    return projects


@router.get("/projects/{project_id}")
def get_project(project_id: int):

    db = SessionLocal()
    ensure_project_columns(db)

    row = db.execute(
        text(
            """
            SELECT
                p.id,
                p.project_number,
                p.project_name,
                p.status,
                p.start_date,
                p.end_date,
                p.bid_due_date,
                p.address_line1,
                p.address_line2,
                p.city,
                p.province,
                p.postal_code,
                p.architect_name,
                p.probable_schedule
            FROM project
            p
            WHERE id=:id
            """
        ),
        {"id": project_id}
    ).fetchone()

    db.close()

    if row is None:
        raise HTTPException(
            status_code=404,
            detail="Project not found"
        )

    return {
        "id": row.id,
        "project_number": row.project_number,
        "project_name": row.project_name,
        "status": row.status,
        "start_date": row.start_date,
        "end_date": row.end_date,
        "bid_due_date": row.bid_due_date,
        "address_line1": row.address_line1,
        "address_line2": row.address_line2,
        "city": row.city,
        "province": row.province,
        "postal_code": row.postal_code,
        "architect_name": row.architect_name,
        "probable_schedule": row.probable_schedule
    }


@router.post("/projects")
def create_project(project: ProjectCreate):

    if not project.project_name.strip():
        raise HTTPException(
            status_code=422,
            detail="Project name is required"
        )

    folder_result = create_project_folder(project)

    db = SessionLocal()

    try:
        ensure_project_columns(db)
        project_id = insert_project_record(
            db,
            project
        )
    finally:
        db.close()

    return {
        "id": project_id,
        "message": "Project created",
        **folder_result
    }


@router.post("/projects/with-files")
async def create_project_with_files(
    project_number: str | None = Form(None),
    project_name: str = Form(...),
    status: str = Form("PENDING"),
    client_id: int | None = Form(None),
    address_line1: str | None = Form(None),
    address_line2: str | None = Form(None),
    city: str | None = Form(None),
    province: str | None = Form(None),
    postal_code: str | None = Form(None),
    bid_due_date: str | None = Form(None),
    start_date: str | None = Form(None),
    end_date: str | None = Form(None),
    architect_name: str | None = Form(None),
    probable_schedule: str | None = Form(None),
    source_template_path: str | None = Form(None),
    warranty_years: int = Form(1),
    tile_holdback_percent: float = Form(10),
    msg_files: list[UploadFile] | None = File(None),
    folder_files: list[UploadFile] | None = File(None)
):

    project = ProjectCreate(
        project_number=clean_optional_text(project_number),
        project_name=project_name.strip(),
        status=status,
        client_id=client_id,
        address_line1=clean_optional_text(address_line1),
        address_line2=clean_optional_text(address_line2),
        city=clean_optional_text(city),
        province=clean_optional_text(province),
        postal_code=clean_optional_text(postal_code),
        bid_due_date=parse_optional_date(bid_due_date),
        start_date=parse_optional_date(start_date),
        end_date=parse_optional_date(end_date),
        architect_name=clean_optional_text(architect_name),
        probable_schedule=clean_optional_text(probable_schedule),
        source_template_path=clean_optional_text(source_template_path),
        warranty_years=warranty_years,
        tile_holdback_percent=tile_holdback_percent
    )

    if not project.project_name:
        raise HTTPException(
            status_code=422,
            detail="Project name is required"
        )

    folder_result = create_project_folder(project)
    project_folder = Path(folder_result["folder_path"])
    msg_file_count = await save_msg_uploads(
        project_folder,
        msg_files
    )
    upload_file_count = await save_folder_uploads(
        project_folder,
        folder_files
    )

    db = SessionLocal()

    try:
        ensure_project_columns(db)
        project_id = insert_project_record(
            db,
            project
        )
    finally:
        db.close()

    return {
        "id": project_id,
        "message": "Project created",
        "msg_file_count": msg_file_count,
        "upload_file_count": upload_file_count,
        **folder_result
    }
