from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import text

from app.database.database import SessionLocal
from app.schemas.project import ProjectCreate

router = APIRouter()


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

    db = SessionLocal()
    ensure_project_columns(db)

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
            "project_number": (project.project_number or "").strip() or None,
            "project_name": project.project_name.strip(),
            "status": project.status,
            "start_date": project.start_date,
            "end_date": project.end_date,
            "bid_due_date": project.bid_due_date,
            "address_line1": (project.address_line1 or "").strip() or None,
            "address_line2": (project.address_line2 or "").strip() or None,
            "city": (project.city or "").strip() or None,
            "province": (project.province or "").strip() or None,
            "postal_code": (project.postal_code or "").strip() or None,
            "architect_name": (project.architect_name or "").strip() or None,
            "probable_schedule": (
                project.probable_schedule or ""
            ).strip() or None,
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

    db.close()

    return {
        "id": row.id,
        "message": "Project created",
        "folder_status": "not_created",
        "folder_message": "NAS RW mount is not available"
    }
