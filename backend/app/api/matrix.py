from fastapi import APIRouter
from sqlalchemy import text

from app.database.database import SessionLocal

router = APIRouter()


@router.get("/estimates/{estimate_id}/matrix")
def get_matrix(estimate_id: int):

    db = SessionLocal()

    room_rows = db.execute(
        text(
            """
            SELECT
                room_name
            FROM room
            WHERE estimate_id = :estimate_id
            ORDER BY room_name
            """
        ),
        {
            "estimate_id": estimate_id
        }
    )

    rooms = [row.room_name for row in room_rows]

    rows = db.execute(
        text(
            """
            SELECT

                l.id AS line_id,

                p.name AS product_name,

                p.manufacturer_name,

                s.name AS surface_name,

                u.name AS unit_name,

                l.grout_color,

                l.loss_percent,

                l.purchase_price,

                l.profit_percent,

                l.installation_cost,

                r.room_name,

                q.id AS quantity_id,

                q.quantity

            FROM estimate_line l

            JOIN product p
                ON p.id = l.product_id

            JOIN surface_type s
                ON s.id = l.surface_type_id

            JOIN unit u
                ON u.id = l.unit_id

            JOIN estimate_quantity q
                ON q.estimate_line_id = l.id

            JOIN room r
                ON r.id = q.room_id

            WHERE l.estimate_id = :estimate_id

            ORDER BY
                l.id,
                r.room_name
            """
        ),
        {
            "estimate_id": estimate_id
        }
    )

    matrix = {}

    for row in rows:

        line_id = row.line_id

        if line_id not in matrix:

            matrix[line_id] = {

                "line_id": line_id,

                "product_name": row.product_name,

                "manufacturer_name": row.manufacturer_name,

                "surface_name": row.surface_name,

                "unit_name": row.unit_name,

                "grout_color": row.grout_color,

                "loss_percent": float(row.loss_percent),

                "purchase_price": float(row.purchase_price),

                "profit_percent": float(row.profit_percent),

                "installation_cost": float(row.installation_cost),

                "quantities": {}

            }

        matrix[line_id]["quantities"][row.room_name] = {

            "id": row.quantity_id,

            "quantity": float(row.quantity)

        }

    db.close()

    return {

        "rooms": rooms,

        "lines": list(matrix.values())

    }
