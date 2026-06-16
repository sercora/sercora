import os
import re
import json
from datetime import date, timedelta
from html import unescape
from html.parser import HTMLParser
from http.cookiejar import CookieJar
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import HTTPCookieProcessor, Request, build_opener

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile
from pydantic import BaseModel
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
BSDQ_BABILLARD_ROOT = "https://tes.bsdq.org/babillard/controller/Babillard"
BSDQ_SEARCH_TIMEOUT = 20
SUBMISSION_STATES = {
    "new": "NEW",
    "approved": "APPROVED",
    "undecided": "UNDECIDED",
    "refused": "REFUSED"
}


class ProjectSubmissionStateUpdate(BaseModel):
    submission_state: str
    user_id: int | None = None


class BsdqResultParser(HTMLParser):

    def __init__(self):
        super().__init__()
        self.rows = []
        self._in_record_table = False
        self._in_row = False
        self._in_cell = False
        self._current_row = []
        self._current_cell = []

    def handle_starttag(self, tag, attrs):

        attrs_dict = dict(attrs)

        if tag == "table" and "record_table" in attrs_dict.get("class", ""):
            self._in_record_table = True
            return

        if not self._in_record_table:
            return

        if tag == "tr":
            self._in_row = True
            self._current_row = []
            return

        if tag == "td" and self._in_row:
            self._in_cell = True
            self._current_cell = []

    def handle_endtag(self, tag):

        if not self._in_record_table:
            return

        if tag == "td" and self._in_cell:
            self._current_row.append(
                clean_html_text(
                    " ".join(self._current_cell)
                )
            )
            self._current_cell = []
            self._in_cell = False
            return

        if tag == "tr" and self._in_row:
            if len(self._current_row) >= 4:
                self.rows.append(self._current_row[:4])

            self._current_row = []
            self._in_row = False
            return

        if tag == "table":
            self._in_record_table = False

    def handle_data(self, data):

        if self._in_cell:
            self._current_cell.append(data)


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
    db.execute(
        text(
            """
            ALTER TABLE project
            ADD COLUMN IF NOT EXISTS bsdq_project_number VARCHAR(80)
            """
        )
    )
    db.execute(
        text(
            """
            ALTER TABLE project
            ADD COLUMN IF NOT EXISTS bsdq_due_time VARCHAR(10)
            """
        )
    )
    db.execute(
        text(
            """
            ALTER TABLE project
            ADD COLUMN IF NOT EXISTS addenda TEXT
            """
        )
    )
    db.execute(
        text(
            """
            ALTER TABLE project
            ADD COLUMN IF NOT EXISTS submission_state VARCHAR(30)
                DEFAULT 'NEW'
            """
        )
    )
    db.execute(
        text(
            """
            ALTER TABLE project
            ADD COLUMN IF NOT EXISTS submission_state_user_id BIGINT
            """
        )
    )
    db.execute(
        text(
            """
            ALTER TABLE project
            ADD COLUMN IF NOT EXISTS submission_state_updated_at TIMESTAMP
            """
        )
    )
    db.execute(
        text(
            """
            UPDATE project
            SET submission_state = 'NEW'
            WHERE submission_state IS NULL
            """
        )
    )
    db.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS project_invitation (
                id BIGSERIAL PRIMARY KEY,
                project_id BIGINT NOT NULL REFERENCES project(id) ON DELETE CASCADE,
                client_id BIGINT REFERENCES client(id) ON DELETE SET NULL,
                invited_on DATE NOT NULL DEFAULT CURRENT_DATE,
                project_folder_name TEXT NOT NULL,
                msg_filename TEXT NOT NULL,
                msg_relative_path TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
    )
    db.execute(
        text(
            """
            CREATE INDEX IF NOT EXISTS idx_project_invitation_project
                ON project_invitation(project_id, invited_on, id)
            """
        )
    )
    db.commit()


def clean_optional_text(
    value
):

    return (value or "").strip() or None


def clean_html_text(
    value
):

    return re.sub(
        r"\s+",
        " ",
        unescape(str(value or ""))
    ).strip()


