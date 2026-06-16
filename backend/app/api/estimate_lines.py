from fastapi import APIRouter, HTTPException
from sqlalchemy import text

from app.database.database import SessionLocal
from app.schemas.estimate_line import EstimateLineCreate
from app.schemas.estimate_line import EstimateLineUpdate

router = APIRouter()


@router.get("/estimate-lines")
def get_estimate_lines():

    db = SessionLocal()

    rows = db.execute(
        text(
            """
            SELECT
                l.id,
                l.estimate_id,
                p.name AS product_name,
                s.name AS surface_name,
                u.name AS unit_name,
                l.grout_color,
                l.loss_percent,
                l.purchase_price,
                l.profit_percent,
                l.installation_cost
            FROM estimate_line l
            JOIN product p
                ON p.id = l.product_id
            JOIN surface_type s
                ON s.id = l.surface_type_id
            JOIN unit u
                ON u.id = l.unit_id
            ORDER BY l.id
            """
        )
    )

    lines = []

    for row in rows:

        lines.append(
            {
                "id": row.id,
                "estimate_id": row.estimate_id,
                "product_name": row.product_name,
                "surface_name": row.surface_name,
                "unit_name": row.unit_name,
                "grout_color": row.grout_color,
                "loss_percent": row.loss_percent,
                "purchase_price": row.purchase_price,
                "profit_percent": row.profit_percent,
                "installation_cost": row.installation_cost
            }
        )

    db.close()

    return lines


@router.get("/estimate-lines/{line_id}")
def get_estimate_line(line_id: int):

    db = SessionLocal()

    row = db.execute(
        text(
            """
            SELECT
                id,
                estimate_id,
                product_id,
                surface_type_id,
                unit_id,
                grout_color,
                loss_percent,
                purchase_price,
                profit_percent,
                installation_cost
            FROM estimate_line
            WHERE id = :id
            """
        ),
        {
            "id": line_id
        }
    ).fetchone()

    db.close()

    if row is None:

        raise HTTPException(
            status_code=404,
            detail="Estimate line not found"
        )

    return dict(row._mapping)


@router.post("/estimate-lines")
def create_estimate_line(line: EstimateLineCreate):

    db = SessionLocal()

    row = db.execute(
        text(
            """
            INSERT INTO estimate_line
            (
                estimate_id,
                product_id,
                surface_type_id,
                unit_id,
                grout_color,
                loss_percent,
                purchase_price,
                profit_percent,
                installation_cost
            )
            VALUES
            (
                :estimate_id,
                :product_id,
                :surface_type_id,
                :unit_id,
                :grout_color,
                :loss_percent,
                :purchase_price,
                :profit_percent,
                :installation_cost
            )
            RETURNING id
            """
        ),
        {
            "estimate_id": line.estimate_id,
            "product_id": line.product_id,
            "surface_type_id": line.surface_type_id,
            "unit_id": line.unit_id,
            "grout_color": line.grout_color,
            "loss_percent": line.loss_percent,
            "purchase_price": line.purchase_price,
            "profit_percent": line.profit_percent,
            "installation_cost": line.installation_cost
        }
    ).fetchone()

    db.execute(
        text(
            """
            INSERT INTO estimate_quantity (
                estimate_line_id,
                room_id,
                quantity
            )
            SELECT
                :estimate_line_id,
                id,
                0
            FROM room
            WHERE estimate_id = :estimate_id
            """
        ),
        {
            "estimate_line_id": row.id,
            "estimate_id": line.estimate_id
        }
    )

    db.commit()

    db.close()

    return {
        "id": row.id,
        "message": "Estimate line created"
    }


@router.put("/estimate-lines/{line_id}")
def update_estimate_line(
    line_id: int,
    line: EstimateLineUpdate
):

    db = SessionLocal()

    row = db.execute(
        text(
            """
            UPDATE estimate_line
            SET
                surface_type_id = :surface_type_id,
                loss_percent = :loss_percent,
                purchase_price = :purchase_price,
                profit_percent = :profit_percent,
                installation_cost = :installation_cost
            WHERE
                id = :id
            RETURNING id
            """
        ),
        {
            "id": line_id,
            "surface_type_id": line.surface_type_id,
            "loss_percent": line.loss_percent,
            "purchase_price": line.purchase_price,
            "profit_percent": line.profit_percent,
            "installation_cost": line.installation_cost
        }
    ).fetchone()

    db.commit()

    db.close()

    if row is None:

        raise HTTPException(
            status_code=404,
            detail="Estimate line not found"
        )

    return {
        "id": line_id,
        "message": "Estimate line updated"
    }
