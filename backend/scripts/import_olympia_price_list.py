import argparse
import re
import sys
from decimal import Decimal
from pathlib import Path

from pypdf import PdfReader

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.database.database import SessionLocal  # noqa: E402
from scripts.import_prosol_price_list import (  # noqa: E402
    load_supplier_discount_percent,
    upsert_products
)


PRODUCT_PATTERN = re.compile(
    r"^\s*(?P<label>.+?)\s+"
    r"(?P<code>[A-Z0-9]{1,5}(?:[./-][A-Z0-9]+){2,})\s+"
    r"\$(?P<sf_price>\d+(?:\.\d+)?)\s*/\s*pi\.ca\s+"
    r"\$(?P<unit_price>\d+(?:\.\d+)?)\s*/\s*(?P<unit>[^\s]+)",
    re.IGNORECASE
)
SIZE_PATTERN = re.compile(
    r"^\s*\d+(?:\.\d+)?\s+X\s+.+?\bpo\.",
    re.IGNORECASE
)
FINISH_WORDS = (
    "BRILLANT",
    "MAT",
    "POLI",
    "LUSTRÉ",
    "LUSTRE",
    "SATINÉ",
    "SATINE",
    "RECTIFIÉ",
    "RECTIFIE"
)


def clean_text(value):

    return re.sub(
        r"\s+",
        " ",
        str(value or "").strip()
    )


def db_text(value, max_length=255):

    cleaned_value = clean_text(value)

    if len(cleaned_value) <= max_length:
        return cleaned_value

    return cleaned_value[:max_length].rstrip()


def is_ignored_heading(value):

    normalized = clean_text(value)

    return (
        not normalized or
        normalized in ("Zone", "M", "olympiatile.com") or
        normalized.startswith("VARIATION") or
        normalized.startswith("Fini Code") or
        normalized.startswith("Liste de prix") or
        normalized.startswith("LISTE") or
        normalized.startswith("Table des matières") or
        normalized.startswith("Mars 2026")
    )


def split_label(label):

    value = clean_text(label)
    finish = ""

    for word in FINISH_WORDS:
        pattern = re.compile(
            r"\b" + re.escape(word) + r"\b",
            re.IGNORECASE
        )
        match = pattern.search(value)

        if match:
            finish = match.group(0)
            value = clean_text(
                value[:match.start()]
            )
            break

    return {
        "color": value,
        "finish": finish
    }


def extract_rows(path: Path):

    reader = PdfReader(str(path))
    rows = []

    for page_index, page in enumerate(reader.pages):
        if page_index == 0:
            continue

        text = page.extract_text() or ""
        current_category = ""
        current_collection = ""
        current_size = ""
        next_line_is_category = False

        for raw_line in text.splitlines():
            line = clean_text(raw_line)

            if not line:
                continue

            if line == "olympiatile.com":
                next_line_is_category = True
                continue

            if next_line_is_category and not is_ignored_heading(line):
                current_category = line
                next_line_is_category = False
                continue

            if "Produits d’installation" in line:
                return rows

            if SIZE_PATTERN.search(line):
                current_size = re.split(
                    r"\s+(?:Mcx|Boîte|Feuille)/pi\.ca:|\s+Ensemble/bte:",
                    line,
                    maxsplit=1,
                    flags=re.IGNORECASE
                )[0].strip()
                continue

            match = PRODUCT_PATTERN.search(line)

            if match:
                label_parts = split_label(
                    match.group("label")
                )
                rows.append(
                    {
                        "CODE": match.group("code").upper(),
                        "SÉRIE": db_text(current_collection),
                        "COULEUR": db_text(label_parts["color"]),
                        "FINI": db_text(label_parts["finish"]),
                        "FORMAT": db_text(current_size, 100),
                        "CATÉGORIE": db_text(current_category),
                        "PRIX MCX": str(
                            Decimal(match.group("unit_price"))
                        ),
                        "UNITÉ": match.group("unit")
                    }
                )
                continue

            if is_ignored_heading(line):
                continue

            if "$" not in line:
                current_collection = line

    return rows


def import_olympia_price_list(
    path: Path,
    dry_run: bool,
    discount_percent
):

    rows = extract_rows(path)
    db = SessionLocal()

    try:
        if discount_percent is None:
            discount_percent = load_supplier_discount_percent(
                db,
                "Olympia"
            )

        if dry_run:
            db.rollback()
            imported = len(rows)
        else:
            summary = upsert_products(
                db,
                rows,
                "Olympia",
                discount_percent
            )
            imported = summary["updated"] + summary["inserted"]
            print(summary)
            db.commit()

        return {
            "rows": len(rows),
            "imported": imported,
            "failed": 0,
            "discount_percent": (
                float(discount_percent)
                if discount_percent is not None
                else None
            )
        }

    finally:
        db.close()


def main():

    parser = argparse.ArgumentParser()
    parser.add_argument("path")
    parser.add_argument("--discount-percent", type=float)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    result = import_olympia_price_list(
        Path(args.path),
        args.dry_run,
        args.discount_percent
    )
    print(result)


if __name__ == "__main__":
    main()
