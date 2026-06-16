import argparse
import re
import sys
import xml.etree.ElementTree as ET
from decimal import Decimal, InvalidOperation
from pathlib import Path
from zipfile import ZipFile

from sqlalchemy import text

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.api.prosol import extract_size  # noqa: E402
from app.database.database import SessionLocal  # noqa: E402


NS = {
    "m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "rel": "http://schemas.openxmlformats.org/package/2006/relationships"
}


def text_of(node):

    if node is None:
        return ""

    return "".join(node.itertext())


def column_index(reference: str):

    letters = re.match(r"([A-Z]+)", reference).group(1)
    index = 0

    for letter in letters:
        index = index * 26 + ord(letter) - ord("A") + 1

    return index - 1


def decimal_value(value):

    cleaned_value = str(value or "").replace(",", ".").strip()

    if not cleaned_value:
        return None

    try:
        return Decimal(cleaned_value)
    except InvalidOperation:
        return None


def normalized_text(value):

    return str(value or "").strip()


def read_shared_strings(workbook):

    if "xl/sharedStrings.xml" not in workbook.namelist():
        return []

    root = ET.fromstring(workbook.read("xl/sharedStrings.xml"))

    return [
        text_of(shared_string)
        for shared_string in root.findall("m:si", NS)
    ]


def cell_value(cell, shared_strings):

    inline = cell.find("m:is", NS)

    if inline is not None:
        return text_of(inline)

    value = cell.find("m:v", NS)

    if value is None:
        return ""

    raw_value = value.text or ""

    if cell.attrib.get("t") == "s":
        try:
            return shared_strings[int(raw_value)]
        except (IndexError, ValueError):
            return raw_value

    return raw_value


def workbook_sheet_path(workbook, sheet_name):

    workbook_root = ET.fromstring(workbook.read("xl/workbook.xml"))
    relationships_root = ET.fromstring(
        workbook.read("xl/_rels/workbook.xml.rels")
    )
    relationships = {
        relationship.attrib["Id"]: relationship.attrib["Target"]
        for relationship
        in relationships_root.findall("rel:Relationship", NS)
    }

    for sheet in workbook_root.findall("m:sheets/m:sheet", NS):
        if sheet.attrib["name"] != sheet_name:
            continue

        relationship_id = sheet.attrib[
            "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"
        ]
        target = relationships[relationship_id]

        if not target.startswith("xl/"):
            target = "xl/" + target

        return target

    raise ValueError(f"Sheet not found: {sheet_name}")


def read_rows(path: Path, sheet_name: str):

    with ZipFile(path) as workbook:
        shared_strings = read_shared_strings(workbook)
        sheet_path = workbook_sheet_path(
            workbook,
            sheet_name
        )
        sheet_root = ET.fromstring(workbook.read(sheet_path))
        rows = []

        for row in sheet_root.findall("m:sheetData/m:row", NS):
            values = []

            for cell in row.findall("m:c", NS):
                index = column_index(cell.attrib["r"])

                while len(values) <= index:
                    values.append("")

                values[index] = cell_value(
                    cell,
                    shared_strings
                )

            if any(normalized_text(value) for value in values):
                rows.append(values)

        return rows


def row_dicts(rows):

    headers = [
        normalized_text(header).upper()
        for header in rows[0]
    ]

    for row in rows[1:]:
        yield {
            headers[index]: normalized_text(value)
            for index, value in enumerate(row)
            if index < len(headers)
        }


def pick_lowest_minimum_quantity(rows):

    products = {}

    for row in rows:
        code = normalized_text(row.get("CODE")).upper()

        if not code:
            continue

        if normalized_text(row.get("DISCONTINUED")).upper() == "YES":
            continue

        minimum_quantity = decimal_value(
            row.get("MINIMUM QUANTITY")
        ) or Decimal("0")
        existing_row = products.get(code)

        if not existing_row:
            products[code] = row
            continue

        existing_minimum_quantity = decimal_value(
            existing_row.get("MINIMUM QUANTITY")
        ) or Decimal("0")

        if minimum_quantity < existing_minimum_quantity:
            products[code] = row

    return products.values()


