from pathlib import Path
from tempfile import NamedTemporaryFile

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy import text

from app.database.database import SessionLocal
from app.schemas.product import ProductBulkUpdate, ProductCreate
from scripts.import_olympia_price_list import import_olympia_price_list
from scripts.import_prosol_price_list import import_price_list

router = APIRouter()


KNOWN_TILE_SUPPLIERS = [
    "Centura",
    "Olympia"
]


class SupplierDiscountInput(BaseModel):
    discount_percent: float | None = Field(default=None, ge=0, le=100)
    active: bool = True


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
    COALESCE(document_info.technical_document_count, 0)
        AS technical_document_count,
    document_info.first_technical_document_url,
    document_info.first_technical_document_title,
    p.active
"""


DOCUMENT_INFO_JOIN = """
    LEFT JOIN LATERAL (
        SELECT
            count(*) AS technical_document_count,
            (
                array_agg(
                    pd.url
                    ORDER BY
                        CASE
                            WHEN pd.language = 'FR' THEN 0
                            WHEN pd.language = 'EN' THEN 1
                            ELSE 2
                        END,
                        pd.title,
                        pd.id
                )
            )[1] AS first_technical_document_url,
            (
                array_agg(
                    pd.title
                    ORDER BY
                        CASE
                            WHEN pd.language = 'FR' THEN 0
                            WHEN pd.language = 'EN' THEN 1
                            ELSE 2
                        END,
                        pd.title,
                        pd.id
                )
            )[1] AS first_technical_document_title
        FROM product_document pd
        WHERE pd.product_id = p.id
            AND pd.active = TRUE
            AND pd.document_type = 'TDS'
    ) document_info
        ON TRUE
"""


def decimal_value(value):

    if value is None:
        return None

    return float(value)


def product_document_payload(row):

    return {
        "id": row.id,
        "product_id": row.product_id,
        "source": row.source,
        "source_document_id": row.source_document_id,
        "source_uuid": row.source_uuid,
        "document_type": row.document_type,
        "title": row.title,
        "url": row.url,
        "language": row.language,
        "active": row.active,
        "synced_at": (
            row.synced_at.isoformat()
            if row.synced_at
            else None
        )
    }


def product_coverage_payload(row):

    return {
        "id": row.id,
        "product_id": row.product_id,
        "coverage_type": row.coverage_type,
        "label": row.label,
        "thickness_mm": decimal_value(row.thickness_mm),
        "tile_size_label": row.tile_size_label,
        "coverage_value": decimal_value(row.coverage_value),
        "coverage_unit": row.coverage_unit,
        "sort_order": row.sort_order,
        "active": row.active
    }


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
        "technical_document_count": row.technical_document_count,
        "first_technical_document_url": row.first_technical_document_url,
        "first_technical_document_title": row.first_technical_document_title,
        "active": row.active
    }


def fetch_product_technical_documents(
    db,
    product_id: int
):

    rows = db.execute(
        text(
            """
            SELECT
                id,
                product_id,
                source,
                source_document_id,
                source_uuid,
                document_type,
                title,
                url,
                language,
                active,
                synced_at
            FROM product_document
            WHERE product_id = :product_id
                AND active = TRUE
                AND document_type = 'TDS'
            ORDER BY
                CASE
                    WHEN language = 'FR' THEN 0
                    WHEN language = 'EN' THEN 1
                    ELSE 2
                END,
                title,
                id
            """
        ),
        {
            "product_id": product_id
        }
    ).fetchall()

    return [
        product_document_payload(row)
        for row in rows
    ]


def fetch_product_coverage_options(
    db,
    product_id: int
):

    rows = db.execute(
        text(
            """
            SELECT
                id,
                product_id,
                coverage_type,
                label,
                thickness_mm,
                tile_size_label,
                coverage_value,
                coverage_unit,
                sort_order,
                active
            FROM product_coverage_option
            WHERE product_id = :product_id
                AND active = TRUE
            ORDER BY sort_order, id
            """
        ),
        {
            "product_id": product_id
        }
    ).fetchall()

    return [
        product_coverage_payload(row)
        for row in rows
    ]


def sync_product_coverage_options(
    db,
    product_id: int,
    product: ProductCreate
):

    db.execute(
        text(
            """
            DELETE FROM product_coverage_option
            WHERE product_id = :product_id
            """
        ),
        {
            "product_id": product_id
        }
    )

    for index, coverage_option in enumerate(product.coverage_options):
        if not coverage_option.active:
            continue

        if coverage_option.coverage_type not in (
            "thickness",
            "tile_size"
        ):
            continue

        db.execute(
            text(
                """
                INSERT INTO product_coverage_option (
                    product_id,
                    coverage_type,
                    label,
                    thickness_mm,
                    tile_size_label,
                    coverage_value,
                    coverage_unit,
                    sort_order,
                    active
                )
                VALUES (
                    :product_id,
                    :coverage_type,
                    :label,
                    :thickness_mm,
                    :tile_size_label,
                    :coverage_value,
                    :coverage_unit,
                    :sort_order,
                    :active
                )
                """
            ),
            {
                "product_id": product_id,
                "coverage_type": coverage_option.coverage_type,
                "label": coverage_option.label,
                "thickness_mm": coverage_option.thickness_mm,
                "tile_size_label": coverage_option.tile_size_label,
                "coverage_value": coverage_option.coverage_value,
                "coverage_unit": coverage_option.coverage_unit,
                "sort_order": coverage_option.sort_order or index,
                "active": coverage_option.active
            }
        )


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


def supplier_menu_filter(
    supplier_name: str
):

    return """
        pt.name = 'Tuile'
        AND lower(coalesce(supplier_info.supplier_names, ''))
            LIKE '%""" + supplier_name.lower() + """%'
    """


def supplier_discount_payload(row):

    return {
        "supplier_name": row.supplier_name,
        "discount_percent": decimal_value(row.discount_percent),
        "active": row.active
    }


def supplier_discount_percent(
    db,
    supplier_name: str
):

    row = db.execute(
        text(
            """
            SELECT discount_percent
            FROM supplier_discount
            WHERE supplier_name = :supplier_name
                AND active = TRUE
            """
        ),
        {
            "supplier_name": supplier_name
        }
    ).fetchone()

    return row.discount_percent if row else None


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
        pattern="^(Tous|Mapei|Prosol|Schluter|Tuile|Centura|Olympia)$"
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
            filters.append(supplier_menu_filter("Centura"))
        elif product_menu == "Olympia":
            filters.append(supplier_menu_filter("Olympia"))

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
            """ + DOCUMENT_INFO_JOIN + """
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
                    CASE
                        WHEN :product_menu = 'Mapei'
                            AND COALESCE(document_info.technical_document_count, 0) > 0
                        THEN 0
                        ELSE 1
                    END,
                    p.name
                """ + pagination_clause + """
                """
            ),
            {
                **params,
                "product_menu": product_menu
            }
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

        db = SessionLocal()

        try:
            discount_percent = supplier_discount_percent(
                db,
                "Schluter"
            )

        finally:
            db.close()

        result = import_price_list(
            temp_path,
            None,
            False,
            "Schluter",
            discount_percent
        )

        return {
            **result,
            "supplier": "Schluter"
        }

    finally:
        if temp_path and temp_path.exists():
            temp_path.unlink()


