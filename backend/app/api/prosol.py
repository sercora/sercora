import json
import os
import re
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import text

from app.api.products import (
    PRODUCT_SELECT_FIELDS,
    product_payload,
    sync_product_supplier
)
from app.database.database import SessionLocal
from app.schemas.product import ProductCreate


load_dotenv()

router = APIRouter()


class ProsolImportRequest(BaseModel):
    prosol_product_id: int
    prosol_uuid: str | None = None


def prosol_config():

    base_url = os.getenv(
        "PROSOL_API_URL",
        "https://shop.api.prosol.ca"
    ).rstrip("/")
    api_token = os.getenv("PROSOL_API_TOKEN")

    if not api_token:
        raise HTTPException(
            status_code=503,
            detail="PROSOL_API_TOKEN is not configured"
        )

    return base_url, api_token


def prosol_headers(
    content_type: bool = False
):

    _, api_token = prosol_config()
    headers = {
        "Accept": "application/json",
        "Authorization": "Bearer " + api_token,
        "Origin": "https://shop.prosol.ca",
        "Referer": "https://shop.prosol.ca/",
        "User-Agent": (
            "Mozilla/5.0 (X11; Linux x86_64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/125.0 Safari/537.36"
        ),
        "X-Requested-With": "XMLHttpRequest"
    }

    if content_type:
        headers["Content-Type"] = "application/json"

    return headers


def prosol_request(
    path: str,
    method: str = "GET",
    data: dict[str, Any] | None = None,
    params: dict[str, Any] | None = None
):

    base_url, _ = prosol_config()
    url = base_url + path

    if params:
        url += "?" + urlencode(params, doseq=True)

    request_data = None

    if data is not None:
        request_data = json.dumps(data).encode("utf-8")

    request = Request(
        url,
        data=request_data,
        headers=prosol_headers(content_type=data is not None),
        method=method
    )

    try:
        with urlopen(request, timeout=25) as response:
            return json.loads(
                response.read().decode("utf-8")
            )

    except HTTPError as error:
        detail = error.read().decode("utf-8") or error.reason
        raise HTTPException(
            status_code=error.code,
            detail=detail
        ) from error

    except URLError as error:
        raise HTTPException(
            status_code=502,
            detail=str(error.reason)
        ) from error


def localized_text(
    value: Any
):

    if isinstance(value, dict):
        return (
            value.get("fr") or
            value.get("en") or
            next(
                (
                    item
                    for item in value.values()
                    if item
                ),
                ""
            )
        )

    if value is None:
        return ""

    return str(value)


def nested_name(
    value: Any
):

    if isinstance(value, dict):
        return localized_text(
            value.get("name") or
            value.get("label") or
            value.get("title") or
            value
        )

    return localized_text(value)


def relation_name(
    product: dict[str, Any],
    *keys: str
):

    for key in keys:
        value = product.get(key)

        if isinstance(value, dict):
            name = nested_name(value)

            if name:
                return name

    return ""


def decimal_value(
    value: Any
):

    if value in (None, ""):
        return None

    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def extract_size(
    product: dict[str, Any],
    name: str
):

    for key in (
        "size",
        "format",
        "dimensions",
        "dimension",
        "variant_name"
    ):
        value = localized_text(product.get(key)).strip()

        if value:
            return value

    match = re.search(
        r"(\d+(?:[.,]\d+)?\s?(?:lb|lbs|kg|g|ml|l|gal|oz|po|in|mm|cm|m)\b"
        r"(?:\s?[xX]\s?\d+(?:[.,]\d+)?\s?(?:po|in|mm|cm|m)\b)*)",
        name,
        re.IGNORECASE
    )

    if match:
        return match.group(1)

    return ""


def rows_from_payload(
    payload: dict[str, Any]
):

    data = payload.get("data")

    if isinstance(data, list):
        return data

    if isinstance(data, dict):
        nested_data = data.get("data")

        if isinstance(nested_data, list):
            return nested_data

    return (
        payload.get("hits") or
        payload.get("rows") or
        []
    )


