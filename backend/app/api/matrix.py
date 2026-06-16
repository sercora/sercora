from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import text

from app.database.database import SessionLocal

router = APIRouter()


CURRENT_RATE_INFO = {
    "date": "2025-01-29",
    "day": 100.00,
    "evening": 112.00,
    "night": 112.00,
    "civil": 105.00,
    "tm": 105.00
}


class MatrixSummaryUpdate(BaseModel):
    used_hourly_rate: float | None = Field(default=None, ge=0)
    global_profit_percent: float | None = Field(default=None, ge=0)
    probable_schedule: str | None = None
    tile_holdback_percent: float | None = Field(default=None, ge=0)
    warranty_years: int | None = Field(default=None, ge=0)


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


def iso_date(value):

    if not value:
        return None

    return value.isoformat()


def build_address(row):

    return ", ".join(
        [
            value
            for value in (
                row.address_line1,
                row.address_line2,
                row.city,
                row.province,
                row.postal_code
            )
            if value
        ]
    )


def estimate_summary(
    db,
    estimate_id: int
):

    estimate_row = db.execute(
        text(
            """
            SELECT
                e.id,
                e.revision_number,
                e.estimate_type,
                e.used_hourly_rate,
                e.global_profit_percent,
                e.description,
                e.created_at,
                p.id AS project_id,
                p.project_number,
                p.project_name,
                p.address_line1,
                p.address_line2,
                p.city,
                p.province,
                p.postal_code,
                p.probable_schedule,
                p.tile_holdback_percent,
                p.warranty_years,
                (
                    SELECT max(created_at)
                    FROM estimate
                    WHERE project_id = p.id
                ) AS last_revision_at
            FROM estimate e
            JOIN project p
                ON p.id = e.project_id
            WHERE e.id = :estimate_id
            """
        ),
        {
            "estimate_id": estimate_id
        }
    ).fetchone()

    if estimate_row is None:
        return {}

    client_rows = db.execute(
        text(
            """
            SELECT
                c.name,
                ct.name AS client_type
            FROM project_client pc
            JOIN client c
                ON c.id = pc.client_id
            LEFT JOIN client_type ct
                ON ct.id = c.client_type_id
            WHERE pc.project_id = :project_id
            ORDER BY
                ct.name,
                c.name
            """
        ),
        {
            "project_id": estimate_row.project_id
        }
    ).fetchall()

    supplier_rows = db.execute(
        text(
            """
            SELECT
                supplier_names.supplier_name,
                quote_info.expires_on,
                quote_info.quote_reference,
                quote_info.notes
            FROM (
                SELECT DISTINCT
                    s.name AS supplier_name
                FROM estimate_line l
                JOIN product_supplier ps
                    ON ps.product_id = l.product_id
                JOIN supplier s
                    ON s.id = ps.supplier_id
                WHERE l.estimate_id = :estimate_id
                    AND COALESCE(s.active, TRUE) = TRUE
            ) supplier_names
            LEFT JOIN LATERAL (
                SELECT
                    q.expires_on,
                    q.quote_reference,
                    q.notes
                FROM estimate_supplier_quote q
                WHERE q.estimate_id = :estimate_id
                    AND q.active = TRUE
                    AND lower(q.supplier_name) =
                        lower(supplier_names.supplier_name)
                ORDER BY
                    q.expires_on NULLS LAST,
                    q.id
                LIMIT 1
            ) quote_info
                ON TRUE
            ORDER BY
                quote_info.expires_on NULLS LAST,
                supplier_names.supplier_name
            """
        ),
        {
            "estimate_id": estimate_id
        }
    ).fetchall()

    tile_rows = db.execute(
        text(
            """
            SELECT DISTINCT
                p.name,
                p.manufacturer_name,
                p.size_name,
                supplier_info.supplier_product_code
            FROM estimate_line l
            JOIN product p
                ON p.id = l.product_id
            LEFT JOIN product_type pt
                ON pt.id = p.product_type_id
            LEFT JOIN LATERAL (
                SELECT min(ps.supplier_product_code) AS supplier_product_code
                FROM product_supplier ps
                WHERE ps.product_id = p.id
            ) supplier_info
                ON TRUE
            WHERE l.estimate_id = :estimate_id
                AND lower(coalesce(pt.name, '')) = 'tuile'
            ORDER BY p.name
            """
        ),
        {
            "estimate_id": estimate_id
        }
    ).fetchall()

    return {
        "project": {
            "id": estimate_row.project_id,
            "number": estimate_row.project_number,
            "name": estimate_row.project_name,
            "address": build_address(estimate_row)
        },
        "estimate": {
            "id": estimate_row.id,
            "revision_number": estimate_row.revision_number,
            "type": estimate_row.estimate_type,
            "used_hourly_rate": (
                float(estimate_row.used_hourly_rate)
                if estimate_row.used_hourly_rate is not None
                else None
            ),
            "global_profit_percent": (
                float(estimate_row.global_profit_percent)
                if estimate_row.global_profit_percent is not None
                else None
            ),
            "description": estimate_row.description,
            "created_at": iso_date(estimate_row.created_at),
            "last_revision_at": iso_date(estimate_row.last_revision_at)
        },
        "rates": {
            "current": CURRENT_RATE_INFO,
            "used_hourly_rate": (
                float(estimate_row.used_hourly_rate)
                if estimate_row.used_hourly_rate is not None
                else None
            ),
            "global_profit_percent": (
                float(estimate_row.global_profit_percent)
                if estimate_row.global_profit_percent is not None
                else None
            ),
            "probable_schedule": estimate_row.probable_schedule,
            "tile_holdback_percent": (
                float(estimate_row.tile_holdback_percent)
                if estimate_row.tile_holdback_percent is not None
                else None
            ),
            "warranty_years": estimate_row.warranty_years
        },
        "clients": [
            {
                "name": row.name,
                "type": row.client_type
            }
            for row in client_rows
        ],
        "supplier_quotes": [
            {
                "supplier_name": row.supplier_name,
                "expires_on": iso_date(row.expires_on),
                "quote_reference": row.quote_reference,
                "notes": row.notes
            }
            for row in supplier_rows
        ],
        "tile_requests": [
            {
                "name": row.name,
                "manufacturer_name": row.manufacturer_name,
                "size_name": row.size_name,
                "supplier_product_code": row.supplier_product_code
            }
            for row in tile_rows
        ]
    }


