from fastapi import APIRouter, HTTPException
from sqlalchemy import text

from app.database.database import SessionLocal
from app.schemas.project import ProjectCreate

router = APIRouter()


@router.get("/projects")
def get_projects():

    db = SessionLocal()

    rows = db.execute(
        text(
            """
            SELECT
                id,
                project_number,
                project_name,
                status
            FROM project
            ORDER BY project_name
            """
        )
    )

    projects = []

    for row in rows:
        projects.append(
            {
                "id": row.id,
                "project_number": row.project_number,
                "project_name": row.project_name,
                "status": row.status
            }
        )

    db.close()

    return projects


@router.get("/projects/{project_id}")
def get_project(project_id: int):

    db = SessionLocal()

    row = db.execute(
        text(
            """
            SELECT
                id,
                project_number,
                project_name,
                status
            FROM project
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
        "status": row.status
    }


@router.post("/projects")
def create_project(project: ProjectCreate):

    db = SessionLocal()

    row = db.execute(
        text(
            """
            INSERT INTO project (
                project_number,
                project_name,
                status,
                warranty_years,
                tile_holdback_percent
            )
            VALUES (
                :project_number,
                :project_name,
                :status,
                :warranty_years,
                :tile_holdback_percent
            )
            RETURNING id
            """
        ),
        {
            "project_number": project.project_number,
            "project_name": project.project_name,
            "status": project.status,
            "warranty_years": project.warranty_years,
            "tile_holdback_percent": project.tile_holdback_percent
        }
    ).fetchone()

    db.commit()

    db.close()

    return {
        "id": row.id,
        "message": "Project created"
    }
