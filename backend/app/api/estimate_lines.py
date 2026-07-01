import json

from fastapi import APIRouter, HTTPException
from sqlalchemy import text

from app.database.database import SessionLocal
from app.schemas.estimate_line import EstimateLineCreate
from app.schemas.estimate_line import EstimateLinePositionUpdate
from app.schemas.estimate_line import EstimateLineProductUpdate
from app.schemas.estimate_line import EstimateLineUpdate

router = APIRouter()


def ensure_estimate_line_price_snapshot_schema(db):

    db.execute(
        text(
            """
            ALTER TABLE estimate_line
                ADD COLUMN IF NOT EXISTS quoted_purchase_price NUMERIC(12, 2),
                ADD COLUMN IF NOT EXISTS quoted_price_date TIMESTAMP
            """
        )
    )


def normalize_line_order(
    db,
    estimate_id: int
):

    db.execute(
        text(
            """
            WITH ordered_lines AS (
                SELECT
                    id,
                    row_number() OVER (
                        ORDER BY
                            CASE
                                WHEN COALESCE(sort_order, 0) > 0
                                    THEN sort_order
                                ELSE 2147483647
                            END,
                            id
                    ) AS line_number
                FROM estimate_line
                WHERE estimate_id = :estimate_id
            )
            UPDATE estimate_line l
            SET sort_order = ordered_lines.line_number
            FROM ordered_lines
            WHERE l.id = ordered_lines.id
            """
        ),
        {
            "estimate_id": estimate_id
        }
    )


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
                l.plan_code,
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
                "plan_code": row.plan_code,
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
                plan_code,
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

    ensure_estimate_line_price_snapshot_schema(db)

    normalize_line_order(
        db,
        line.estimate_id
    )

    line_count = db.execute(
        text(
            """
            SELECT count(*) AS line_count
            FROM estimate_line
            WHERE estimate_id = :estimate_id
            """
        ),
        {
            "estimate_id": line.estimate_id
        }
    ).fetchone().line_count

    insert_position = (
        line.insert_position
        if line.insert_position and line.insert_position > 0
        else line_count + 1
    )

    insert_position = min(
        insert_position,
        line_count + 1
    )

    db.execute(
        text(
            """
            UPDATE estimate_line
            SET sort_order = sort_order + 1
            WHERE estimate_id = :estimate_id
                AND sort_order >= :insert_position
            """
        ),
        {
            "estimate_id": line.estimate_id,
            "insert_position": insert_position
        }
    )

    row = db.execute(
        text(
            """
            INSERT INTO estimate_line
            (
                estimate_id,
                product_id,
                surface_type_id,
                unit_id,
                plan_code,
                grout_color,
                loss_percent,
                purchase_price,
                quoted_purchase_price,
                quoted_price_date,
                profit_percent,
                installation_cost,
                sort_order
            )
            VALUES
            (
                :estimate_id,
                :product_id,
                :surface_type_id,
                :unit_id,
                :plan_code,
                :grout_color,
                :loss_percent,
                :purchase_price,
                :purchase_price,
                CURRENT_TIMESTAMP,
                :profit_percent,
                :installation_cost,
                :sort_order
            )
            RETURNING id
            """
        ),
        {
            "estimate_id": line.estimate_id,
            "product_id": line.product_id,
            "surface_type_id": line.surface_type_id,
            "unit_id": line.unit_id,
            "plan_code": line.plan_code,
            "grout_color": line.grout_color,
            "loss_percent": line.loss_percent,
            "purchase_price": line.purchase_price,
            "profit_percent": line.profit_percent,
            "installation_cost": line.installation_cost,
            "sort_order": insert_position
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


@router.put("/estimate-lines/{line_id}/position")
def update_estimate_line_position(
    line_id: int,
    update: EstimateLinePositionUpdate
):

    db = SessionLocal()

    line_row = db.execute(
        text(
            """
            SELECT
                id,
                estimate_id,
                sort_order
            FROM estimate_line
            WHERE id = :id
            """
        ),
        {
            "id": line_id
        }
    ).fetchone()

    if line_row is None:

        db.close()

        raise HTTPException(
            status_code=404,
            detail="Estimate line not found"
        )

    normalize_line_order(
        db,
        line_row.estimate_id
    )

    refreshed_line = db.execute(
        text(
            """
            SELECT sort_order
            FROM estimate_line
            WHERE id = :id
            """
        ),
        {
            "id": line_id
        }
    ).fetchone()

    line_count = db.execute(
        text(
            """
            SELECT count(*) AS line_count
            FROM estimate_line
            WHERE estimate_id = :estimate_id
            """
        ),
        {
            "estimate_id": line_row.estimate_id
        }
    ).fetchone().line_count

    target_position = max(
        1,
        min(
            update.position,
            line_count
        )
    )

    current_position = refreshed_line.sort_order

    if target_position < current_position:
        db.execute(
            text(
                """
                UPDATE estimate_line
                SET sort_order = sort_order + 1
                WHERE estimate_id = :estimate_id
                    AND sort_order >= :target_position
                    AND sort_order < :current_position
                """
            ),
            {
                "estimate_id": line_row.estimate_id,
                "target_position": target_position,
                "current_position": current_position
            }
        )

    elif target_position > current_position:
        db.execute(
            text(
                """
                UPDATE estimate_line
                SET sort_order = sort_order - 1
                WHERE estimate_id = :estimate_id
                    AND sort_order <= :target_position
                    AND sort_order > :current_position
                """
            ),
            {
                "estimate_id": line_row.estimate_id,
                "target_position": target_position,
                "current_position": current_position
            }
        )

    db.execute(
        text(
            """
            UPDATE estimate_line
            SET sort_order = :target_position
            WHERE id = :id
            """
        ),
        {
            "id": line_id,
            "target_position": target_position
        }
    )

    normalize_line_order(
        db,
        line_row.estimate_id
    )

    db.commit()

    db.close()

    return {
        "id": line_id,
        "position": target_position,
        "message": "Estimate line position updated"
    }


@router.put("/estimate-lines/{line_id}/product")
def update_estimate_line_product(
    line_id: int,
    update: EstimateLineProductUpdate
):

    db = SessionLocal()

    ensure_estimate_line_price_snapshot_schema(db)

    line_row = db.execute(
        text(
            """
            SELECT
                id,
                estimate_id,
                product_id
            FROM estimate_line
            WHERE id = :id
            """
        ),
        {
            "id": line_id
        }
    ).fetchone()

    if line_row is None:

        db.close()

        raise HTTPException(
            status_code=404,
            detail="Estimate line not found"
        )

    if update.apply_matching_product:

        result = db.execute(
            text(
                """
                UPDATE estimate_line
                SET
                    product_id = :product_id,
                    unit_id = :unit_id,
                    grout_color = :grout_color,
                    purchase_price = :purchase_price,
                    quoted_purchase_price = :purchase_price,
                    quoted_price_date = CURRENT_TIMESTAMP
                WHERE estimate_id = :estimate_id
                    AND product_id = :old_product_id
                """
            ),
            {
                "estimate_id": line_row.estimate_id,
                "old_product_id": line_row.product_id,
                "product_id": update.product_id,
                "unit_id": update.unit_id,
                "grout_color": update.grout_color,
                "purchase_price": update.purchase_price
            }
        )

        db.execute(
            text(
                """
                UPDATE estimate_line
                SET surface_type_id = :surface_type_id
                WHERE id = :id
                """
            ),
            {
                "id": line_id,
                "surface_type_id": update.surface_type_id
            }
        )

        updated_lines = result.rowcount

    else:

        result = db.execute(
            text(
                """
                UPDATE estimate_line
                SET
                    product_id = :product_id,
                    surface_type_id = :surface_type_id,
                    unit_id = :unit_id,
                    grout_color = :grout_color,
                    purchase_price = :purchase_price,
                    quoted_purchase_price = :purchase_price,
                    quoted_price_date = CURRENT_TIMESTAMP
                WHERE id = :id
                """
            ),
            {
                "id": line_id,
                "product_id": update.product_id,
                "surface_type_id": update.surface_type_id,
                "unit_id": update.unit_id,
                "grout_color": update.grout_color,
                "purchase_price": update.purchase_price
            }
        )

        updated_lines = result.rowcount

    db.commit()

    db.close()

    return {
        "id": line_id,
        "updated_lines": updated_lines,
        "message": "Estimate line product updated"
    }


@router.put("/estimate-lines/{line_id}")
def update_estimate_line(
    line_id: int,
    line: EstimateLineUpdate
):

    db = SessionLocal()

    ensure_estimate_line_price_snapshot_schema(db)

    row = db.execute(
        text(
            """
            UPDATE estimate_line
            SET
                surface_type_id = :surface_type_id,
                plan_code = :plan_code,
                loss_percent = :loss_percent,
                purchase_price = :purchase_price,
                quoted_purchase_price = :purchase_price,
                quoted_price_date = CURRENT_TIMESTAMP,
                profit_percent = :profit_percent,
                installation_cost = :installation_cost,
                installation_link_source_line_id = :installation_link_source_line_id,
                installation_link_multiplier = :installation_link_multiplier,
                quantity_link_source_line_ids = CAST(:quantity_link_source_line_ids AS JSONB),
                quantity_link_multiplier = :quantity_link_multiplier,
                manpower_multiplier = :manpower_multiplier
            WHERE
                id = :id
            RETURNING id
            """
        ),
        {
            "id": line_id,
            "surface_type_id": line.surface_type_id,
            "plan_code": line.plan_code,
            "loss_percent": line.loss_percent,
            "purchase_price": line.purchase_price,
            "profit_percent": line.profit_percent,
            "installation_cost": line.installation_cost,
            "installation_link_source_line_id":
                line.installation_link_source_line_id,
            "installation_link_multiplier":
                line.installation_link_multiplier,
            "quantity_link_source_line_ids":
                json.dumps(line.quantity_link_source_line_ids),
            "quantity_link_multiplier":
                line.quantity_link_multiplier,
            "manpower_multiplier":
                line.manpower_multiplier
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


@router.delete("/estimate-lines/{line_id}")
def delete_estimate_line(line_id: int):

    db = SessionLocal()

    row = db.execute(
        text(
            """
            SELECT
                id,
                estimate_id
            FROM estimate_line
            WHERE id = :id
            """
        ),
        {
            "id": line_id
        }
    ).fetchone()

    if row is None:

        db.close()

        raise HTTPException(
            status_code=404,
            detail="Estimate line not found"
        )

    db.execute(
        text(
            """
            DELETE FROM estimate_quantity
            WHERE estimate_line_id = :id
            """
        ),
        {
            "id": line_id
        }
    )

    db.execute(
        text(
            """
            DELETE FROM estimate_line
            WHERE id = :id
            """
        ),
        {
            "id": line_id
        }
    )

    normalize_line_order(
        db,
        row.estimate_id
    )

    db.commit()

    db.close()

    return {
        "id": line_id,
        "message": "Estimate line deleted"
    }
