import io
import re
import xml.etree.ElementTree as ET
from zipfile import ZipFile

from fastapi import APIRouter, File, HTTPException, UploadFile
from sqlalchemy import text

from app.database.database import SessionLocal
from app.schemas.client import ClientBulkUpdate, ClientSave

router = APIRouter()

XLSX_NS = {
    "s": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
}


def clean_text(
    value
):

    return str(value or "").replace("\u00a0", " ").strip()


def none_if_blank(
    value
):

    cleaned_value = clean_text(value)

    return cleaned_value or None


def ensure_client_schema(
    db
):

    db.execute(
        text(
            """
            ALTER TABLE client
            ADD COLUMN IF NOT EXISTS phone TEXT
            """
        )
    )
    db.execute(
        text(
            """
            ALTER TABLE client
            ADD COLUMN IF NOT EXISTS fax TEXT
            """
        )
    )
    db.execute(
        text(
            """
            ALTER TABLE client
            ADD COLUMN IF NOT EXISTS mobile TEXT
            """
        )
    )
    db.execute(
        text(
            """
            ALTER TABLE client
            ADD COLUMN IF NOT EXISTS billing_address TEXT
            """
        )
    )
    db.execute(
        text(
            """
            ALTER TABLE client
            ADD COLUMN IF NOT EXISTS billing_postal_code VARCHAR(20)
            """
        )
    )
    db.execute(
        text(
            """
            ALTER TABLE client
            ADD COLUMN IF NOT EXISTS rbq VARCHAR(80)
            """
        )
    )
    db.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS client_estimator (
                id BIGSERIAL PRIMARY KEY,
                client_id BIGINT NOT NULL REFERENCES client(id) ON DELETE CASCADE,
                name TEXT NOT NULL,
                cell TEXT,
                email TEXT,
                active BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
    )
    db.execute(
        text(
            """
            CREATE INDEX IF NOT EXISTS idx_client_estimator_client
                ON client_estimator(client_id, active, name)
            """
        )
    )
    db.commit()


def client_estimators_by_client(
    db,
    client_ids: list[int]
):

    if not client_ids:
        return {}

    rows = db.execute(
        text(
            """
            SELECT
                id,
                client_id,
                name,
                cell,
                email,
                active,
                created_at,
                updated_at
            FROM client_estimator
            WHERE client_id = ANY(:client_ids)
            ORDER BY
                COALESCE(active, TRUE) DESC,
                name
            """
        ),
        {
            "client_ids": client_ids
        }
    ).mappings().all()

    grouped_estimators = {
        client_id: []
        for client_id in client_ids
    }

    for row in rows:
        grouped_estimators.setdefault(
            row["client_id"],
            []
        ).append(dict(row))

    return grouped_estimators


def replace_client_estimators(
    db,
    client_id: int,
    client: ClientSave
):

    db.execute(
        text(
            """
            DELETE FROM client_estimator
            WHERE client_id = :client_id
            """
        ),
        {
            "client_id": client_id
        }
    )

    for estimator in client.estimators:
        estimator_name = clean_text(estimator.name)

        if not estimator_name:
            continue

        db.execute(
            text(
                """
                INSERT INTO client_estimator (
                    client_id,
                    name,
                    cell,
                    email,
                    active
                )
                VALUES (
                    :client_id,
                    :name,
                    :cell,
                    :email,
                    :active
                )
                """
            ),
            {
                "client_id": client_id,
                "name": estimator_name,
                "cell": none_if_blank(estimator.cell),
                "email": none_if_blank(estimator.email),
                "active": estimator.active
            }
        )


def column_index(
    cell_reference: str
):

    letters = re.sub(
        r"[^A-Z]",
        "",
        cell_reference.upper()
    )
    value = 0

    for letter in letters:
        value = value * 26 + ord(letter) - ord("A") + 1

    return value - 1


def shared_strings(
    workbook: ZipFile
):

    if "xl/sharedStrings.xml" not in workbook.namelist():
        return []

    root = ET.fromstring(
        workbook.read("xl/sharedStrings.xml")
    )

    return [
        "".join(
            text_node.text or ""
            for text_node in node.findall(".//s:t", XLSX_NS)
        )
        for node in root.findall("s:si", XLSX_NS)
    ]


def cell_value(
    cell,
    strings: list[str]
):

    cell_type = cell.get("t")

    if cell_type == "inlineStr":
        return "".join(
            text_node.text or ""
            for text_node in cell.findall(".//s:t", XLSX_NS)
        )

    value_node = cell.find("s:v", XLSX_NS)

    if value_node is None:
        return ""

    value = value_node.text or ""

    if cell_type == "s" and value:
        return strings[int(value)]

    return value


