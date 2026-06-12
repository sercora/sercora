from fastapi import APIRouter, HTTPException
from sqlalchemy import text

from app.database.database import SessionLocal
from app.schemas.product import ProductCreate

router = APIRouter()


@router.get("/products")
def get_products():

    db = SessionLocal()

    rows = db.execute(
        text(
            """
            SELECT
                id,
                name
            FROM product
            ORDER BY name
            """
        )
    )

    products = []

    for row in rows:
        products.append(
            {
                "id": row.id,
                "name": row.name
            }
        )

    db.close()

    return products


@router.get("/products/{product_id}")
def get_product(product_id: int):

    db = SessionLocal()

    row = db.execute(
        text(
            """
            SELECT
                id,
                name,
                product_type_id
            FROM product
            WHERE id = :id
            """
        ),
        {"id": product_id}
    ).fetchone()

    db.close()

    if row is None:
        raise HTTPException(
            status_code=404,
            detail="Product not found"
        )

    return {
        "id": row.id,
        "name": row.name,
        "product_type_id": row.product_type_id
    }


@router.post("/products")
def create_product(product: ProductCreate):

    db = SessionLocal()

    row = db.execute(
        text(
            """
            INSERT INTO product (
                product_type_id,
                name
            )
            VALUES (
                :product_type_id,
                :name
            )
            RETURNING id
            """
        ),
        {
            "product_type_id": product.product_type_id,
            "name": product.name
        }
    ).fetchone()

    db.commit()

    db.close()

    return {
        "id": row.id,
        "message": "Product created"
    }


@router.put("/products/{product_id}")
def update_product(
        product_id: int,
        product: ProductCreate):

    db = SessionLocal()

    result = db.execute(
        text(
            """
            UPDATE product
            SET
                product_type_id = :product_type_id,
                name = :name
            WHERE id = :id
            """
        ),
        {
            "id": product_id,
            "product_type_id": product.product_type_id,
            "name": product.name
        }
    )

    db.commit()

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

    db.close()

    if result.rowcount == 0:
        raise HTTPException(
            status_code=404,
            detail="Product not found"
        )

    return {
        "message": "Product disabled"
    }