def unit_id_for(db, uom):

    normalized_uom = normalized_text(uom).lower()
    aliases = {
        "1": "unité",
        "ea": "unité",
        "each": "unité",
        "unit": "unité",
        "lf": "pi lin",
        "linear foot": "pi lin",
        "sf": "pi²",
        "sqft": "pi²",
        "ft2": "pi²",
        "bag": "sac",
        "sac": "sac",
        "gal": "gal",
        "gallon": "gal",
        "l": "l",
        "litre": "l"
    }
    symbol = aliases.get(
        normalized_uom,
        normalized_uom
    )

    row = db.execute(
        text(
            """
            SELECT id
            FROM unit
            WHERE lower(symbol) = :symbol
                OR lower(name) = :symbol
            LIMIT 1
            """
        ),
        {
            "symbol": symbol
        }
    ).fetchone()

    return row.id if row else None


def load_unit_ids(db):

    return {
        row.symbol.lower(): row.id
        for row in db.execute(
            text(
                """
                SELECT id, symbol
                FROM unit
                """
            )
        )
    }


def unit_id_from_map(unit_ids, uom):

    normalized_uom = normalized_text(uom).lower()
    aliases = {
        "1": "unité",
        "ea": "unité",
        "each": "unité",
        "unit": "unité",
        "lf": "pi lin",
        "linear foot": "pi lin",
        "sf": "pi²",
        "sqft": "pi²",
        "ft2": "pi²",
        "bag": "sac",
        "sac": "sac",
        "gal": "gal",
        "gallon": "gal",
        "l": "l",
        "litre": "l"
    }
    symbol = aliases.get(
        normalized_uom,
        normalized_uom
    )

    return unit_ids.get(symbol)


def load_product_type_ids(db):

    return {
        row.name: row.id
        for row in db.execute(
            text(
                """
                SELECT id, name
                FROM product_type
                WHERE active = TRUE
                """
            )
        )
    }