@router.post("/products/centura/price-list")
async def upload_centura_price_list(request: Request):

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

        db = SessionLocal()

        try:
            discount_percent = supplier_discount_percent(
                db,
                "Centura"
            )

        finally:
            db.close()

        result = import_price_list(
            temp_path,
            None,
            False,
            "Centura",
            discount_percent
        )

        return {
            **result,
            "supplier": "Centura"
        }

    finally:
        if temp_path and temp_path.exists():
            temp_path.unlink()


@router.post("/products/olympia/price-list")
async def upload_olympia_price_list(request: Request):

    content = await request.body()

    if not content:
        raise HTTPException(
            status_code=400,
            detail="Price list file is empty"
        )

    temp_path = None

    try:
        with NamedTemporaryFile(
            suffix=".pdf",
            delete=False
        ) as temp_file:
            temp_file.write(content)
            temp_path = Path(temp_file.name)

        db = SessionLocal()

        try:
            discount_percent = supplier_discount_percent(
                db,
                "Olympia"
            )

        finally:
            db.close()

        result = import_olympia_price_list(
            temp_path,
            False,
            discount_percent
        )

        return {
            **result,
            "supplier": "Olympia"
        }

    finally:
        if temp_path and temp_path.exists():
            temp_path.unlink()


@router.get("/supplier-discounts")
def get_supplier_discounts():

    db = SessionLocal()

    try:
        for supplier_name in [
            "Schluter",
            *KNOWN_TILE_SUPPLIERS
        ]:
            db.execute(
                text(
                    """
                    INSERT INTO supplier_discount (
                        supplier_name,
                        discount_percent,
                        active
                    )
                    VALUES (
                        :supplier_name,
                        NULL,
                        TRUE
                    )
                    ON CONFLICT (supplier_name)
                    DO NOTHING
                    """
                ),
                {
                    "supplier_name": supplier_name
                }
            )
        db.commit()

        rows = db.execute(
            text(
                """
                SELECT
                    supplier_name,
                    discount_percent,
                    active
                FROM supplier_discount
                ORDER BY supplier_name
                """
            )
        )

        return [
            supplier_discount_payload(row)
            for row in rows
        ]

    finally:
        db.close()