@router.get("/estimates/{estimate_id}/matrix")
def get_matrix(estimate_id: int):

    db = SessionLocal()

    normalize_line_order(
        db,
        estimate_id
    )

    db.commit()

    room_rows = db.execute(
        text(
            """
            SELECT
                id,
                phase_name,
                floor_name,
                room_name
            FROM room
            WHERE estimate_id = :estimate_id
            ORDER BY
                NULLIF(phase_name, ''),
                NULLIF(floor_name, ''),
                room_name,
                id
            """
        ),
        {
            "estimate_id": estimate_id
        }
    )

    room_columns = [
        {
            "id": row.id,
            "key": "room_" + str(row.id),
            "phase_name": row.phase_name,
            "floor_name": row.floor_name,
            "room_name": row.room_name
        }
        for row in room_rows
    ]

    rooms = [
        room["key"]
        for room in room_columns
    ]

    rows = db.execute(
        text(
            """
            SELECT

                l.id AS line_id,

                l.sort_order,

                l.surface_type_id,

                p.name AS product_name,

                p.manufacturer_name,

                supplier_info.supplier_names,

                s.name AS surface_name,

                u.name AS unit_name,

                l.grout_color,

                l.loss_percent,

                l.purchase_price,

                l.profit_percent,

                l.installation_cost,

                r.id AS room_id,

                r.phase_name,

                r.floor_name,

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

            LEFT JOIN LATERAL (
                SELECT
                    string_agg(sup.name, ', ' ORDER BY sup.name)
                        AS supplier_names
                FROM product_supplier ps
                JOIN supplier sup
                    ON sup.id = ps.supplier_id
                WHERE ps.product_id = p.id
            ) supplier_info
                ON TRUE

            LEFT JOIN estimate_quantity q
                ON q.estimate_line_id = l.id

            LEFT JOIN room r
                ON r.id = q.room_id
                AND r.estimate_id = l.estimate_id

            WHERE l.estimate_id = :estimate_id

            ORDER BY
                l.sort_order,
                l.id,
                NULLIF(r.phase_name, '') NULLS LAST,
                NULLIF(r.floor_name, '') NULLS LAST,
                r.room_name NULLS LAST,
                r.id NULLS LAST
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

                "line_number": row.sort_order,

                "sort_order": row.sort_order,

                "surface_type_id": row.surface_type_id,

                "product_name": row.product_name,

                "manufacturer_name": row.manufacturer_name,

                "supplier_names": row.supplier_names,

                "surface_name": row.surface_name,

                "unit_name": row.unit_name,

                "grout_color": row.grout_color,

                "loss_percent": float(row.loss_percent),

                "purchase_price": float(row.purchase_price),

                "profit_percent": float(row.profit_percent),

                "installation_cost": float(row.installation_cost),

                "quantities": {}

            }

        if row.room_name is None:
            continue

        room_key = "room_" + str(row.room_id)

        matrix[line_id]["quantities"][room_key] = {

            "id": row.quantity_id,

            "quantity": float(row.quantity)

        }

    summary = estimate_summary(
        db,
        estimate_id
    )

    db.close()

    return {

        "summary": summary,

        "rooms": rooms,

        "room_columns": room_columns,

        "lines": list(matrix.values())

    }


@router.get("/surface-types")
def get_surface_types():

    db = SessionLocal()

    try:
        rows = db.execute(
            text(
                """
                SELECT
                    id,
                    name,
                    category,
                    sort_order,
                    active
                FROM surface_type
                WHERE active = TRUE
                ORDER BY
                    CASE
                        WHEN lower(coalesce(category, '')) LIKE '%plancher%'
                            OR lower(name) LIKE '%plancher%'
                            OR lower(name) LIKE '%plinthe%' THEN 1
                        WHEN lower(coalesce(category, '')) LIKE '%mur%'
                            OR lower(coalesce(category, '')) LIKE '%vertical%'
                            OR lower(name) LIKE '%mur%'
                            OR lower(name) LIKE '%colonne%'
                            OR lower(name) LIKE '%meuble%' THEN 2
                        ELSE 3
                    END,
                    sort_order,
                    name
                """
            )
        ).fetchall()

        return [
            {
                "id": row.id,
                "name": row.name,
                "category": row.category,
                "sort_order": row.sort_order,
                "active": row.active
            }
            for row in rows
        ]

    finally:
        db.close()


@router.put("/estimates/{estimate_id}/matrix-summary")
def update_matrix_summary(
    estimate_id: int,
    update: MatrixSummaryUpdate
):

    db = SessionLocal()

    try:
        estimate_row = db.execute(
            text(
                """
                SELECT project_id
                FROM estimate
                WHERE id = :estimate_id
                """
            ),
            {
                "estimate_id": estimate_id
            }
        ).fetchone()

        if estimate_row is None:
            raise HTTPException(
                status_code=404,
                detail="Estimate not found"
            )

        db.execute(
            text(
                """
                UPDATE estimate
                SET
                    used_hourly_rate = :used_hourly_rate,
                    global_profit_percent = :global_profit_percent
                WHERE id = :estimate_id
                """
            ),
            {
                "estimate_id": estimate_id,
                "used_hourly_rate": update.used_hourly_rate,
                "global_profit_percent": update.global_profit_percent
            }
        )

        db.execute(
            text(
                """
                UPDATE project
                SET
                    probable_schedule = :probable_schedule,
                    tile_holdback_percent = :tile_holdback_percent,
                    warranty_years = :warranty_years
                WHERE id = :project_id
                """
            ),
            {
                "project_id": estimate_row.project_id,
                "probable_schedule": update.probable_schedule,
                "tile_holdback_percent": update.tile_holdback_percent,
                "warranty_years": update.warranty_years
            }
        )

        updated_lines = 0

        if update.global_profit_percent is not None:
            result = db.execute(
                text(
                    """
                    UPDATE estimate_line
                    SET profit_percent = :global_profit_percent
                    WHERE estimate_id = :estimate_id
                        AND COALESCE(profit_forced, FALSE) = FALSE
                    """
                ),
                {
                    "estimate_id": estimate_id,
                    "global_profit_percent": update.global_profit_percent
                }
            )
            updated_lines = result.rowcount

        db.commit()

        return {
            "message": "Matrix summary updated",
            "updated_lines": updated_lines,
            "summary": estimate_summary(
                db,
                estimate_id
            )
        }

    finally:
        db.close()
