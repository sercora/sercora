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
                    p.active
                FROM product p
                LEFT JOIN product_type pt
                    ON pt.id = p.product_type_id
                LEFT JOIN unit u
                    ON u.id = p.default_unit_id
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
                    p.active
                FROM product p
                LEFT JOIN product_type pt
                    ON pt.id = p.product_type_id
                LEFT JOIN unit u
                    ON u.id = p.default_unit_id
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
