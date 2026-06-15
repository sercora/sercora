import json
import os
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException, Query


load_dotenv()

router = APIRouter()


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


def normalize_product(
    product: dict[str, Any]
):

    manufacturer = (
        nested_name(product.get("manufacturer")) or
        nested_name(product.get("brand")) or
        nested_name(product.get("vendor"))
    )
    category = (
        nested_name(product.get("category")) or
        nested_name(product.get("product_category"))
    )
    sku = (
        product.get("prosol_sku") or
        product.get("sku") or
        product.get("manufacturer_sku") or
        ""
    )

    return {
        "id": product.get("id"),
        "uuid": product.get("uuid") or "",
        "name": localized_text(product.get("name")),
        "sku": product.get("sku") or "",
        "prosol_sku": product.get("prosol_sku") or "",
        "supplier_product_code": sku,
        "manufacturer_name": manufacturer,
        "collection_name": nested_name(product.get("collection")),
        "category_name": category,
        "size_name": (
            product.get("size") or
            product.get("format") or
            product.get("dimensions") or
            ""
        ),
        "image_url": product.get("image_url") or "",
        "source_url": (
            "https://shop.prosol.ca/products/" +
            str(product.get("uuid") or "")
            if product.get("uuid")
            else ""
        )
    }


def prosol_post(
    path: str,
    data: dict[str, Any]
):

    base_url, api_token = prosol_config()
    request = Request(
        base_url + path,
        data=json.dumps(data).encode("utf-8"),
        headers={
            "Accept": "application/json",
            "Authorization": "Bearer " + api_token,
            "Content-Type": "application/json",
            "Origin": "https://shop.prosol.ca",
            "Referer": "https://shop.prosol.ca/",
            "User-Agent": (
                "Mozilla/5.0 (X11; Linux x86_64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/125.0 Safari/537.36"
            ),
            "X-Requested-With": "XMLHttpRequest"
        },
        method="POST"
    )

    try:
        with urlopen(request, timeout=20) as response:
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


@router.get("/prosol/products/search")
def search_prosol_products(
    query: str = Query(..., min_length=3),
    limit: int = Query(20, ge=1, le=50)
):

    payload = prosol_post(
        "/api/storefront/products/search",
        {
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
            normalize_product(row)
            for row in rows
            if isinstance(row, dict)
        ]
    }