def bsdq_date_value(
    value
):

    parsed_date = parse_optional_date(value)

    return (
        parsed_date.strftime("%Y/%m/%d")
        if parsed_date
        else ""
    )


def parse_bsdq_due_text(
    value
):

    text_value = clean_html_text(value)
    match = re.search(
        r"(?P<date>\d{4}/\d{2}/\d{2})(?:\s+(?P<time>\d{2}:\d{2}))?",
        text_value
    )

    if not match:
        return {
            "due_date": None,
            "due_time": None
        }

    return {
        "due_date": match.group("date").replace("/", "-"),
        "due_time": match.group("time")
    }


def parse_bsdq_results(
    html
):

    parser = BsdqResultParser()
    parser.feed(html)
    results = []

    for row in parser.rows:
        due_parts = parse_bsdq_due_text(row[2])
        results.append(
            {
                "bsdq_project_number": row[0],
                "description": row[1],
                "due_at_text": row[2],
                "due_date": due_parts["due_date"],
                "due_time": due_parts["due_time"],
                "city": row[3],
                "is_open": True
            }
        )

    return results


def fetch_bsdq_projects(
    description: str | None,
    city: str | None,
    bsdq_project_number: str | None,
    seao_number: str | None,
    date_from: date | None,
    date_to: date | None
):

    cookie_jar = CookieJar()
    opener = build_opener(
        HTTPCookieProcessor(cookie_jar)
    )
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (X11; Linux x86_64) "
            "AppleWebKit/537.36 Chrome/120 Safari/537.36"
        ),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    }
    find_url = f"{BSDQ_BABILLARD_ROOT}/U2401/find?language=fr"
    search_url = f"{BSDQ_BABILLARD_ROOT}/U2401/getrecords"

    opener.open(
        Request(
            find_url,
            headers=headers
        ),
        timeout=BSDQ_SEARCH_TIMEOUT
    ).read()

    form_values = {
        "session_id": "",
        "returntomapping": "babillard",
        "popupcheck": "0",
        "sNoProjet": clean_html_text(bsdq_project_number)[:12],
        "dtClotureBsdqDu": bsdq_date_value(date_from),
        "dtClotureBsdqAu": bsdq_date_value(date_to),
        "sDescrProjet": clean_html_text(description)[:60],
        "sNoSeao": clean_html_text(seao_number)[:10],
        "lProjetOuvert": "1",
        "iTypeRecherche": "1",
        "sVille": clean_html_text(city)[:60]
    }
    data = urlencode(form_values).encode("utf-8")
    post_headers = {
        **headers,
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": str(len(data)),
        "Origin": "https://tes.bsdq.org",
        "Referer": find_url
    }
    response = opener.open(
        Request(
            search_url,
            data=data,
            headers=post_headers
        ),
        timeout=BSDQ_SEARCH_TIMEOUT
    )
    body = response.read()

    return parse_bsdq_results(
        body.decode(
            "iso-8859-1",
            errors="replace"
        )
    )


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

    return project_folder_name_from_values(
        project.project_name,
        project.bid_due_date
    )


def project_folder_name_from_values(
    project_name: str,
    due_date: date | None
):

    date_part = (
        due_date.strftime("%Y %m %d")
        if due_date
        else "0000 00 00"
    )

    return f"{date_part}, {safe_name(project_name, 'Projet')}"


def project_create_from_row(
    row,
    bid_due_date: date | None
):

    return ProjectCreate(
        project_number=row.project_number,
        bsdq_project_number=row.bsdq_project_number,
        project_name=row.project_name,
        status=row.status or "PENDING",
        address_line1=row.address_line1,
        address_line2=row.address_line2,
        city=row.city,
        province=row.province,
        postal_code=row.postal_code,
        bid_due_date=bid_due_date,
        bsdq_due_time=row.bsdq_due_time,
        start_date=row.start_date,
        end_date=row.end_date,
        architect_name=row.architect_name,
        probable_schedule=row.probable_schedule,
        warranty_years=row.warranty_years or 1,
        tile_holdback_percent=float(row.tile_holdback_percent or 10)
    )


