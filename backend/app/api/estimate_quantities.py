from fastapi import APIRouter, HTTPException
from sqlalchemy import text

from app.database.database import SessionLocal
from app.schemas.estimate_quantity import EstimateQuantityCreate
from app.schemas.estimate_quantity_update import EstimateQuantityUpdate

router = APIRouter()


@router.get("/estimate-quantities")
def get_estimate_quantities():

    db = SessionLocal()

    rows = db.execute(
        text(
            """
            SELECT
                q.id,
                p.name AS product_name,
                r.room_name,
                q.quantity
            FROM estimate_quantity q

            JOIN estimate_line l
                ON l.id = q.estimate_line_id

            JOIN product p
                ON p.id = l.product_id

            JOIN room r
                ON r.id = q.room_id

            ORDER BY
                p.name,
                r.room_name
            """
        )
    )

    quantities = []

    for row in rows:

        quantities.append(
            {
                "id": row.id,
                "product_name": row.product_name,
                "room_name": row.room_name,
                "quantity": float(row.quantity)
            }
        )

    db.close()

    return quantities


@router.get("/estimate-quantities/{quantity_id}")
def get_estimate_quantity(quantity_id: int):

    db = SessionLocal()

    row = db.execute(
        text(
            """
            SELECT
                id,
                estimate_line_id,
                room_id,
                quantity
            FROM estimate_quantity
            WHERE id = :id
            """
        ),
        {
            "id": quantity_id
        }
    ).fetchone()

    db.close()

    if row is None:

        raise HTTPException(
            status_code=404,
            detail="Estimate quantity not found"
        )

    return dict(row._mapping)


@router.post("/estimate-quantities")
def create_estimate_quantity(
    quantity: EstimateQuantityCreate
):

    db = SessionLocal()

    row = db.execute(
        text(
            """
            INSERT INTO estimate_quantity
            (
                estimate_line_id,
                room_id,
                quantity
            )
            VALUES
            (
                :estimate_line_id,
                :room_id,
                :quantity
            )
            RETURNING id
            """
        ),
        {
            "estimate_line_id": quantity.estimate_line_id,
            "room_id": quantity.room_id,
            "quantity": quantity.quantity
        }
    ).fetchone()

    db.commit()

    db.close()

    return {
        "id": row.id,
        "message": "Estimate quantity created"
    }


@router.put("/estimate-quantities/{quantity_id}")
def update_estimate_quantity(
    quantity_id: int,
    quantity: EstimateQuantityUpdate
):

    db = SessionLocal()

    row = db.execute(
        text(
            """
            UPDATE estimate_quantity
            SET
                quantity = :quantity
            WHERE
                id = :id
            RETURNING id
            """
        ),
        {
            "id": quantity_id,
            "quantity": quantity.quantity
        }
    ).fetchone()

    db.commit()

    db.close()

    if row is None:

        raise HTTPException(
            status_code=404,
            detail="Estimate quantity not found"
        )

    return {
        "id": quantity_id,
        "message": "Estimate quantity updated"
    }


@router.delete("/estimate-quantities/{quantity_id}")
def delete_estimate_quantity(
    quantity_id: int
):

    db = SessionLocal()

    row = db.execute(
        text(
            """
            DELETE FROM estimate_quantity
            WHERE id = :id
            RETURNING id
            """
        ),
        {
            "id": quantity_id
        }
    ).fetchone()

    db.commit()

    db.close()

    if row is None:

        raise HTTPException(
            status_code=404,
            detail="Estimate quantity not found"
        )

    return {
        "id": quantity_id,
        "message": "Estimate quantity deleted"
    }
