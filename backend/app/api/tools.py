import json
import os
import unicodedata
from html import unescape
from html.parser import HTMLParser
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlparse
from urllib.request import Request, urlopen

from dotenv import load_dotenv
from fastapi import APIRouter, Body, Depends, HTTPException, Query
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy import text

from app.api.auth import require_admin
from app.database.database import SessionLocal


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

LOCATION_SORT_KEYS = {
    "name",
    "address",
    "city",
    "state",
    "country",
    "active",
    "assets_count",
    "updated_at"
}

LOCATION_PAYLOAD_FIELDS = {
    "name",
    "address",
    "address2",
    "city",
    "state",
    "zip",
    "country",
    "parent_id",
    "manager_id",
    "notes"
}

TOOL_PAYLOAD_FIELDS = {
    "asset_tag",
    "name",
    "serial",
    "notes"
}


class SnipeItSettingsInput(BaseModel):
    base_url: str
    username: str | None = None
    api_token: str | None = None
    active: bool = True


class NotesTextParser(HTMLParser):

    def __init__(self):

        super().__init__()
        self.parts: list[str] = []

    def handle_data(
        self,
        data: str
    ):

        self.parts.append(data)

    def handle_starttag(
        self,
        tag: str,
        attrs: list[tuple[str, str | None]]
    ):

        if tag.lower() in {
            "br",
            "p",
            "div",
            "li"
        }:
            self.parts.append("\n")


def snipeit_config():

    db = SessionLocal()

    try:
        ensure_snipeit_settings_table(db)
        row = get_snipeit_settings_row(db)

    finally:
        db.close()

    base_url = (
        row.base_url
        if row is not None and row.active and row.base_url
        else os.getenv(
            "SNIPEIT_URL",
            "https://snipe.serco.pro"
        )
    ).rstrip("/")
    api_token = (
        row.api_token
        if row is not None and row.active and row.api_token
        else os.getenv("SNIPEIT_API_TOKEN")
    )

    if not api_token:
        raise HTTPException(
            status_code=503,
            detail="SNIPEIT_API_TOKEN is not configured"
        )

    return base_url, api_token