def parse_addenda_rows(
    value: str | None
):

    if not value:
        return []

    try:
        rows = json.loads(value)
    except json.JSONDecodeError:
        return [
            {
                "name": "",
                "date": "",
                "included": False,
                "plans": False,
                "specs": False,
                "description": value
            }
        ]

    if not isinstance(rows, list):
        return []

    parsed_rows = []

    for row in rows:
        if not isinstance(row, dict):
            continue

        parsed_rows.append(
            {
                "name": str(row.get("name") or ""),
                "date": str(row.get("date") or ""),
                "included": bool(row.get("included")),
                "plans": bool(row.get("plans")),
                "specs": bool(row.get("specs")),
                "description": str(row.get("description") or "")
            }
        )

    return parsed_rows


def serialize_addenda_rows(
    rows
):

    return json.dumps(
        rows,
        ensure_ascii=False
    )


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


def ensure_project_folder_for_update(
    project_row,
    bid_due_date: date | None
):

    old_name = project_folder_name_from_values(
        project_row.project_name,
        project_row.bid_due_date
    )
    new_name = project_folder_name_from_values(
        project_row.project_name,
        bid_due_date
    )
    old_path = PROJECT_RW_ROOT / old_name
    new_path = PROJECT_RW_ROOT / new_name

    if old_path.exists() and old_path != new_path:
        if new_path.exists():
            return {
                "folder_name": new_name,
                "folder_path": str(new_path),
                "folder_status": "exists",
                "folder_message": "Dossier projet existant conserve"
            }

        old_path.rename(new_path)

        return {
            "folder_name": new_name,
            "folder_path": str(new_path),
            "folder_status": "renamed",
            "folder_message": "Dossier projet renomme selon la date de depot"
        }

    if new_path.exists():
        return {
            "folder_name": new_name,
            "folder_path": str(new_path),
            "folder_status": "exists",
            "folder_message": "Dossier projet existant conserve"
        }

    project = project_create_from_row(
        project_row,
        bid_due_date
    )

    return create_project_folder(project)


