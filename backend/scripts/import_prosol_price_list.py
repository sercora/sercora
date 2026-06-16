import argparse
import re
import sys
import xml.etree.ElementTree as ET
from decimal import Decimal, InvalidOperation
from pathlib import Path
from zipfile import ZipFile

from sqlalchemy import text

sys.path.append(str(Path(__file__).resolve().parents[1]))

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


def row_value(
    row,
    *names
):

    for name in names:
        value = normalized_text(
            row.get(name)
        )

        if value:
            return value

    return ""


def product_code(row):

    return row_value(
        row,
        "CODE",
        "ITEM#",
        "ITEM",
        "SKU"
    ).upper()


def discounted_price(
    list_price,
    discount_percent
):

    if list_price is None:
        return None

    if discount_percent is None:
        return list_price

    multiplier = Decimal("1") - (
        Decimal(str(discount_percent)) / Decimal("100")
    )

    return (list_price * multiplier).quantize(
        Decimal("0.01")
    )


def extract_size_from_name(name):

    match = re.search(
        r"(\d+(?:[.,]\d+)?\s?(?:lb|lbs|kg|g|ml|l|gal|oz|po|in|mm|cm|m)\b"
        r"(?:\s?[xX]\s?\d+(?:[.,]\d+)?\s?(?:po|in|mm|cm|m)\b)*)",
        name,
        re.IGNORECASE
    )

    if match:
        return match.group(1)

    return ""


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


def first_sheet_name(path: Path):

    with ZipFile(path) as workbook:
        workbook_root = ET.fromstring(workbook.read("xl/workbook.xml"))
        sheet = workbook_root.find("m:sheets/m:sheet", NS)

        if sheet is None:
            raise ValueError("Workbook does not contain any sheets")

        return sheet.attrib["name"]


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
        code = product_code(row)

        if not code:
            continue

        discontinued = row_value(
            row,
            "DISCONTINUED",
            "NEW / DISCONTINUED \nNOUVEAU / RETIRÉ"
        ).upper()

        if discontinued in (
            "YES",
            "DISCONTINUED",
            "RETIRÉ",
            "RETIRED"
        ):
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
        "mcx": "unité",
        "ctn": "unité",
        "feuille": "unité",
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
        "mcx": "unité",
        "ctn": "unité",
        "feuille": "unité",
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

    if any(
        keyword in category_text
        for keyword in (
            "tile",
            "tuile",
            "carreau",
            "carreaux",
            "céramique",
            "ceramique",
            "porcelaine"
        )
    ):
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
    return load_existing_product_ids_for_supplier(
        db,
        None
    )