def fetch_product_detail(
    product_id: int | None = None,
    uuid: str | None = None
):

    if uuid:
        payload = prosol_request(
            "/api/storefront/products",
            params={
                "filter[where_identifier]": uuid,
                "include": (
                    "productManufacturer,productCategory,"
                    "productType,productCollection"
                ),
                "append[]": [
                    "image_url",
                    "short_description",
                    "prosol_sku",
                    "is_clearance"
                ],
                "with_product_groups": 1
            }
        )
        rows = rows_from_payload(payload)

        for row in rows:
            if not isinstance(row, dict):
                continue

            if (
                str(row.get("uuid") or "") == uuid or
                row.get("id") == product_id
            ):
                return row

        if rows and isinstance(rows[0], dict):
            return rows[0]

    return {}


def fetch_product_offers(
    product_id: int
):

    payload = prosol_request(
        f"/api/storefront/products/{product_id}/offers",
        params={
            "include[]": [
                "country",
                "productInventoryItem",
                "productInventoryItem.productInventoryLocation",
                "product"
            ],
            "append[]": [
                "price_decimal",
                "msrp_price_decimal",
                "price_by_measure",
                "price_by_measure_decimal",
                "price_by_measure_presentable",
                "pricing_measure_unit_presentable"
            ]
        }
    )

    rows = rows_from_payload(payload)

    return [
        row
        for row in rows
        if isinstance(row, dict)
    ]


def best_offer(
    offers: list[dict[str, Any]]
):

    priced_offers = [
        offer
        for offer in offers
        if decimal_value(offer.get("price_decimal")) is not None
    ]

    if not priced_offers:
        return {}

    return sorted(
        priced_offers,
        key=lambda offer: (
            offer.get("min_quantity") or
            offer.get("quantity_min") or
            0,
            offer.get("id") or 0
        )
    )[0]


def merge_product_sources(
    product: dict[str, Any],
    detail: dict[str, Any],
    offer: dict[str, Any]
):

    merged = {}
    offer_product = offer.get("product")

    if isinstance(offer_product, dict):
        merged.update(offer_product)

    merged.update(product)

    if detail:
        merged.update(detail)

    return merged


def normalize_product(
    product: dict[str, Any],
    offer: dict[str, Any] | None = None,
    detail: dict[str, Any] | None = None
):

    offer = offer or {}
    detail = detail or {}
    merged = merge_product_sources(
        product,
        detail,
        offer
    )
    name = localized_text(merged.get("name"))
    sku = (
        merged.get("prosol_sku") or
        merged.get("sku") or
        merged.get("manufacturer_sku") or
        ""
    )
    category = (
        relation_name(
            merged,
            "productCategory",
            "product_category",
            "category"
        ) or
        localized_text(merged.get("category_name"))
    )
    manufacturer = relation_name(
        merged,
        "productManufacturer",
        "manufacturer",
        "brand",
        "vendor"
    )

    price = decimal_value(offer.get("price_decimal"))
    msrp = decimal_value(offer.get("msrp_price_decimal"))

    return {
        "id": merged.get("id"),
        "uuid": merged.get("uuid") or "",
        "name": name,
        "sku": merged.get("sku") or "",
        "prosol_sku": merged.get("prosol_sku") or "",
        "supplier_product_code": sku,
        "manufacturer_sku": merged.get("manufacturer_sku") or merged.get("sku") or "",
        "manufacturer_name": manufacturer,
        "collection_name": relation_name(
            merged,
            "productCollection",
            "product_collection",
            "collection"
        ),
        "category_name": category,
        "size_name": extract_size(merged, name),
        "image_url": merged.get("image_url") or "",
        "source_url": (
            "https://shop.prosol.ca/products/" +
            str(merged.get("uuid") or "")
            if merged.get("uuid")
            else ""
        ),
        "default_purchase_price": price,
        "msrp_price": msrp,
        "price_by_measure": offer.get("price_by_measure_presentable") or "",
        "price_unit": offer.get("pricing_measure_unit_presentable") or ""
    }