def ensure_revision_zero(
    db,
    project_id: int
):

    existing_row = db.execute(
        text(
            """
            SELECT id
            FROM estimate
            WHERE project_id = :project_id
                AND revision_number = 0
            ORDER BY id
            LIMIT 1
            """
        ),
        {
            "project_id": project_id
        }
    ).fetchone()

    if existing_row:
        return existing_row.id, False

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
                0,
                'Soumission',
                'Revision initiale'
            )
            RETURNING id
            """
        ),
        {
            "project_id": project_id
        }
    ).fetchone()

    return row.id, True


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


def client_name_for_invitation(
    db,
    client_id: int | None
):

    if not client_id:
        return "Client"

    row = db.execute(
        text(
            """
            SELECT name
            FROM client
            WHERE id = :client_id
            """
        ),
        {
            "client_id": client_id
        }
    ).fetchone()

    if row is None:
        raise HTTPException(
            status_code=404,
            detail="Client d'invitation introuvable"
        )

    return row.name


async def save_project_invitation_uploads(
    db,
    project_id: int,
    project_folder: Path,
    project_folder_name: str,
    client_id: int | None,
    uploads: list[UploadFile] | None
):

    saved_count = 0
    invitation_date = date.today()
    client_name = client_name_for_invitation(
        db,
        client_id
    )
    invitation_dir = project_folder / PROJECT_INVITATION_DIR

    for upload in uploads or []:
        filename = upload.filename or ""

        if not filename:
            continue

        if not filename.lower().endswith(".msg"):
            raise HTTPException(
                status_code=422,
                detail="Seuls les fichiers .msg sont acceptes ici"
            )

        msg_filename = (
            f"{invitation_date.strftime('%Y %m %d')}, "
            f"Invitation {safe_name(client_name, 'Client')}.msg"
        )
        destination = unique_path(
            invitation_dir / msg_filename
        )
        relative_path = destination.relative_to(project_folder)

        await save_upload_file(
            upload,
            destination
        )

        db.execute(
            text(
                """
                INSERT INTO project_invitation (
                    project_id,
                    client_id,
                    invited_on,
                    project_folder_name,
                    msg_filename,
                    msg_relative_path
                )
                VALUES (
                    :project_id,
                    :client_id,
                    :invited_on,
                    :project_folder_name,
                    :msg_filename,
                    :msg_relative_path
                )
                """
            ),
            {
                "project_id": project_id,
                "client_id": client_id,
                "invited_on": invitation_date,
                "project_folder_name": project_folder_name,
                "msg_filename": destination.name,
                "msg_relative_path": str(relative_path)
            }
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
                bsdq_project_number,
                project_name,
                status,
                start_date,
                end_date,
                bid_due_date,
                bsdq_due_time,
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
                :bsdq_project_number,
                :project_name,
                :status,
                :start_date,
                :end_date,
                :bid_due_date,
                :bsdq_due_time,
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
            "bsdq_project_number": clean_optional_text(project.bsdq_project_number),
            "project_name": project.project_name.strip(),
            "status": project.status,
            "start_date": project.start_date,
            "end_date": project.end_date,
            "bid_due_date": project.bid_due_date,
            "bsdq_due_time": clean_optional_text(project.bsdq_due_time),
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
    scope: str = Query("all", pattern="^(all|current|submission)$"),
    submission_state: str | None = Query(
        None,
        pattern="^(new|approved|undecided|refused)$"
    )
):

    db = SessionLocal()
    ensure_project_columns(db)

    filters = []
    params = {}

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

    if scope == "submission":
        filters.append(
            """
            COALESCE(p.status, 'PENDING') = 'PENDING'
            """
        )
        filters.append(
            """
            COALESCE(p.submission_state, 'NEW') = :submission_state
            """
        )
        params["submission_state"] = SUBMISSION_STATES[
            submission_state or "new"
        ]

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
                p.bsdq_project_number,
                p.project_name,
                p.status,
                COALESCE(p.submission_state, 'NEW') AS submission_state,
                p.submission_state_updated_at,
                state_user.id AS submission_state_user_id,
                state_user.full_name AS submission_state_user_name,
                p.start_date,
                p.end_date,
                p.bid_due_date,
                p.bsdq_due_time,
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
                ) AS client_names,
                COALESCE(
                    ARRAY_AGG(c.id ORDER BY c.name)
                        FILTER (WHERE c.id IS NOT NULL),
                    ARRAY[]::BIGINT[]
                ) AS client_ids,
                (
                    SELECT e.id
                    FROM estimate e
                    WHERE e.project_id = p.id
                        AND e.revision_number = 0
                    ORDER BY e.id
                    LIMIT 1
                ) AS revision_zero_estimate_id,
                (
                    SELECT e.id
                    FROM estimate e
                    WHERE e.project_id = p.id
                    ORDER BY
                        e.revision_number DESC NULLS LAST,
                        e.id DESC
                    LIMIT 1
                ) AS latest_estimate_id,
                (
                    SELECT COUNT(*)
                    FROM estimate e
                    WHERE e.project_id = p.id
                ) AS revision_count,
                COALESCE(
                    (
                        SELECT JSON_AGG(
                            JSON_BUILD_OBJECT(
                                'id', pi.id,
                                'client_id', pi.client_id,
                                'client_name', c_inv.name,
                                'invited_on', pi.invited_on,
                                'msg_filename', pi.msg_filename,
                                'msg_relative_path', pi.msg_relative_path
                            )
                            ORDER BY pi.invited_on DESC, pi.id DESC
                        )
                        FROM project_invitation pi
                        LEFT JOIN client c_inv
                            ON c_inv.id = pi.client_id
                        WHERE pi.project_id = p.id
                    ),
                    '[]'::json
                ) AS invitations,
                p.addenda
            FROM project p
            LEFT JOIN project_client pc
                ON pc.project_id = p.id
            LEFT JOIN client c
                ON c.id = pc.client_id
            LEFT JOIN app_user state_user
                ON state_user.id = p.submission_state_user_id
            {where_clause}
            GROUP BY
                p.id,
                p.project_number,
                p.bsdq_project_number,
                p.project_name,
                p.status,
                p.submission_state,
                p.submission_state_updated_at,
                state_user.id,
                state_user.full_name,
                p.start_date,
                p.end_date,
                p.bid_due_date,
                p.bsdq_due_time,
                p.address_line1,
                p.address_line2,
                p.city,
                p.province,
                p.postal_code,
                p.architect_name,
                p.probable_schedule,
                p.addenda,
                p.created_at
            ORDER BY
                p.bid_due_date NULLS LAST,
                p.project_name
            """
        ),
        params
    ).mappings().all()

    projects = []

    for row in rows:
        projects.append(
            {
                "id": row["id"],
                "project_number": row["project_number"],
                "bsdq_project_number": row["bsdq_project_number"],
                "project_name": row["project_name"],
                "status": row["status"],
                "submission_state": row["submission_state"],
                "submission_state_user_id": row["submission_state_user_id"],
                "submission_state_user_name": row["submission_state_user_name"],
                "submission_state_updated_at": row["submission_state_updated_at"],
                "start_date": row["start_date"],
                "end_date": row["end_date"],
                "bid_due_date": row["bid_due_date"],
                "bsdq_due_time": row["bsdq_due_time"],
                "address": project_address(row),
                "address_line1": row["address_line1"],
                "address_line2": row["address_line2"],
                "city": row["city"],
                "province": row["province"],
                "postal_code": row["postal_code"],
                "architect_name": row["architect_name"],
                "probable_schedule": row["probable_schedule"],
                "client_names": row["client_names"],
                "client_ids": [
                    int(client_id)
                    for client_id in row["client_ids"]
                ],
                "revision_zero_estimate_id": row["revision_zero_estimate_id"],
                "latest_estimate_id": row["latest_estimate_id"],
                "revision_count": row["revision_count"],
                "invitations": row["invitations"] or [],
                "addenda": row["addenda"],
                "created_at": row["created_at"]
            }
        )

    db.close()

    return projects


