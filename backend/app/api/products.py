from fastapi import APIRouter, HTTPException
from sqlalchemy import text

from app.database.database import SessionLocal
from app.schemas.product import ProductCreate

router = APIRouter()


def product_payload(row):

    return {
        "id": row.id,
        "product_type_id": row.product_type_id,
        "product_type_name": row.product_type_name,
        "name": row.name,
        "manufacturer_name": row.manufacturer_name,
        "collection_name": row.collection_name,
        "color_name": row.color_name,
        "finish_name": row.finish_name,
        "size_name": row.size_name,
        "default_unit_id": row.default_unit_id,
        "default_unit_name": row.default_unit_name,
        "default_unit_symbol": row.default_unit_symbol,
        "default_grout_color": row.default_grout_color,
        "supplier_names": row.supplier_names,
        "supplier_product_code": row.supplier_product_code,
        "active": row.active
    }


def product_values(product: ProductCreate):

    return {
        "product_type_id": product.product_type_id,
        "name": product.name,
        "manufacturer_name": product.manufacturer_name,
        "collection_name": product.collection_name,
        "color_name": product.color_name,
        "finish_name": product.finish_name,
        "size_name": product.size_name,
        "default_unit_id": product.default_unit_id,
        "default_grout_color": product.default_grout_color,
        "active": product.active
    }


def sync_product_supplier(
        db,
        product_id: int,
        product: ProductCreate):

    supplier_name = (
        product.supplier_name or ""
    ).strip()
    supplier_product_code = (
        product.supplier_product_code or ""
    ).strip() or None

    db.execute(
        text(
            """
            DELETE FROM product_supplier
            WHERE product_id = :product_id
            """
        ),
        {
            "product_id": product_id
        }
    )

    if not supplier_name:
        return

    supplier_row = db.execute(
        text(
            """
            INSERT INTO supplier (
                supplier_type_id,
                name
            )
            VALUES (
                (
                    SELECT id
                    FROM supplier_type
                    WHERE name = 'Produits de pose'
                    LIMIT 1
                ),
                :name
            )
            ON CONFLICT (name)
            DO UPDATE SET name = EXCLUDED.name
            RETURNING id
            """
        ),
        {
            "name": supplier_name
        }
    ).fetchone()

    db.execute(
        text(
            """
            INSERT INTO product_supplier (
                product_id,
                supplier_id,
                supplier_product_code
            )
            VALUES (
                :product_id,
                :supplier_id,
                :supplier_product_code
            )
            """
        ),
        {
            "product_id": product_id,
            "supplier_id": supplier_row.id,
            "supplier_product_code": supplier_product_code
        }
    )


@router.get("/product-types")
def get_product_types():

    db = SessionLocal()

    try:
        rows = db.execute(
            text(
                """
                SELECT
                    id,
                    name,
                    active
                FROM product_type
                ORDER BY name
                """
            )
        )

        return [
            {
                "id": row.id,
                "name": row.name,
                "active": row.active
            }
            for row in rows
        ]

    finally:
        db.close()


@router.get("/units")
def get_units():

    db = SessionLocal()

    try:
        rows = db.execute(
            text(
                """
                SELECT
                    id,
                    name,
                    symbol
                FROM unit
                ORDER BY name
                """
            )
        )

        return [
            {
                "id": row.id,
                "name": row.name,
                "symbol": row.symbol
            }
            for row in rows
        ]

    finally:
        db.close()


@router.get("/products")
def get_products():

    db = SessionLocal()

    try:
        rows = db.execute(
            text(
                """
                SELECT
                    p.id,
                    p.product_type_id,
                    pt.name AS product_type_name,
                    p.name,
                    p.manufacturer_name,
                    p.collection_name,
                    p.color_name,
                    p.finish_name,
                    p.size_name,
                    p.default_unit_id,
                    u.name AS default_unit_name,
                    u.symbol AS default_unit_symbol,
                    p.default_grout_color,
                    supplier_info.supplier_names,
                    supplier_info.supplier_product_code,
                    p.active
                FROM product p
                LEFT JOIN product_type pt
                    ON pt.id = p.product_type_id
                LEFT JOIN unit u
                    ON u.id = p.default_unit_id
                LEFT JOIN LATERAL (
                    SELECT
                        string_agg(s.name, ', ' ORDER BY s.name)
                            AS supplier_names,
                        min(ps.supplier_product_code)
                            AS supplier_product_code
                    FROM product_supplier ps
                    JOIN supplier s
                        ON s.id = ps.supplier_id
                    WHERE ps.product_id = p.id
                ) supplier_info
                    ON TRUE
                ORDER BY
                    p.active DESC,
                    p.name
                """
            )
        )

        return [
            product_payload(row)
            for row in rows
        ]

    finally:
        db.close()


