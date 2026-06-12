from fastapi import APIRouter, HTTPException
from sqlalchemy import text

from app.database.database import SessionLocal
from app.schemas.estimate import EstimateCreate

router = APIRouter()


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
