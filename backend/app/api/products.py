from pathlib import Path
from tempfile import NamedTemporaryFile

from fastapi import APIRouter, HTTPException, Query, Request
from sqlalchemy import text

from app.database.database import SessionLocal
from app.schemas.product import ProductCreate
from scripts.import_prosol_price_list import import_price_list

router = APIRouter()


PRODUCT_SELECT_FIELDS = """
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
    p.prosol_product_id,
    p.prosol_uuid,
    p.prosol_sku,
    p.manufacturer_sku,
    p.category_name,
    p.image_url,
    p.source_url,
    p.default_purchase_price,
    p.msrp_price,
    p.price_updated_at,
    supplier_info.supplier_names,
    supplier_info.supplier_product_code,
    p.active
"""


def decimal_value(value):

    if value is None:
        return None

    return float(value)


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
        "prosol_product_id": row.prosol_product_id,
        "prosol_uuid": row.prosol_uuid,
        "prosol_sku": row.prosol_sku,
        "manufacturer_sku": row.manufacturer_sku,
        "category_name": row.category_name,
        "image_url": row.image_url,
        "source_url": row.source_url,
        "default_purchase_price": decimal_value(row.default_purchase_price),
        "msrp_price": decimal_value(row.msrp_price),
        "price_updated_at": (
            row.price_updated_at.isoformat()
            if row.price_updated_at
            else None
        ),
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
        "prosol_product_id": product.prosol_product_id,
        "prosol_uuid": product.prosol_uuid,
        "prosol_sku": product.prosol_sku,
        "manufacturer_sku": product.manufacturer_sku,
        "category_name": product.category_name,
        "image_url": product.image_url,
        "source_url": product.source_url,
        "default_purchase_price": product.default_purchase_price,
        "msrp_price": product.msrp_price,
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
def get_products(
    limit: int | None = Query(None, ge=1, le=500),
    offset: int = Query(0, ge=0),
    search: str | None = None,
    supplier: str | None = None,
    status: str = Query("active", pattern="^(active|inactive|all)$"),
    product_menu: str = Query(
        "Tous",
        pattern="^(Tous|Mapei|Prosol|Schluter|Tuile|Centura)$"
    ),
    paged: bool = False
):

    db = SessionLocal()

    try:
        params = {
            "limit": limit,
            "offset": offset,
            "search": f"%{(search or '').strip().lower()}%",
            "supplier": f"%{(supplier or '').strip().lower()}%"
        }
        filters = []

        if status == "active":
            filters.append("p.active = TRUE")
        elif status == "inactive":
            filters.append("p.active = FALSE")

        if search and search.strip():
            filters.append(
                """
                lower(concat_ws(
                    ' ',
                    p.name,
                    pt.name,
                    p.manufacturer_name,
                    p.collection_name,
                    p.color_name,
                    p.size_name,
                    p.category_name,
                    p.manufacturer_sku,
                    p.prosol_sku,
                    supplier_info.supplier_names,
                    supplier_info.supplier_product_code
                )) LIKE :search
                """
            )

        if supplier and supplier.strip():
            filters.append(
                """
                lower(concat_ws(
                    ' ',
                    p.manufacturer_name,
                    supplier_info.supplier_names
                )) LIKE :supplier
                """
            )

        if product_menu == "Prosol":
            filters.append(
                """
                (
                    p.prosol_product_id IS NOT NULL
                    OR lower(coalesce(supplier_info.supplier_names, ''))
                        LIKE '%prosol%'
                )
                """
            )
        elif product_menu == "Mapei":
            filters.append(
                """
                lower(concat_ws(
                    ' ',
                    p.name,
                    p.manufacturer_name,
                    supplier_info.supplier_names
                )) LIKE '%mapei%'
                """
            )
        elif product_menu == "Schluter":
            filters.append(
                """
                lower(concat_ws(
                    ' ',
                    p.name,
                    p.manufacturer_name,
                    supplier_info.supplier_names
                )) LIKE '%schluter%'
                """
            )
        elif product_menu == "Tuile":
            filters.append("pt.name = 'Tuile'")
        elif product_menu == "Centura":
            filters.append(
                """
                pt.name = 'Tuile'
                AND lower(coalesce(supplier_info.supplier_names, ''))
                    LIKE '%centura%'
                """
            )

        where_clause = (
            "WHERE " + " AND ".join(filters)
            if filters
            else ""
        )
        supplier_cte = """
            WITH supplier_info AS (
                SELECT
                    ps.product_id,
                    string_agg(s.name, ', ' ORDER BY s.name)
                        AS supplier_names,
                    min(ps.supplier_product_code)
                        AS supplier_product_code
                FROM product_supplier ps
                JOIN supplier s
                    ON s.id = ps.supplier_id
                GROUP BY ps.product_id
            )
        """
        from_clause = """
            FROM product p
            LEFT JOIN product_type pt
                ON pt.id = p.product_type_id
            LEFT JOIN unit u
                ON u.id = p.default_unit_id
            LEFT JOIN supplier_info
                ON supplier_info.product_id = p.id
        """
        pagination_clause = (
            """
            LIMIT :limit
            OFFSET :offset
            """
            if limit is not None
            else ""
        )

        rows = db.execute(
            text(
                supplier_cte + """
                SELECT
                    """ + PRODUCT_SELECT_FIELDS + """
                """ + from_clause + """
                """ + where_clause + """
                ORDER BY
                    p.active DESC,
                    p.name
                """ + pagination_clause + """
                """
            ),
            params
        )

        products = [
            product_payload(row)
            for row in rows
        ]

        if limit is None and not paged:
            return products

        total = db.execute(
            text(
                supplier_cte + """
                SELECT count(*)
                """ + from_clause + """
                """ + where_clause + """
                """
            ),
            params
        ).scalar()

        return {
            "total": total,
            "rows": products
        }

    finally:
        db.close()