@router.get("/projects/bsdq/search")
def search_bsdq_projects(
    description: str | None = Query(None, max_length=120),
    city: str | None = Query(None, max_length=80),
    bsdq_project_number: str | None = Query(None, max_length=20),
    seao_number: str | None = Query(None, max_length=20),
    date_from: str | None = Query(None),
    date_to: str | None = Query(None)
):

    has_query = any(
        clean_optional_text(value)
        for value in (
            description,
            city,
            bsdq_project_number,
            seao_number
        )
    )

    if not has_query:
        raise HTTPException(
            status_code=422,
            detail="Entrez au moins un critere de recherche BSDQ."
        )

    parsed_date_from = parse_optional_date(date_from) or date.today()
    parsed_date_to = parse_optional_date(date_to) or (
        parsed_date_from + timedelta(days=180)
    )

    try:
        results = fetch_bsdq_projects(
            description,
            city,
            bsdq_project_number,
            seao_number,
            parsed_date_from,
            parsed_date_to
        )
    except (HTTPError, URLError, TimeoutError, OSError) as error:
        raise HTTPException(
            status_code=502,
            detail=f"Recherche BSDQ indisponible: {error}"
        ) from error

    return {
        "source": "BSDQ Babillard public",
        "official_api": False,
        "date_from": parsed_date_from,
        "date_to": parsed_date_to,
        "rows": results[:50]
    }