def enrich_product(
    product: dict[str, Any],
    include_detail: bool = False
):

    product_id = product.get("id")
    uuid = product.get("uuid")
    detail = {}
    offer = {}

    if include_detail:
        detail = fetch_product_detail(
            product_id=product_id,
            uuid=uuid
        )
        product_id = (
            detail.get("id") or
            product_id
        )

    if product_id:
        try:
            offer = best_offer(
                fetch_product_offers(int(product_id))
            )
        except HTTPException:
            offer = {}

    return normalize_product(
        product,
        offer=offer,
        detail=detail
    )


def local_product_type_id(
    db,
    prosol_product: dict[str, Any]
):

    category_text = " ".join(
        [
            prosol_product.get("category_name") or "",
            prosol_product.get("name") or ""
        ]
    ).lower()
    candidates = []

    if any(
        keyword in category_text
        for keyword in (
            "coulis",
            "grout"
        )
    ):
        candidates.append("Coulis")

    if any(
        keyword in category_text
        for keyword in (
            "membrane",
            "ditra",
            "kerdi",
            "chauffage"
        )
    ):
        candidates.append("Membrane")

    if any(
        keyword in category_text
        for keyword in (
            "mortier",
            "ciment-colle",
            "thinset",
            "adhesive",
            "colle"
        )
    ):
        candidates.append("Colle")

    if any(
        keyword in category_text
        for keyword in (
            "autonivel",
            "leveler",
            "nivel"
        )
    ):
        candidates.append("Autonivelant")

    if any(
        keyword in category_text
        for keyword in (
            "moulure",
            "profil",
            "profile",
            "trim"
        )
    ):
        candidates.append("Moulure")

    if any(
        keyword in category_text
        for keyword in (
            "scellant",
            "sealant",
            "silicone"
        )
    ):
        candidates.append("Scellant")

    candidates.append("Colle")

    row = db.execute(
        text(
            """
            SELECT id
            FROM product_type
            WHERE active = TRUE
                AND name = ANY(:names)
            ORDER BY array_position(:names, name)
            LIMIT 1
            """
        ),
        {
            "names": candidates
        }
    ).fetchone()

    if row:
        return row.id

    fallback_row = db.execute(
        text(
            """
            SELECT id
            FROM product_type
            WHERE active = TRUE
            ORDER BY id
            LIMIT 1
            """
        )
    ).fetchone()

    if fallback_row is None:
        raise HTTPException(
            status_code=500,
            detail="No active product type is configured"
        )

    return fallback_row.id


def select_local_product(db, product_id: int):

    return db.execute(
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
        {
            "id": product_id
        }
    ).fetchone()


def upsert_local_product(
    db,
    prosol_product: dict[str, Any]
):

    existing = db.execute(
        text(
            """
            SELECT id
            FROM product
            WHERE prosol_product_id = :prosol_product_id
            """
        ),
        {
            "prosol_product_id": prosol_product["id"]
        }
    ).fetchone()

    values = {
        "product_type_id": local_product_type_id(
            db,
            prosol_product
        ),
        "name": prosol_product["name"],
        "manufacturer_name": prosol_product.get("manufacturer_name") or None,
        "collection_name": prosol_product.get("collection_name") or None,
        "size_name": prosol_product.get("size_name") or None,
        "prosol_product_id": prosol_product["id"],
        "prosol_uuid": prosol_product.get("uuid") or None,
        "prosol_sku": prosol_product.get("prosol_sku") or None,
        "manufacturer_sku": prosol_product.get("manufacturer_sku") or None,
        "category_name": prosol_product.get("category_name") or None,
        "image_url": prosol_product.get("image_url") or None,
        "source_url": prosol_product.get("source_url") or None,
        "default_purchase_price": prosol_product.get("default_purchase_price"),
        "msrp_price": prosol_product.get("msrp_price"),
        "active": True
    }

    if existing:
        values["id"] = existing.id
        db.execute(
            text(
                """
                UPDATE product
                SET
                    product_type_id = :product_type_id,
                    name = :name,
                    manufacturer_name = :manufacturer_name,
                    collection_name = :collection_name,
                    size_name = :size_name,
                    prosol_uuid = :prosol_uuid,
                    prosol_sku = :prosol_sku,
                    manufacturer_sku = :manufacturer_sku,
                    category_name = :category_name,
                    image_url = :image_url,
                    source_url = :source_url,
                    default_purchase_price = :default_purchase_price,
                    msrp_price = :msrp_price,
                    price_updated_at = CURRENT_TIMESTAMP,
                    active = :active
                WHERE id = :id
                """
            ),
            values
        )
        product_id = existing.id

    else:
        product_id = db.execute(
            text(
                """
                INSERT INTO product (
                    product_type_id,
                    name,
                    manufacturer_name,
                    collection_name,
                    size_name,
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
                    :size_name,
                    :prosol_product_id,
                    :prosol_uuid,
                    :prosol_sku,
                    :manufacturer_sku,
                    :category_name,
                    :image_url,
                    :source_url,
                    :default_purchase_price,
                    :msrp_price,
                    CURRENT_TIMESTAMP,
                    :active
                )
                RETURNING id
                """
            ),
            values
        ).fetchone().id

    sync_product_supplier(
        db,
        product_id,
        ProductCreate(
            product_type_id=values["product_type_id"],
            name=values["name"],
            supplier_name="Prosol",
            supplier_product_code=prosol_product.get("supplier_product_code"),
            active=True
        )
    )

    return product_id


