import argparse
import re
import sys
import xml.etree.ElementTree as ET
from decimal import Decimal, InvalidOperation
from pathlib import Path
from zipfile import ZipFile

from sqlalchemy import text

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.api.prosol import extract_size, local_product_type_id  # noqa: E402
from app.api.products import sync_product_supplier  # noqa: E402
from app.database.database import SessionLocal  # noqa: E402
from app.schemas.product import ProductCreate  # noqa: E402


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


def existing_product_id(db, code):

    row = db.execute(
        text(
            """
            SELECT p.id
            FROM product p
            JOIN product_supplier ps
                ON ps.product_id = p.id
            JOIN supplier s
                ON s.id = ps.supplier_id
            WHERE s.name = 'Prosol'
                AND upper(ps.supplier_product_code) = :code
            ORDER BY p.id
            LIMIT 1
            """
        ),
        {
            "code": code
        }
    ).fetchone()

    if row:
        return row.id

    row = db.execute(
        text(
            """
            SELECT id
            FROM product
            WHERE upper(manufacturer_sku) = :code
                OR upper(prosol_sku) = :code
            ORDER BY id
            LIMIT 1
            """
        ),
        {
            "code": code
        }
    ).fetchone()

    return row.id if row else None


def product_values(db, row):

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
        "default_unit_id": unit_id_for(
            db,
            row.get("UOM (UNIT OF MEASURE)")
        ),
        "active": True
    }
    product["product_type_id"] = local_product_type_id(
        db,
        {
            "name": product["name"],
            "category_name": product["category_name"] or ""
        }
    )

    return product


def upsert_product(db, row):

    code = normalized_text(row.get("CODE")).upper()
    values = product_values(
        db,
        row
    )
    product_id = existing_product_id(
        db,
        code
    )

    if product_id:
        values["id"] = product_id
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
            values
        )

    else:
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
            values
        ).fetchone().id

    sync_product_supplier(
        db,
        product_id,
        ProductCreate(
            product_type_id=values["product_type_id"],
            name=values["name"],
            supplier_name="Prosol",
            supplier_product_code=code,
            active=True
        )
    )

    return product_id


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
        for row in rows:
            try:
                if not dry_run:
                    upsert_product(
                        db,
                        row
                    )

                imported += 1

            except Exception as error:
                failed += 1
                print(
                    "FAILED",
                    row.get("CODE"),
                    error
                )

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