@router.put("/supplier-discounts/{supplier_name}")
def save_supplier_discount(
    supplier_name: str,
    discount: SupplierDiscountInput
):

    db = SessionLocal()

    try:
        db.execute(
            text(
                """
                INSERT INTO supplier_discount (
                    supplier_name,
                    discount_percent,
                    active,
                    updated_at
                )
                VALUES (
                    :supplier_name,
                    :discount_percent,
                    :active,
                    CURRENT_TIMESTAMP
                )
                ON CONFLICT (supplier_name)
                DO UPDATE SET
                    discount_percent = EXCLUDED.discount_percent,
                    active = EXCLUDED.active,
                    updated_at = CURRENT_TIMESTAMP
                """
            ),
            {
                "supplier_name": supplier_name,
                "discount_percent": discount.discount_percent,
                "active": discount.active
            }
        )
        db.commit()

        return {
            "message": "Supplier discount saved"
        }

    finally:
        db.close()


@router.post("/supplier-discounts/{supplier_name}/apply")
def apply_supplier_discount(
    supplier_name: str
):

    db = SessionLocal()

    try:
        discount_percent = supplier_discount_percent(
            db,
            supplier_name
        )

        if discount_percent is None:
            raise HTTPException(
                status_code=400,
                detail="Supplier discount is not configured"
            )

        result = db.execute(
            text(
                """
                UPDATE product p
                SET
                    default_purchase_price = ROUND(
                        p.msrp_price * (1 - (:discount_percent / 100)),
                        2
                    ),
                    price_updated_at = CURRENT_TIMESTAMP
                FROM product_supplier ps
                JOIN supplier s
                    ON s.id = ps.supplier_id
                WHERE ps.product_id = p.id
                    AND s.name = :supplier_name
                    AND p.msrp_price IS NOT NULL
                """
            ),
            {
                "supplier_name": supplier_name,
                "discount_percent": discount_percent
            }
        )
        db.commit()

        return {
            "supplier": supplier_name,
            "discount_percent": decimal_value(discount_percent),
            "updated": result.rowcount
        }

    finally:
        db.close()


@router.put("/products/bulk")
def update_products_bulk(
    update: ProductBulkUpdate
):

    product_ids = [
        product_id
        for product_id in update.product_ids
        if product_id > 0
    ]

    if not product_ids:
        raise HTTPException(
            status_code=400,
            detail="No products selected"
        )

    allowed_fields = {
        "product_type_id": update.product_type_id,
        "manufacturer_name": update.manufacturer_name,
        "category_name": update.category_name,
        "default_unit_id": update.default_unit_id,
        "default_purchase_price": update.default_purchase_price,
        "msrp_price": update.msrp_price,
        "active": update.active
    }
    assignments = []
    values = {
        "product_ids": product_ids
    }

    for field_name, field_value in allowed_fields.items():
        if field_value is None:
            continue

        assignments.append(
            field_name + " = :" + field_name
        )
        values[field_name] = field_value

    if (
        update.default_purchase_price is not None or
        update.msrp_price is not None
    ):
        assignments.append(
            "price_updated_at = CURRENT_TIMESTAMP"
        )

    db = SessionLocal()

    try:
        updated_count = 0
        if assignments:
            result = db.execute(
                text(
                    """
                    UPDATE product
                    SET """ + ", ".join(assignments) + """
                    WHERE id = ANY(:product_ids)
                    """
                ),
                values
            )
            updated_count = result.rowcount

        if (
            update.supplier_name is not None or
            update.supplier_product_code is not None
        ):
            for product_id in product_ids:
                sync_product_supplier(
                    db,
                    product_id,
                    ProductCreate(
                        product_type_id=update.product_type_id or 1,
                        name="bulk",
                        supplier_name=update.supplier_name,
                        supplier_product_code=update.supplier_product_code,
                        active=True
                    )
                )

            updated_count = max(
                updated_count,
                len(product_ids)
            )

        db.commit()

        return {
            "updated": updated_count
        }

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
                """ + DOCUMENT_INFO_JOIN + """
                WHERE p.id = :id
                """
            ),
            {"id": product_id}
        ).fetchone()

        if row is None:
            raise HTTPException(
                status_code=404,
                detail="Product not found"
            )

        payload = product_payload(row)
        payload["technical_documents"] = fetch_product_technical_documents(
            db,
            product_id
        )
        payload["coverage_options"] = fetch_product_coverage_options(
            db,
            product_id
        )

        return payload

    finally:
        db.close()


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
        sync_product_coverage_options(
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
        sync_product_coverage_options(
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