@router.get("/prosol/products/search")
def search_prosol_products(
    query: str = Query(..., min_length=3),
    limit: int = Query(20, ge=1, le=50)
):

    payload = prosol_request(
        "/api/storefront/products/search",
        method="POST",
        data={
            "query": query,
            "hitsPerPage": limit
        }
    )

    rows = (
        payload.get("hits") or
        payload.get("data") or
        payload.get("rows") or
        []
    )

    return {
        "total": payload.get("nbHits", len(rows)),
        "rows": [
            enrich_product(row)
            for row in rows
            if isinstance(row, dict)
        ]
    }


@router.post("/prosol/products/import")
def import_prosol_product(
    request: ProsolImportRequest
):

    detail = fetch_product_detail(
        product_id=request.prosol_product_id,
        uuid=request.prosol_uuid
    )
    base_product = {
        "id": request.prosol_product_id,
        "uuid": request.prosol_uuid or ""
    }
    prosol_product = enrich_product(
        detail or base_product,
        include_detail=not bool(detail)
    )

    if not prosol_product.get("name"):
        raise HTTPException(
            status_code=404,
            detail="Prosol product not found"
        )

    db = SessionLocal()

    try:
        product_id = upsert_local_product(
            db,
            prosol_product
        )
        db.commit()
        row = select_local_product(
            db,
            product_id
        )

        return product_payload(row)

    finally:
        db.close()


@router.post("/prosol/products/update-prices")
def update_prosol_prices():

    db = SessionLocal()
    updated = 0
    failed = 0
    errors = []

    try:
        rows = db.execute(
            text(
                """
                SELECT id, prosol_product_id
                FROM product
                WHERE prosol_product_id IS NOT NULL
                    AND active = TRUE
                ORDER BY name
                """
            )
        ).fetchall()

        for row in rows:
            try:
                offer = best_offer(
                    fetch_product_offers(row.prosol_product_id)
                )
                price = decimal_value(offer.get("price_decimal"))
                msrp = decimal_value(offer.get("msrp_price_decimal"))

                if price is None and msrp is None:
                    raise ValueError("No price returned by Prosol")

                db.execute(
                    text(
                        """
                        UPDATE product
                        SET
                            default_purchase_price = :price,
                            msrp_price = :msrp,
                            price_updated_at = CURRENT_TIMESTAMP
                        WHERE id = :id
                        """
                    ),
                    {
                        "id": row.id,
                        "price": price,
                        "msrp": msrp
                    }
                )
                updated += 1

            except Exception as error:
                failed += 1
                errors.append(
                    {
                        "product_id": row.id,
                        "prosol_product_id": row.prosol_product_id,
                        "error": str(error)
                    }
                )

        db.commit()

        return {
            "updated": updated,
            "failed": failed,
            "errors": errors[:10]
        }

    finally:
        db.close()