def xlsx_rows(
    content: bytes
):

    with ZipFile(io.BytesIO(content)) as workbook:
        strings = shared_strings(workbook)
        sheet = ET.fromstring(
            workbook.read("xl/worksheets/sheet1.xml")
        )

        rows = []

        for row in sheet.findall(".//s:sheetData/s:row", XLSX_NS):
            values = []

            for cell in row.findall("s:c", XLSX_NS):
                index = column_index(cell.get("r", "A1"))

                while len(values) <= index:
                    values.append("")

                values[index] = clean_text(
                    cell_value(
                        cell,
                        strings
                    )
                )

            rows.append(values)

        return rows


def header_key(
    value: str
):

    return clean_text(value).lower()


def phone_parts(
    value: str
):

    parts = {
        "phone": None,
        "fax": None,
        "mobile": None
    }
    text_value = clean_text(value)

    for key, label in (
        ("phone", "Phone"),
        ("fax", "Fax"),
        ("mobile", "Mobile")
    ):
        match = re.search(
            rf"{label}:(.*?)(?=Phone:|Fax:|Mobile:|$)",
            text_value,
            flags=re.IGNORECASE
        )

        if match:
            parts[key] = clean_text(match.group(1))

    return parts


def client_rows_from_xlsx(
    content: bytes
):

    rows = xlsx_rows(content)

    if not rows:
        return []

    header_index = next(
        (
            index
            for index, row in enumerate(rows)
            if any(
                "client" in header_key(value)
                for value in row
            )
        ),
        0
    )
    headers = [
        header_key(value)
        for value in rows[header_index]
    ]

    def value_for(
        row,
        *candidates
    ):

        for candidate in candidates:
            for index, header in enumerate(headers):
                if candidate in header and index < len(row):
                    return clean_text(row[index])

        return ""

    clients = []

    for row in rows[header_index + 1:]:
        name = value_for(
            row,
            "nom complet",
            "client"
        )

        if not name:
            continue

        phones = phone_parts(
            value_for(
                row,
                "téléphone",
                "telephone",
                "numéros",
                "numeros"
            )
        )
        clients.append(
            {
                "name": name,
                "phone": phones["phone"],
                "fax": phones["fax"],
                "mobile": phones["mobile"],
                "billing_address": none_if_blank(
                    value_for(
                        row,
                        "adresse"
                    )
                ),
                "billing_postal_code": none_if_blank(
                    value_for(
                        row,
                        "code postal"
                    )
                ),
                "rbq": none_if_blank(
                    value_for(
                        row,
                        "rbq"
                    )
                )
            }
        )

    return clients


@router.get("/client-types")
def get_client_types():

    db = SessionLocal()
    ensure_client_schema(db)

    rows = db.execute(
        text(
            """
            SELECT
                id,
                name,
                active
            FROM client_type
            WHERE COALESCE(active, TRUE) = TRUE
            ORDER BY name
            """
        )
    ).mappings().all()

    db.close()

    return [
        dict(row)
        for row in rows
    ]


@router.get("/clients")
def get_clients():

    db = SessionLocal()
    ensure_client_schema(db)

    rows = db.execute(
        text(
            """
            SELECT
                c.id,
                c.name,
                c.client_type_id,
                ct.name AS client_type_name,
                c.phone,
                c.fax,
                c.mobile,
                c.billing_address,
                c.billing_postal_code,
                c.rbq,
                COALESCE(c.active, TRUE) AS active,
                c.created_at,
                COUNT(pc.id) AS project_count
            FROM client c
            LEFT JOIN client_type ct
                ON ct.id = c.client_type_id
            LEFT JOIN project_client pc
                ON pc.client_id = c.id
            GROUP BY
                c.id,
                c.name,
                c.client_type_id,
                ct.name,
                c.phone,
                c.fax,
                c.mobile,
                c.billing_address,
                c.billing_postal_code,
                c.rbq,
                c.active,
                c.created_at
            ORDER BY
                COALESCE(c.active, TRUE) DESC,
                c.name
            """
        )
    ).mappings().all()
    client_ids = [
        row["id"]
        for row in rows
    ]
    estimators = client_estimators_by_client(
        db,
        client_ids
    )

    db.close()

    return [
        {
            **dict(row),
            "estimators": estimators.get(
                row["id"],
                []
            )
        }
        for row in rows
    ]


def validate_client(
    client: ClientSave
):

    client_name = client.name.strip()

    if not client_name:
        raise HTTPException(
            status_code=422,
            detail="Client name is required"
        )

    return client_name


