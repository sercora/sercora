from fastapi import APIRouter
from sqlalchemy import text

from app.database.database import SessionLocal

router = APIRouter()


@router.get("/products")
def get_products():

    db = SessionLocal()

    rows = db.execute(
        text(
            """
            SELECT id,name
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