@router.put("/projects/{project_id}/submission-state")
def update_project_submission_state(
    project_id: int,
    update: ProjectSubmissionStateUpdate
):

    normalized_state = (update.submission_state or "").lower()

    if normalized_state not in SUBMISSION_STATES:
        raise HTTPException(
            status_code=422,
            detail="Etat de soumission invalide"
        )

    db = SessionLocal()

    try:
        ensure_project_columns(db)

        project_row = db.execute(
            text(
                """
                SELECT id
                FROM project
                WHERE id = :project_id
                """
            ),
            {
                "project_id": project_id
            }
        ).fetchone()

        if project_row is None:
            raise HTTPException(
                status_code=404,
                detail="Projet introuvable"
            )

        user_row = None

        if update.user_id is not None:
            user_row = db.execute(
                text(
                    """
                    SELECT id, full_name
                    FROM app_user
                    WHERE id = :user_id
                        AND active = TRUE
                    """
                ),
                {
                    "user_id": update.user_id
                }
            ).fetchone()

            if user_row is None:
                raise HTTPException(
                    status_code=422,
                    detail="Usager introuvable ou inactif"
                )

        row = db.execute(
            text(
                """
                UPDATE project
                SET submission_state = :submission_state,
                    submission_state_user_id = :user_id,
                    submission_state_updated_at = CURRENT_TIMESTAMP
                WHERE id = :project_id
                RETURNING
                    id,
                    submission_state,
                    submission_state_user_id,
                    submission_state_updated_at
                """
            ),
            {
                "project_id": project_id,
                "submission_state": SUBMISSION_STATES[normalized_state],
                "user_id": update.user_id
            }
        ).fetchone()
        db.commit()

        return {
            "id": row.id,
            "submission_state": row.submission_state,
            "submission_state_user_id": row.submission_state_user_id,
            "submission_state_user_name": (
                user_row.full_name
                if user_row
                else None
            ),
            "submission_state_updated_at": row.submission_state_updated_at
        }

    finally:
        db.close()


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
                p.bsdq_project_number,
                p.project_name,
                p.status,
                p.start_date,
                p.end_date,
                p.bid_due_date,
                p.bsdq_due_time,
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
        "bsdq_project_number": row.bsdq_project_number,
        "project_name": row.project_name,
        "status": row.status,
        "start_date": row.start_date,
        "end_date": row.end_date,
        "bid_due_date": row.bid_due_date,
        "bsdq_due_time": row.bsdq_due_time,
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
        revision_zero_estimate_id, revision_created = ensure_revision_zero(
            db,
            project_id
        )
        db.commit()
    finally:
        db.close()

    return {
        "id": project_id,
        "message": "Project created",
        "revision_zero_estimate_id": revision_zero_estimate_id,
        "revision_zero_created": revision_created,
        **folder_result
    }