def load_existing_product_ids_for_supplier(
    db,
    supplier_name
):

    product_ids = {}
    supplier_filter = (
        "WHERE s.name = :supplier_name"
        if supplier_name
        else ""
    )
    params = (
        {
            "supplier_name": supplier_name
        }
        if supplier_name
        else {}
    )

    for row in db.execute(
        text(
            f"""
            SELECT upper(ps.supplier_product_code) AS code, p.id
            FROM product p
            JOIN product_supplier ps
                ON ps.product_id = p.id
            JOIN supplier s
                ON s.id = ps.supplier_id
            {supplier_filter}
            ORDER BY p.id
            """
        ),
        params
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
    product_type_ids,
    supplier_name,
    discount_percent
):

    code = product_code(row)
    list_price = decimal_value(
        row_value(
            row,
            "LIST PRICE",
            "PRIX MCX",
            "PRIX PC",
            "RETAIL PRICE \nAPRIL 1, 2026 /\nPRIX DE DÉTAIL \n1 AVRIL 2026\nCAD"
        )
    )
    cost = decimal_value(
        row_value(
            row,
            "YOUR PRICE",
            "PRICE WITH DISCOUNT / PRIX AVEC RABAIS"
        )
    )

    if discount_percent is not None:
        cost = discounted_price(
            list_price,
            discount_percent
        )

    description_name = (
        row_value(
            row,
            "DESCRIPTION FR",
            "DESCRIPTION (FR)",
            "DESCRIPTION"
        ) or
        row_value(
            row,
            "DESCRIPTION EN",
            "DESCRIPTION (EN)"
        )
    )
    series_name = row_value(row, "SÉRIE")
    color_name = row_value(
        row,
        "COLOR",
        "COULEUR"
    )
    size_name = row_value(row, "FORMAT")
    name = description_name or " - ".join(
        value
        for value in (
            series_name,
            color_name,
            size_name
        )
        if value
    ) or code
    product = {
        "name": name,
        "manufacturer_name": row_value(
            row,
            "MANUFACTURER"
        ) or supplier_name,
        "collection_name": row_value(
            row,
            "COLLECTION",
            "SÉRIE",
            "PRODUCT GROUP 2 / \nGROUPE PRODUIT 2"
        ) or None,
        "color_name": color_name or None,
        "size_name": size_name or extract_size_from_name(name) or None,
        "category_name": row_value(
            row,
            "CATEGORY",
            "CATÉGORIE",
            "PRODUCT GROUP 1 / \nGROUPE PRODUIT 1"
        ) or None,
        "manufacturer_sku": code,
        "prosol_sku": (
            code
            if supplier_name == "Prosol"
            else None
        ),
        "default_purchase_price": cost,
        "msrp_price": list_price,
        "default_unit_id": unit_id_from_map(
            unit_ids,
            row_value(
                row,
                "UOM (UNIT OF MEASURE)",
                "UNITÉ"
            )
        ),
        "active": True
    }
    if supplier_name == "Centura" and "Tuile" in product_type_ids:
        product["product_type_id"] = product_type_ids["Tuile"]
    else:
        product["product_type_id"] = product_type_id_from_map(
            product_type_ids,
            product
        )

    return product


def supplier_id(
    db,
    supplier_name
):

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
                :supplier_name
            )
            ON CONFLICT (name)
            DO UPDATE SET name = EXCLUDED.name
            RETURNING id
            """
        ),
        {
            "supplier_name": supplier_name
        }
    ).fetchone().id


def upsert_products(
    db,
    rows,
    supplier_name,
    discount_percent
):

    unit_ids = load_unit_ids(db)
    product_type_ids = load_product_type_ids(db)
    existing_product_ids = load_existing_product_ids_for_supplier(
        db,
        supplier_name
    )
    updates = []
    inserts = []
    product_codes = []

    for index, row in enumerate(rows, start=1):
        code = product_code(row)

        if not code:
            continue

        values = product_values(
            row,
            unit_ids,
            product_type_ids,
            supplier_name,
            discount_percent
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
        product_supplier_id = supplier_id(
            db,
            supplier_name
        )

        db.execute(
            text(
                """
                DELETE FROM product_supplier
                WHERE product_id = ANY(:product_ids)
                    AND supplier_id = :supplier_id
                """
            ),
            {
                "product_ids": product_ids,
                "supplier_id": product_supplier_id
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
                    "supplier_id": product_supplier_id
                }
                for item in product_codes
            ]
        )

    return {
        "updated": len(updates),
        "inserted": len(inserts),
        "linked": len(product_codes)
    }


def import_price_list(
    path: Path,
    sheet_name: str | None,
    dry_run: bool,
    supplier_name: str,
    discount_percent
):

    if sheet_name is None:
        sheet_name = first_sheet_name(path)

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
                rows,
                supplier_name,
                discount_percent
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
    parser.add_argument("--supplier", default="Prosol")
    parser.add_argument("--discount-percent", type=float)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    result = import_price_list(
        Path(args.path),
        args.sheet,
        args.dry_run,
        args.supplier,
        args.discount_percent
    )
    print(result)


if __name__ == "__main__":
    main()