def ensure_snipeit_settings_table(
    db
):

    db.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS app_snipeit_settings (
                id SMALLINT PRIMARY KEY DEFAULT 1,
                base_url TEXT NOT NULL,
                username VARCHAR(255),
                api_token TEXT,
                active BOOLEAN DEFAULT TRUE,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT single_snipeit_settings CHECK (id = 1)
            )
            """
        )
    )
    db.commit()


def get_snipeit_settings_row(
    db
):

    ensure_snipeit_settings_table(db)

    return db.execute(
        text(
            """
            SELECT
                base_url,
                username,
                api_token,
                active
            FROM app_snipeit_settings
            WHERE id = 1
            """
        )
    ).fetchone()


def snipeit_settings_payload(
    row
):

    fallback_url = os.getenv(
        "SNIPEIT_URL",
        "https://snipe.serco.pro"
    ).rstrip("/")

    if row is None:
        return {
            "base_url": fallback_url,
            "username": "",
            "active": bool(os.getenv("SNIPEIT_API_TOKEN")),
            "token_configured": bool(os.getenv("SNIPEIT_API_TOKEN")),
            "using_env_fallback": True
        }

    return {
        "base_url": row.base_url or fallback_url,
        "username": row.username or "",
        "active": row.active,
        "token_configured": bool(row.api_token or os.getenv("SNIPEIT_API_TOKEN")),
        "using_env_fallback": not bool(row.api_token)
    }


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


def nested_int(
    value: Any,
    key: str
):

    if not isinstance(value, dict):
        return None

    nested = value.get(key)

    if nested in (None, ""):
        return None

    try:
        return int(nested)
    except (TypeError, ValueError):
        return None


def plain_notes(
    value: Any
):

    if value is None:
        return ""

    parser = NotesTextParser()
    parser.feed(unescape(str(value)))

    return unescape("".join(parser.parts)).strip()


def asset_image_url(
    asset: dict[str, Any]
):

    for key in (
        "image",
        "image_url",
        "thumbnail",
        "avatar"
    ):
        value = asset.get(key)

        if isinstance(value, str) and value.strip():
            return value.strip()

        if isinstance(value, dict):
            nested_url = (
                value.get("url") or
                value.get("image") or
                value.get("image_url") or
                value.get("src") or
                ""
            )

            if nested_url:
                return str(nested_url).strip()

    return ""


def normalize_asset(
    asset: dict[str, Any]
):

    base_url = os.getenv(
        "SNIPEIT_URL",
        "https://snipe.serco.pro"
    ).rstrip("/")
    status_label = asset.get("status_label")
    assigned_to = asset.get("assigned_to")
    model = asset.get("model")
    asset_id = asset.get("id")

    return {
        "id": asset_id,
        "asset_tag": asset.get("asset_tag") or "",
        "name": asset.get("name") or "",
        "serial": asset.get("serial") or "",
        "notes": plain_notes(asset.get("notes")),
        "model": nested_name(model),
        "model_number": nested_value(model, "model_number"),
        "category": nested_name(asset.get("category")),
        "manufacturer": nested_name(asset.get("manufacturer")),
        "status": nested_name(status_label),
        "status_type": nested_value(status_label, "status_type"),
        "image_url": asset_image_url(asset),
        "image_proxy_path": (
            f"/tools/{asset_id}/image"
            if asset_image_url(asset) and asset_id
            else ""
        ),
        "qr_proxy_path": (
            f"/tools/{asset_id}/qr"
            if asset_id
            else ""
        ),
        "asset_url": (
            f"{base_url}/hardware/{asset_id}"
            if asset_id
            else ""
        ),
        "assigned_to": nested_name(assigned_to),
        "location": nested_name(asset.get("location")),
        "last_checkout": nested_value(asset.get("last_checkout"), "formatted"),
        "updated_at": nested_value(asset.get("updated_at"), "formatted")
    }


def normalize_location(
    location: dict[str, Any]
):

    active_value = location.get("active")

    if isinstance(active_value, bool):
        active = active_value
    else:
        active = str(active_value).strip().lower() in {
            "1",
            "true",
            "yes",
            "y"
        }

    return {
        "id": location.get("id"),
        "name": location.get("name") or "",
        "address": location.get("address") or "",
        "address2": location.get("address2") or "",
        "city": location.get("city") or "",
        "state": location.get("state") or "",
        "postal_code": location.get("postal_code") or location.get("zip") or "",
        "country": location.get("country") or "",
        "manager": nested_name(location.get("manager")),
        "parent": nested_name(location.get("parent")),
        "active": active,
        "assets_count": int(location.get("assets_count") or 0),
        "updated_at": nested_value(location.get("updated_at"), "formatted")
    }


def normalize_status_label(
    status_label: dict[str, Any]
):

    status_type = (
        status_label.get("type") or
        status_label.get("status_type") or
        ""
    )

    return {
        "id": status_label.get("id"),
        "name": status_label.get("name") or "",
        "type": status_type,
        "deployable": normalized_text(str(status_type)) == "deployable",
        "pending": normalized_text(str(status_type)) == "pending",
        "archived": normalized_text(str(status_type)) == "archived"
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


def sort_locations(
    rows: list[dict[str, Any]],
    sort: str,
    order: str
):

    sort_key = sort if sort in LOCATION_SORT_KEYS else "name"
    reverse = order == "desc"

    def sort_value(row: dict[str, Any]):
        value = row.get(sort_key)

        if sort_key == "assets_count":
            return int(value or 0)

        if isinstance(value, bool):
            return "1" if value else "0"

        return normalized_text(str(value or ""))

    return sorted(
        rows,
        key=sort_value,
        reverse=reverse
    )


def snipeit_get(
    path: str,
    params: dict[str, Any]
):

    return snipeit_request(
        "GET",
        path,
        params
    )


def snipeit_request(
    method: str,
    path: str,
    params: dict[str, Any] | None = None,
    payload: dict[str, Any] | None = None
):

    base_url, api_token = snipeit_config()

    return snipeit_request_with_config(
        base_url,
        api_token,
        method,
        path,
        params,
        payload
    )


def snipeit_request_with_config(
    base_url: str,
    api_token: str,
    method: str,
    path: str,
    params: dict[str, Any] | None = None,
    payload: dict[str, Any] | None = None
):

    query = urlencode(
        {
            key: value
            for key, value in (params or {}).items()
            if value not in (None, "")
        }
    )
    url = base_url + "/api/v1" + path

    if query:
        url += "?" + query

    request = Request(
        url,
        data=(
            json.dumps(payload).encode("utf-8")
            if payload is not None
            else None
        ),
        headers={
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": "Bearer " + api_token
        },
        method=method
    )

    try:
        with urlopen(request, timeout=15) as response:
            result = json.loads(
                response.read().decode("utf-8")
            )

            if isinstance(result, dict) and result.get("status") == "error":
                raise HTTPException(
                    status_code=422,
                    detail=result.get("messages") or result.get("message") or "Snipe-IT request failed"
                )

            return result

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


def clean_location_payload(
    payload: dict[str, Any]
):

    next_payload = {
        **payload
    }

    if "postal_code" in next_payload and "zip" not in next_payload:
        next_payload["zip"] = next_payload.pop("postal_code")

    cleaned_payload = {
        key: (
            value.strip()
            if isinstance(value, str)
            else value
        )
        for key, value in next_payload.items()
        if key in LOCATION_PAYLOAD_FIELDS
    }

    if not cleaned_payload.get("name"):
        raise HTTPException(
            status_code=422,
            detail="Le nom du chantier est requis."
        )

    return {
        key: value
        for key, value in cleaned_payload.items()
        if value not in ("", None)
    }


def clean_tool_payload(
    payload: dict[str, Any]
):

    cleaned_payload = {
        key: (
            value.strip()
            if isinstance(value, str)
            else value
        )
        for key, value in payload.items()
        if key in TOOL_PAYLOAD_FIELDS
    }

    return {
        key: value
        for key, value in cleaned_payload.items()
        if value is not None
    }


def has_assignment(
    asset: dict[str, Any]
):

    assigned_to = asset.get("assigned_to")

    if isinstance(assigned_to, dict):
        return bool(
            assigned_to.get("id") or
            assigned_to.get("name") or
            assigned_to.get("username") or
            assigned_to.get("full_name")
        )

    return bool(assigned_to)


@router.get("/admin/snipeit-settings")
def get_snipeit_settings(
    _admin=Depends(require_admin)
):

    db = SessionLocal()

    try:
        return snipeit_settings_payload(
            get_snipeit_settings_row(db)
        )

    finally:
        db.close()


@router.put("/admin/snipeit-settings")
def save_snipeit_settings(
    settings: SnipeItSettingsInput,
    _admin=Depends(require_admin)
):

    db = SessionLocal()

    try:
        current = get_snipeit_settings_row(db)
        api_token = (
            settings.api_token
            if settings.api_token
            else (current.api_token if current is not None else None)
        )

        db.execute(
            text(
                """
                INSERT INTO app_snipeit_settings (
                    id,
                    base_url,
                    username,
                    api_token,
                    active,
                    updated_at
                )
                VALUES (
                    1,
                    :base_url,
                    :username,
                    :api_token,
                    :active,
                    CURRENT_TIMESTAMP
                )
                ON CONFLICT (id)
                DO UPDATE SET
                    base_url = EXCLUDED.base_url,
                    username = EXCLUDED.username,
                    api_token = EXCLUDED.api_token,
                    active = EXCLUDED.active,
                    updated_at = CURRENT_TIMESTAMP
                """
            ),
            {
                "base_url": settings.base_url.strip().rstrip("/"),
                "username": (settings.username or "").strip() or None,
                "api_token": api_token,
                "active": settings.active
            }
        )
        db.commit()

        return snipeit_settings_payload(
            get_snipeit_settings_row(db)
        )

    finally:
        db.close()


@router.post("/admin/snipeit-settings/test")
def test_snipeit_settings(
    settings: SnipeItSettingsInput,
    _admin=Depends(require_admin)
):

    db = SessionLocal()

    try:
        current = get_snipeit_settings_row(db)

    finally:
        db.close()

    base_url = settings.base_url.strip().rstrip("/")
    api_token = (
        settings.api_token
        if settings.api_token
        else (
            current.api_token
            if current is not None and current.api_token
            else os.getenv("SNIPEIT_API_TOKEN")
        )
    )

    if not base_url:
        raise HTTPException(
            status_code=422,
            detail="URL Snipe-IT requise."
        )

    if not api_token:
        raise HTTPException(
            status_code=422,
            detail="Token API Snipe-IT requis."
        )

    payload = snipeit_request_with_config(
        base_url,
        api_token,
        "GET",
        "/hardware",
        {
            "limit": 1,
            "offset": 0
        }
    )

    return {
        "message": "Connexion Snipe-IT valide.",
        "base_url": base_url,
        "total_assets": payload.get("total")
    }


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


@router.get("/tools/{tool_id}")
def get_tool(
    tool_id: int
):

    payload = snipeit_get(
        f"/hardware/{tool_id}",
        {}
    )

    return normalize_asset(payload)


@router.put("/tools/{tool_id}")
def update_tool(
    tool_id: int,
    tool: dict[str, Any] = Body(...)
):

    update_payload = clean_tool_payload(tool)
    current_payload = snipeit_get(
        f"/hardware/{tool_id}",
        {}
    )

    model_id = nested_int(
        current_payload.get("model"),
        "id"
    )
    status_id = nested_int(
        current_payload.get("status_label"),
        "id"
    )

    if model_id:
        update_payload["model_id"] = model_id

    if status_id:
        update_payload["status_id"] = status_id

    if not update_payload:
        raise HTTPException(
            status_code=422,
            detail="Aucune modification d'outil valide."
        )

    payload = snipeit_request(
        "PATCH",
        f"/hardware/{tool_id}",
        payload=update_payload
    )

    row = payload.get("payload") if isinstance(payload, dict) else payload

    if isinstance(row, dict):
        return normalize_asset(row)

    refreshed_payload = snipeit_get(
        f"/hardware/{tool_id}",
        {}
    )

    return normalize_asset(refreshed_payload)


@router.post("/tools/{tool_id}/checkout")
def checkout_tool(
    tool_id: int,
    checkout: dict[str, Any] = Body(...)
):

    location_id = checkout.get("location_id")
    status_id = checkout.get("status_id")

    if not location_id:
        raise HTTPException(
            status_code=422,
            detail="Le chantier est requis."
        )

    if not status_id:
        raise HTTPException(
            status_code=422,
            detail="Le statut Snipe-IT est requis."
        )

    note = checkout.get("note") or ""
    current_payload = snipeit_get(
        f"/hardware/{tool_id}",
        {}
    )

    if has_assignment(current_payload):
        snipeit_request(
            "POST",
            f"/hardware/{tool_id}/checkin",
            payload={
                "status_id": int(status_id),
                "note": (
                    "Transfert de chantier via Sercora." +
                    (f" {note}" if note else "")
                )
            }
        )

    snipeit_request(
        "POST",
        f"/hardware/{tool_id}/checkout",
        payload={
            "checkout_to_type": "location",
            "assigned_location": int(location_id),
            "status_id": int(status_id),
            "note": note
        }
    )

    refreshed_payload = snipeit_get(
        f"/hardware/{tool_id}",
        {}
    )

    return normalize_asset(refreshed_payload)


@router.get("/status-labels")
def get_status_labels(
    limit: int = Query(100, ge=1, le=10000),
    offset: int = Query(0, ge=0),
    search: str = ""
):

    payload = snipeit_get(
        "/statuslabels",
        {
            "limit": limit,
            "offset": offset,
            "search": search
        }
    )

    status_rows = payload.get("rows")

    if not isinstance(status_rows, list):
        status_rows = (
            payload.get("data") or
            payload.get("statuslabels") or
            []
        )

    rows = [
        normalize_status_label(row)
        for row in status_rows
        if isinstance(row, dict)
    ]

    return {
        "total": payload.get("total", len(rows)),
        "rows": rows
    }


@router.get("/locations")
def get_locations(
    limit: int = Query(100, ge=1, le=10000),
    offset: int = Query(0, ge=0),
    search: str = "",
    sort: str = "name",
    order: str = "asc",
    min_tools: int | None = Query(None, ge=0),
    max_tools: int | None = Query(None, ge=0)
):

    needs_tool_filter = (
        min_tools is not None or
        max_tools is not None
    )

    snipe_limit = (
        10000
        if needs_tool_filter
        else limit
    )
    snipe_offset = (
        0
        if needs_tool_filter
        else offset
    )

    payload = snipeit_get(
        "/locations",
        {
            "limit": snipe_limit,
            "offset": snipe_offset,
            "search": search,
            "sort": sort,
            "order": order
        }
    )

    location_rows = payload.get("rows")

    if not isinstance(location_rows, list):
        location_rows = (
            payload.get("data") or
            payload.get("locations") or
            []
        )

    rows = [
        normalize_location(row)
        for row in location_rows
        if isinstance(row, dict)
    ]

    if needs_tool_filter:
        rows = [
            row
            for row in rows
            if (
                min_tools is None or
                int(row.get("assets_count") or 0) >= min_tools
            ) and (
                max_tools is None or
                int(row.get("assets_count") or 0) <= max_tools
            )
        ]

        rows = sort_locations(
            rows,
            sort,
            order
        )

        return {
            "total": len(rows),
            "rows": rows[offset:offset + limit]
        }

    return {
        "total": payload.get("total", len(rows)),
        "rows": sort_locations(
            rows,
            sort,
            order
        )
    }


@router.post("/locations")
def create_location(
    location: dict[str, Any] = Body(...)
):

    payload = snipeit_request(
        "POST",
        "/locations",
        payload=clean_location_payload(location)
    )

    row = payload.get("payload") if isinstance(payload, dict) else payload

    if not isinstance(row, dict):
        return payload

    return normalize_location(row)


@router.put("/locations/{location_id}")
def update_location(
    location_id: int,
    location: dict[str, Any] = Body(...)
):

    payload = snipeit_request(
        "PUT",
        f"/locations/{location_id}",
        payload=clean_location_payload(location)
    )

    row = payload.get("payload") if isinstance(payload, dict) else payload

    if isinstance(row, dict):
        return normalize_location(row)

    refreshed_payload = snipeit_get(
        f"/locations/{location_id}",
        {}
    )

    return normalize_location(refreshed_payload)


@router.get("/locations/{location_id}/tools")
def get_location_tools(
    location_id: int,
    limit: int = Query(100, ge=1, le=10000),
    offset: int = Query(0, ge=0),
    search: str = "",
    sort: str = "asset_tag",
    order: str = "asc"
):

    payload = snipeit_get(
        "/hardware",
        {
            "limit": limit,
            "offset": offset,
            "search": search,
            "sort": sort,
            "order": order,
            "location_id": location_id
        }
    )

    rows = [
        normalize_asset(row)
        for row in payload.get("rows", [])
        if isinstance(row, dict)
    ]

    return {
        "total": payload.get("total", len(rows)),
        "rows": rows
    }


@router.get("/tools/{tool_id}/image")
def get_tool_image(
    tool_id: int
):

    base_url, api_token = snipeit_config()
    payload = snipeit_get(
        f"/hardware/{tool_id}",
        {}
    )
    image_url = asset_image_url(payload)

    if not image_url:
        raise HTTPException(
            status_code=404,
            detail="Tool image not found"
        )

    parsed_image_url = urlparse(image_url)
    parsed_base_url = urlparse(base_url)

    if parsed_image_url.netloc != parsed_base_url.netloc:
        raise HTTPException(
            status_code=400,
            detail="Invalid Snipe-IT image host"
        )

    request = Request(
        image_url,
        headers={
            "Accept": "image/*",
            "Authorization": "Bearer " + api_token
        }
    )

    try:
        with urlopen(request, timeout=15) as response:
            content_type = response.headers.get(
                "Content-Type",
                "application/octet-stream"
            )

            if not content_type.lower().startswith("image/"):
                raise HTTPException(
                    status_code=415,
                    detail="Snipe-IT file is not an image"
                )

            return Response(
                content=response.read(),
                media_type=content_type,
                headers={
                    "Cache-Control": "private, max-age=300"
                }
            )

    except HTTPException:
        raise

    except HTTPError as error:
        raise HTTPException(
            status_code=error.code,
            detail=error.reason
        ) from error

    except URLError as error:
        raise HTTPException(
            status_code=502,
            detail=str(error.reason)
        ) from error


@router.get("/tools/{tool_id}/qr")
def get_tool_qr(
    tool_id: int
):

    base_url, api_token = snipeit_config()
    request = Request(
        f"{base_url}/hardware/{tool_id}/qr_code",
        headers={
            "Accept": "image/*",
            "Authorization": "Bearer " + api_token
        }
    )

    try:
        with urlopen(request, timeout=15) as response:
            content_type = response.headers.get(
                "Content-Type",
                "application/octet-stream"
            )

            if not content_type.lower().startswith("image/"):
                raise HTTPException(
                    status_code=415,
                    detail="Snipe-IT QR response is not an image"
                )

            return Response(
                content=response.read(),
                media_type=content_type,
                headers={
                    "Cache-Control": "private, max-age=300"
                }
            )

    except HTTPException:
        raise

    except HTTPError as error:
        raise HTTPException(
            status_code=error.code,
            detail=error.reason
        ) from error

    except URLError as error:
        raise HTTPException(
            status_code=502,
            detail=str(error.reason)
        ) from error