@router.post("/products/schluter/price-list")
async def upload_schluter_price_list(request: Request):

    content = await request.body()

    if not content:
        raise HTTPException(
            status_code=400,
            detail="Price list file is empty"
        )

    temp_path = None

    try:
        with NamedTemporaryFile(
            suffix=".xlsx",
            delete=False
        ) as temp_file:
            temp_file.write(content)
            temp_path = Path(temp_file.name)

        result = import_price_list(
            temp_path,
            None,
            False,
            "Schluter",
            40
        )

        return {
            **result,
            "supplier": "Schluter",
            "discount_percent": 40
        }

    finally:
        if temp_path and temp_path.exists():
            temp_path.unlink()


@router.get("/products/{product_id}")
def get_product(product_id: int):

    db = SessionLocal()

    try:
        row = db.execute(
            text(
                """
                SELECT
                    """ + PRODUCT_SELECT_FIELDS + """
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
                    prosol_product_id,
                    prosol_uuid,
                    prosol_sku,
                    manufacturer_sku,
                    category_name,
                    image_url,
                    source_url,
                    default_purchase_price,
                    msrp_price,
                    price_updated_at,
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
                    :prosol_product_id,
                    :prosol_uuid,
                    :prosol_sku,
                    :manufacturer_sku,
                    :category_name,
                    :image_url,
                    :source_url,
                    :default_purchase_price,
                    :msrp_price,
                    CASE
                        WHEN :default_purchase_price IS NOT NULL
                            OR :msrp_price IS NOT NULL
                        THEN CURRENT_TIMESTAMP
                        ELSE NULL
                    END,
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
                    prosol_product_id = :prosol_product_id,
                    prosol_uuid = :prosol_uuid,
                    prosol_sku = :prosol_sku,
                    manufacturer_sku = :manufacturer_sku,
                    category_name = :category_name,
                    image_url = :image_url,
                    source_url = :source_url,
                    default_purchase_price = :default_purchase_price,
                    msrp_price = :msrp_price,
                    price_updated_at = CASE
                        WHEN :default_purchase_price IS DISTINCT FROM default_purchase_price
                            OR :msrp_price IS DISTINCT FROM msrp_price
                        THEN CURRENT_TIMESTAMP
                        ELSE price_updated_at
                    END,
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
