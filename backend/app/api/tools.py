import json
import os
import unicodedata
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException, Query


load_dotenv()

router = APIRouter()


TOOL_SCOPE_PATTERN = "^(all|available|deployed)$"
TOOL_SORT_KEYS = {
    "asset_tag",
    "name",
    "model",
    "serial",
    "category",
    "location",
    "status",
    "updated_at"
}


def snipeit_config():

    base_url = os.getenv(
        "SNIPEIT_URL",
        "https://snipe.serco.pro"
    ).rstrip("/")
    api_token = os.getenv("SNIPEIT_API_TOKEN")

    if not api_token:
        raise HTTPException(
            status_code=503,
            detail="SNIPEIT_API_TOKEN is not configured"
        )

    return base_url, api_token


def nested_name(
    value: Any
):

    if isinstance(value, dict):
        return (
            value.get("name") or
            value.get("text") or
            value.get("username") or
            value.get("full_name") or
            ""
        )

    if value is None:
        return ""

    return str(value)


def nested_value(
    value: Any,
    key: str
):

    if isinstance(value, dict):
        return value.get(key) or ""

    return ""


def normalize_asset(
    asset: dict[str, Any]
):

    status_label = asset.get("status_label")
    assigned_to = asset.get("assigned_to")
    model = asset.get("model")

    return {
        "id": asset.get("id"),
        "asset_tag": asset.get("asset_tag") or "",
        "name": asset.get("name") or "",
        "serial": asset.get("serial") or "",
        "model": nested_name(model),
        "model_number": nested_value(model, "model_number"),
        "category": nested_name(asset.get("category")),
        "manufacturer": nested_name(asset.get("manufacturer")),
        "status": nested_name(status_label),
        "status_type": nested_value(status_label, "status_type"),
        "assigned_to": nested_name(assigned_to),
        "location": nested_name(asset.get("location")),
        "last_checkout": nested_value(asset.get("last_checkout"), "formatted"),
        "updated_at": nested_value(asset.get("updated_at"), "formatted")
    }


def normalized_text(
    value: str
):

    return "".join(
        character
        for character in unicodedata.normalize(
            "NFD",
            value or ""
        )
        if unicodedata.category(character) != "Mn"
    ).strip().lower()


def is_warehouse_location(
    location: str
):

    return normalized_text(location) == "entrepot"


def matches_tool_scope(
    asset: dict[str, Any],
    scope: str
):

    if scope == "all":
        return True

    location = asset.get("location") or ""

    if scope == "available":
        return not location or is_warehouse_location(location)

    return bool(location) and not is_warehouse_location(location)


def sort_tools(
    rows: list[dict[str, Any]],
    sort: str,
    order: str
):

    sort_key = sort if sort in TOOL_SORT_KEYS else "asset_tag"
    reverse = order == "desc"

    return sorted(
        rows,
        key=lambda row: normalized_text(
            str(row.get(sort_key) or "")
        ),
        reverse=reverse
    )


def snipeit_get(
    path: str,
    params: dict[str, Any]
):

    base_url, api_token = snipeit_config()
    query = urlencode(
        {
            key: value
            for key, value in params.items()
            if value not in (None, "")
        }
    )
    url = base_url + "/api/v1" + path

    if query:
        url += "?" + query

    request = Request(
        url,
        headers={
            "Accept": "application/json",
            "Authorization": "Bearer " + api_token
        }
    )

    try:
        with urlopen(request, timeout=15) as response:
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


@router.get("/tools")
def get_tools(
    limit: int = Query(100, ge=1, le=10000),
    offset: int = Query(0, ge=0),
    search: str = "",
    sort: str = "asset_tag",
    order: str = "asc",
    scope: str = Query("all", pattern=TOOL_SCOPE_PATTERN)
):

    snipe_limit = (
        10000
        if scope != "all"
        else limit
    )

    snipe_offset = (
        0
        if scope != "all"
        else offset
    )

    payload = snipeit_get(
        "/hardware",
        {
            "limit": snipe_limit,
            "offset": snipe_offset,
            "search": search,
            "sort": sort,
            "order": order
        }
    )

    rows = [
        normalize_asset(row)
        for row in payload.get("rows", [])
    ]

    if scope != "all":
        rows = sort_tools(
            [
                row
                for row in rows
                if matches_tool_scope(
                    row,
                    scope
                )
            ],
            sort,
            order
        )

        return {
            "total": len(rows),
            "rows": rows[offset:offset + limit]
        }

    return {
        "total": payload.get("total", len(rows)),
        "rows": rows
    }