def product_type_id_from_map(
    product_type_ids,
    values
):

    category_text = " ".join(
        [
            values.get("category_name") or "",
            values.get("name") or ""
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
            "underlayment",
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
            "trim",
            "nose",
            "base"
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

    if "tile" in category_text or "tuile" in category_text:
        candidates.append("Tuile")

    candidates.extend(
        [
            "Colle",
            "Tuile"
        ]
    )

    for candidate in candidates:
        if candidate in product_type_ids:
            return product_type_ids[candidate]

    return next(iter(product_type_ids.values()))


def load_existing_product_ids(db):

    product_ids = {}

    for row in db.execute(
        text(
            """
            SELECT upper(ps.supplier_product_code) AS code, p.id
            FROM product p
            JOIN product_supplier ps
                ON ps.product_id = p.id
            JOIN supplier s
                ON s.id = ps.supplier_id
            WHERE s.name = 'Prosol'
            ORDER BY p.id
            """
        )
    ):
        product_ids[row.code] = row.id

    for row in db.execute(
        text(
            """
            SELECT upper(COALESCE(manufacturer_sku, prosol_sku)) AS code, id
            FROM product
            WHERE manufacturer_sku IS NOT NULL
                OR prosol_sku IS NOT NULL
            """
        )
    ):
        product_ids.setdefault(
            row.code,
            row.id
        )

    return product_ids


def product_values(
    row,
    unit_ids,
    product_type_ids
):

    code = normalized_text(row.get("CODE")).upper()
    name = (
        normalized_text(row.get("DESCRIPTION FR")) or
        normalized_text(row.get("DESCRIPTION EN")) or
        code
    )
    product = {
        "name": name,
        "manufacturer_name": normalized_text(row.get("MANUFACTURER")) or None,
        "collection_name": normalized_text(row.get("COLLECTION")) or None,
        "color_name": normalized_text(row.get("COLOR")) or None,
        "size_name": extract_size({}, name) or None,
        "category_name": normalized_text(row.get("CATEGORY")) or None,
        "manufacturer_sku": code,
        "prosol_sku": code,
        "default_purchase_price": decimal_value(row.get("YOUR PRICE")),
        "msrp_price": decimal_value(row.get("LIST PRICE")),
        "default_unit_id": unit_id_from_map(
            unit_ids,
            row.get("UOM (UNIT OF MEASURE)")
        ),
        "active": True
    }
    product["product_type_id"] = product_type_id_from_map(
        product_type_ids,
        product
    )

    return product


def supplier_id(db):

    return db.execute(
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
                'Prosol'
            )
            ON CONFLICT (name)
            DO UPDATE SET name = EXCLUDED.name
            RETURNING id
            """
        )
    ).fetchone().id


def upsert_products(db, rows):

    unit_ids = load_unit_ids(db)
    product_type_ids = load_product_type_ids(db)
    existing_product_ids = load_existing_product_ids(db)
    updates = []
    inserts = []
    product_codes = []

    for index, row in enumerate(rows, start=1):
        code = normalized_text(row.get("CODE")).upper()

        if not code:
            continue

        values = product_values(
            row,
            unit_ids,
            product_type_ids
        )
        product_id = existing_product_ids.get(code)

        if product_id:
            values["id"] = product_id
            updates.append(values)
            product_codes.append(
                {
                    "product_id": product_id,
                    "supplier_product_code": code
                }
            )
        else:
            inserts.append(
                {
                    "code": code,
                    "values": values
                }
            )

        if index % 5000 == 0:
            print(
                f"Prepared {index}/{len(rows)} rows",
                flush=True
            )

    if updates:
        db.execute(
            text(
                """
                UPDATE product
                SET
                    product_type_id = :product_type_id,
                    name = :name,
                    manufacturer_name = :manufacturer_name,
                    collection_name = :collection_name,
                    color_name = :color_name,
                    size_name = :size_name,
                    category_name = :category_name,
                    manufacturer_sku = :manufacturer_sku,
                    prosol_sku = COALESCE(prosol_sku, :prosol_sku),
                    default_unit_id = :default_unit_id,
                    default_purchase_price = :default_purchase_price,
                    msrp_price = :msrp_price,
                    price_updated_at = CURRENT_TIMESTAMP,
                    active = :active
                WHERE id = :id
                """
            ),
            updates
        )
        print(
            f"Updated {len(updates)} existing products",
            flush=True
        )

    for index, insert in enumerate(inserts, start=1):
        product_id = db.execute(
            text(
                """
                INSERT INTO product (
                    product_type_id,
                    name,
                    manufacturer_name,
                    collection_name,
                    color_name,
                    size_name,
                    category_name,
                    manufacturer_sku,
                    prosol_sku,
                    default_unit_id,
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
                    :size_name,
                    :category_name,
                    :manufacturer_sku,
                    :prosol_sku,
                    :default_unit_id,
                    :default_purchase_price,
                    :msrp_price,
                    CURRENT_TIMESTAMP,
                    :active
                )
                RETURNING id
                """
            ),
            insert["values"]
        ).fetchone().id
        product_codes.append(
            {
                "product_id": product_id,
                "supplier_product_code": insert["code"]
            }
        )

        if index % 5000 == 0:
            print(
                f"Inserted {index}/{len(inserts)} new products",
                flush=True
            )

    if product_codes:
        product_ids = [
            item["product_id"]
            for item in product_codes
        ]
        prosol_supplier_id = supplier_id(db)

        db.execute(
            text(
                """
                DELETE FROM product_supplier
                WHERE product_id = ANY(:product_ids)
                """
            ),
            {
                "product_ids": product_ids
            }
        )
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
            [
                {
                    **item,
                    "supplier_id": prosol_supplier_id
                }
                for item in product_codes
            ]
        )

    return {
        "updated": len(updates),
        "inserted": len(inserts),
        "linked": len(product_codes)
    }


def import_price_list(path: Path, sheet_name: str, dry_run: bool):

    rows = list(
        pick_lowest_minimum_quantity(
            row_dicts(
                read_rows(
                    path,
                    sheet_name
                )
            )
        )
    )
    db = SessionLocal()
    imported = 0
    failed = 0

    try:
        if not dry_run:
            summary = upsert_products(
                db,
                rows
            )
            imported = summary["updated"] + summary["inserted"]
            print(summary)
        else:
            imported = len(rows)

        if dry_run:
            db.rollback()
        else:
            db.commit()

        return {
            "rows": len(rows),
            "imported": imported,
            "failed": failed
        }

    finally:
        db.close()


def main():

    parser = argparse.ArgumentParser()
    parser.add_argument("path")
    parser.add_argument("--sheet", default="Worksheet")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    result = import_price_list(
        Path(args.path),
        args.sheet,
        args.dry_run
    )
    print(result)


if __name__ == "__main__":
    main()