@router.get("/products/{product_id}")
def get_product(product_id: int):

    db = SessionLocal()

    try:
        row = db.execute(
            text(
                """
                SELECT
                    p.id,
                    p.product_type_id,
                    pt.name AS product_type_name,
                    p.name,
                    p.manufacturer_name,
                    p.collection_name,
                    p.color_name,
                    p.finish_name,
                    p.size_name,
                    p.default_unit_id,
                    u.name AS default_unit_name,
                    u.symbol AS default_unit_symbol,
                    p.default_grout_color,
                    supplier_info.supplier_names,
                    supplier_info.supplier_product_code,
                    p.active
                FROM product p
                LEFT JOIN product_type pt
                    ON pt.id = p.product_type_id
                LEFT JOIN unit u
                    ON u.id = p.default_unit_id
                LEFT JOIN LATERAL (
                    SELECT
                        string_agg(s.name, ', ' ORDER BY s.name)
                            AS supplier_names,
                        min(ps.supplier_product_code)
                            AS supplier_product_code
                    FROM product_supplier ps
                    JOIN supplier s
                        ON s.id = ps.supplier_id
                    WHERE ps.product_id = p.id
                ) supplier_info
                    ON TRUE
                WHERE p.id = :id
                """
            ),
            {"id": product_id}
        ).fetchone()

    finally:
        db.close()

    if row is None:
        raise HTTPException(
            status_code=404,
            detail="Product not found"
        )

    return product_payload(row)


@router.post("/products")
def create_product(product: ProductCreate):

    db = SessionLocal()

    try:
        row = db.execute(
            text(
                """
                INSERT INTO product (
                    product_type_id,
                    name,
                    manufacturer_name,
                    collection_name,
                    color_name,
                    finish_name,
                    size_name,
                    default_unit_id,
                    default_grout_color,
                    active
                )
                VALUES (
                    :product_type_id,
                    :name,
                    :manufacturer_name,
                    :collection_name,
                    :color_name,
                    :finish_name,
                    :size_name,
                    :default_unit_id,
                    :default_grout_color,
                    :active
                )
                RETURNING id
                """
            ),
            product_values(product)
        ).fetchone()

        sync_product_supplier(
            db,
            row.id,
            product
        )

        db.commit()

        return {
            "id": row.id,
            "message": "Product created"
        }

    finally:
        db.close()


@router.put("/products/{product_id}")
def update_product(
        product_id: int,
        product: ProductCreate):

    db = SessionLocal()

    try:
        values = product_values(product)
        values["id"] = product_id

        result = db.execute(
            text(
                """
                UPDATE product
                SET
                    product_type_id = :product_type_id,
                    name = :name,
                    manufacturer_name = :manufacturer_name,
                    collection_name = :collection_name,
                    color_name = :color_name,
                    finish_name = :finish_name,
                    size_name = :size_name,
                    default_unit_id = :default_unit_id,
                    default_grout_color = :default_grout_color,
                    active = :active
                WHERE id = :id
                """
            ),
            values
        )

        sync_product_supplier(
            db,
            product_id,
            product
        )

        db.commit()

    finally:
        db.close()

    if result.rowcount == 0:
        raise HTTPException(
            status_code=404,
            detail="Product not found"
        )

    return {
        "message": "Product updated"
    }


@router.delete("/products/{product_id}")
def delete_product(product_id: int):

    db = SessionLocal()

    try:
        result = db.execute(
            text(
                """
                UPDATE product
                SET active = FALSE
                WHERE id = :id
                """
            ),
            {
                "id": product_id
            }
        )

        db.commit()

    finally:
        db.close()

    if result.rowcount == 0:
        raise HTTPException(
            status_code=404,
            detail="Product not found"
        )

    return {
        "message": "Product disabled"
    }