@router.post("/projects/with-files")
async def create_project_with_files(
    project_number: str | None = Form(None),
    bsdq_project_number: str | None = Form(None),
    project_name: str = Form(...),
    status: str = Form("PENDING"),
    client_id: int | None = Form(None),
    address_line1: str | None = Form(None),
    address_line2: str | None = Form(None),
    city: str | None = Form(None),
    province: str | None = Form(None),
    postal_code: str | None = Form(None),
    bid_due_date: str | None = Form(None),
    bsdq_due_time: str | None = Form(None),
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
        bsdq_project_number=clean_optional_text(bsdq_project_number),
        project_name=project_name.strip(),
        status=status,
        client_id=client_id,
        address_line1=clean_optional_text(address_line1),
        address_line2=clean_optional_text(address_line2),
        city=clean_optional_text(city),
        province=clean_optional_text(province),
        postal_code=clean_optional_text(postal_code),
        bid_due_date=parse_optional_date(bid_due_date),
        bsdq_due_time=clean_optional_text(bsdq_due_time),
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
        revision_zero_estimate_id, revision_created = ensure_revision_zero(
            db,
            project_id
        )
        db.commit()
    finally:
        db.close()

    return {
        "id": project_id,
        "message": "Project created",
        "msg_file_count": msg_file_count,
        "upload_file_count": upload_file_count,
        "revision_zero_estimate_id": revision_zero_estimate_id,
        "revision_zero_created": revision_created,
        **folder_result
    }


@router.put("/projects/{project_id}/current-edit")
async def update_current_project(
    project_id: int,
    bid_due_date: str | None = Form(None),
    bsdq_project_number: str | None = Form(None),
    bsdq_due_time: str | None = Form(None),
    client_ids: list[int] | None = Form(None),
    invitation_client_id: int | None = Form(None),
    addenda_name: str | None = Form(None),
    addenda_date: str | None = Form(None),
    addenda_plans: bool = Form(False),
    addenda_specs: bool = Form(False),
    addenda_description: str | None = Form(None),
    msg_files: list[UploadFile] | None = File(None)
):

    next_bid_due_date = parse_optional_date(bid_due_date)

    db = SessionLocal()

    try:
        ensure_project_columns(db)

        project_row = db.execute(
            text(
                """
                SELECT
                    id,
                    project_number,
                    bsdq_project_number,
                    project_name,
                    status,
                    start_date,
                    end_date,
                    bid_due_date,
                    bsdq_due_time,
                    address_line1,
                    address_line2,
                    city,
                    province,
                    postal_code,
                    architect_name,
                    probable_schedule,
                    warranty_years,
                    tile_holdback_percent,
                    addenda
                FROM project
                WHERE id = :project_id
                """
            ),
            {
                "project_id": project_id
            }
        ).fetchone()

        if project_row is None:
            raise HTTPException(
                status_code=404,
                detail="Projet introuvable"
            )

        next_client_ids = list(
            dict.fromkeys(client_ids or [])
        )

        if invitation_client_id and invitation_client_id not in next_client_ids:
            next_client_ids.append(invitation_client_id)

        folder_result = ensure_project_folder_for_update(
            project_row,
            next_bid_due_date
        )
        db.execute(
            text(
                """
                UPDATE project_invitation
                SET project_folder_name = :project_folder_name
                WHERE project_id = :project_id
                """
            ),
            {
                "project_id": project_id,
                "project_folder_name": folder_result["folder_name"]
            }
        )
        msg_file_count = await save_project_invitation_uploads(
            db,
            project_id,
            Path(folder_result["folder_path"]),
            folder_result["folder_name"],
            invitation_client_id,
            msg_files
        )

        addenda_rows = parse_addenda_rows(
            project_row.addenda
        )
        addenda_has_content = any(
            [
                clean_optional_text(addenda_name),
                addenda_date,
                addenda_plans,
                addenda_specs,
                clean_optional_text(addenda_description)
            ]
        )

        next_addenda = project_row.addenda

        if addenda_has_content:
            addenda_rows.append(
                {
                    "name": clean_optional_text(addenda_name) or "",
                    "date": addenda_date or "",
                    "included": False,
                    "plans": addenda_plans,
                    "specs": addenda_specs,
                    "description": clean_optional_text(addenda_description) or ""
                }
            )
            next_addenda = serialize_addenda_rows(
                addenda_rows
            )

        db.execute(
            text(
                """
                UPDATE project
                SET
                    bid_due_date = :bid_due_date,
                    bsdq_project_number = :bsdq_project_number,
                    bsdq_due_time = :bsdq_due_time,
                    addenda = :addenda
                WHERE id = :project_id
                """
            ),
            {
                "project_id": project_id,
                "bid_due_date": next_bid_due_date,
                "bsdq_project_number": clean_optional_text(bsdq_project_number),
                "bsdq_due_time": clean_optional_text(bsdq_due_time),
                "addenda": next_addenda
            }
        )

        for client_id in next_client_ids:
            db.execute(
                text(
                    """
                    INSERT INTO project_client (
                        project_id,
                        client_id
                    )
                    SELECT
                        :project_id,
                        :client_id
                    WHERE NOT EXISTS (
                        SELECT 1
                        FROM project_client
                        WHERE project_id = :project_id
                            AND client_id = :client_id
                    )
                    """
                ),
                {
                    "project_id": project_id,
                    "client_id": client_id
                }
            )

        revision_zero_estimate_id, revision_created = ensure_revision_zero(
            db,
            project_id
        )

        db.commit()

        return {
            "id": project_id,
            "message": "Projet modifie",
            "folder_name": folder_result["folder_name"],
            "folder_status": folder_result["folder_status"],
            "folder_message": folder_result["folder_message"],
            "msg_file_count": msg_file_count,
            "addenda_count": len(addenda_rows),
            "revision_zero_estimate_id": revision_zero_estimate_id,
            "revision_zero_created": revision_created
        }
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