@router.post("/clients")
def create_client(
    client: ClientSave
):

    client_name = validate_client(client)
    db = SessionLocal()
    ensure_client_schema(db)

    row = db.execute(
        text(
            """
            INSERT INTO client (
                name,
                client_type_id,
                phone,
                fax,
                mobile,
                billing_address,
                billing_postal_code,
                rbq,
                active
            )
            VALUES (
                :name,
                :client_type_id,
                :phone,
                :fax,
                :mobile,
                :billing_address,
                :billing_postal_code,
                :rbq,
                :active
            )
            RETURNING id
            """
        ),
        {
            "name": client_name,
            "client_type_id": client.client_type_id,
            "phone": none_if_blank(client.phone),
            "fax": none_if_blank(client.fax),
            "mobile": none_if_blank(client.mobile),
            "billing_address": none_if_blank(client.billing_address),
            "billing_postal_code": none_if_blank(client.billing_postal_code),
            "rbq": none_if_blank(client.rbq),
            "active": client.active
        }
    ).fetchone()
    replace_client_estimators(
        db,
        row.id,
        client
    )

    db.commit()
    db.close()

    return {
        "id": row.id,
        "message": "Client created"
    }


@router.put("/clients/bulk")
def bulk_update_clients(
    client: ClientBulkUpdate
):

    client_ids = sorted(
        set(client.client_ids)
    )

    if not client_ids:
        raise HTTPException(
            status_code=422,
            detail="Client ids are required"
        )

    db = SessionLocal()
    ensure_client_schema(db)

    existing_rows = db.execute(
        text(
            """
            SELECT id
            FROM client
            WHERE id = ANY(:client_ids)
            """
        ),
        {
            "client_ids": client_ids
        }
    ).mappings().all()

    existing_ids = {
        row["id"]
        for row in existing_rows
    }
    missing_ids = [
        client_id
        for client_id in client_ids
        if client_id not in existing_ids
    ]

    if missing_ids:
        db.close()
        raise HTTPException(
            status_code=404,
            detail="One or more clients were not found"
        )

    provided_values = client.model_dump(
        exclude_unset=True
    )
    provided_values.pop(
        "client_ids",
        None
    )

    updates = {}

    if "name" in provided_values:
        updates["name"] = clean_text(
            provided_values["name"]
        )

        if not updates["name"]:
            db.close()
            raise HTTPException(
                status_code=422,
                detail="Client name is required"
            )

    if "client_type_id" in provided_values:
        updates["client_type_id"] = provided_values["client_type_id"]

    for field_name in (
        "phone",
        "fax",
        "mobile",
        "billing_address",
        "billing_postal_code",
        "rbq"
    ):
        if field_name in provided_values:
            updates[field_name] = none_if_blank(
                provided_values[field_name]
            )

    if "active" in provided_values:
        updates["active"] = provided_values["active"]

    if not updates:
        db.close()
        raise HTTPException(
            status_code=422,
            detail="At least one field is required"
        )

    update_clause = ", ".join(
        f"{field_name} = :{field_name}"
        for field_name in updates
    )

    params = {
        **updates,
        "client_ids": client_ids
    }

    rows = db.execute(
        text(
            f"""
            UPDATE client
            SET {update_clause}
            WHERE id = ANY(:client_ids)
            RETURNING id
            """
        ),
        params
    ).mappings().all()

    db.commit()
    db.close()

    return {
        "message": f"{len(rows)} clients updated",
        "updated": len(rows)
    }


@router.put("/clients/{client_id}")
def update_client(
    client_id: int,
    client: ClientSave
):

    client_name = validate_client(client)
    db = SessionLocal()
    ensure_client_schema(db)

    row = db.execute(
        text(
            """
            UPDATE client
            SET
                name = :name,
                client_type_id = :client_type_id,
                phone = :phone,
                fax = :fax,
                mobile = :mobile,
                billing_address = :billing_address,
                billing_postal_code = :billing_postal_code,
                rbq = :rbq,
                active = :active
            WHERE id = :id
            RETURNING id
            """
        ),
        {
            "id": client_id,
            "name": client_name,
            "client_type_id": client.client_type_id,
            "phone": none_if_blank(client.phone),
            "fax": none_if_blank(client.fax),
            "mobile": none_if_blank(client.mobile),
            "billing_address": none_if_blank(client.billing_address),
            "billing_postal_code": none_if_blank(client.billing_postal_code),
            "rbq": none_if_blank(client.rbq),
            "active": client.active
        }
    ).fetchone()

    if row is None:
        db.close()
        raise HTTPException(
            status_code=404,
            detail="Client not found"
        )

    replace_client_estimators(
        db,
        client_id,
        client
    )
    db.commit()
    db.close()

    return {
        "id": row.id,
        "message": "Client updated"
    }
