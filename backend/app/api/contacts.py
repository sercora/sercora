from fastapi import APIRouter, HTTPException
from sqlalchemy import text

from app.database.database import SessionLocal
from app.schemas.contact import ContactSave, SupplierSave


router = APIRouter()


CONTACT_TYPES = (
    ("client", "Clients"),
    ("supplier", "Fournisseurs")
)


CONTACT_TASKS = (
    ("payables", "Payables", 10),
    ("commande", "Commande", 20),
    ("estimation", "Estimation", 30),
    ("direction", "Direction", 40),
    ("projets", "Projets", 50)
)


def clean_text(
    value
):

    return str(value or "").replace("\u00a0", " ").strip()


def none_if_blank(
    value
):

    cleaned_value = clean_text(value)

    return cleaned_value or None


def ensure_contact_schema(
    db
):

    db.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS contact_type (
                id SERIAL PRIMARY KEY,
                code VARCHAR(50) UNIQUE NOT NULL,
                name VARCHAR(100) UNIQUE NOT NULL,
                active BOOLEAN DEFAULT TRUE
            )
            """
        )
    )
    db.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS contact_task (
                id SERIAL PRIMARY KEY,
                code VARCHAR(50) UNIQUE NOT NULL,
                name VARCHAR(100) UNIQUE NOT NULL,
                sort_order INTEGER DEFAULT 0,
                active BOOLEAN DEFAULT TRUE
            )
            """
        )
    )
    db.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS contact (
                id BIGSERIAL PRIMARY KEY,
                contact_type_id INTEGER NOT NULL REFERENCES contact_type(id),
                client_id BIGINT REFERENCES client(id) ON DELETE SET NULL,
                supplier_id BIGINT REFERENCES supplier(id) ON DELETE SET NULL,
                name VARCHAR(255) NOT NULL,
                title VARCHAR(255),
                email VARCHAR(255),
                phone VARCHAR(80),
                mobile VARCHAR(80),
                active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT chk_contact_owner CHECK (
                    (
                        CASE WHEN client_id IS NOT NULL THEN 1 ELSE 0 END
                    ) + (
                        CASE WHEN supplier_id IS NOT NULL THEN 1 ELSE 0 END
                    ) = 1
                )
            )
            """
        )
    )
    db.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS contact_task_link (
                contact_id BIGINT NOT NULL REFERENCES contact(id) ON DELETE CASCADE,
                contact_task_id INTEGER NOT NULL REFERENCES contact_task(id) ON DELETE CASCADE,
                PRIMARY KEY (contact_id, contact_task_id)
            )
            """
        )
    )
    db.execute(
        text(
            """
            CREATE INDEX IF NOT EXISTS idx_contact_type_active_name
                ON contact(contact_type_id, active, name)
            """
        )
    )
    db.execute(
        text(
            """
            CREATE INDEX IF NOT EXISTS idx_contact_client_active_name
                ON contact(client_id, active, name)
            """
        )
    )
    db.execute(
        text(
            """
            CREATE INDEX IF NOT EXISTS idx_contact_supplier_active_name
                ON contact(supplier_id, active, name)
            """
        )
    )
    db.execute(
        text(
            """
            INSERT INTO contact_type (code, name)
            VALUES
                ('client', 'Clients'),
                ('supplier', 'Fournisseurs')
            ON CONFLICT (code) DO NOTHING
            """
        )
    )
    for code, name, sort_order in CONTACT_TASKS:
        db.execute(
            text(
                """
                INSERT INTO contact_task (code, name, sort_order)
                VALUES (:code, :name, :sort_order)
                ON CONFLICT (code) DO NOTHING
                """
            ),
            {
                "code": code,
                "name": name,
                "sort_order": sort_order
            }
        )
    db.commit()


def ensure_supplier_tax_schema(
    db
):

    db.execute(
        text(
            """
            ALTER TABLE supplier
            ADD COLUMN IF NOT EXISTS phone TEXT
            """
        )
    )
    db.execute(
        text(
            """
            ALTER TABLE supplier
            ADD COLUMN IF NOT EXISTS fax TEXT
            """
        )
    )
    db.execute(
        text(
            """
            ALTER TABLE supplier
            ADD COLUMN IF NOT EXISTS mobile TEXT
            """
        )
    )
    db.execute(
        text(
            """
            ALTER TABLE supplier
            ADD COLUMN IF NOT EXISTS billing_address TEXT
            """
        )
    )
    db.execute(
        text(
            """
            ALTER TABLE supplier
            ADD COLUMN IF NOT EXISTS billing_postal_code VARCHAR(20)
            """
        )
    )
    db.execute(
        text(
            """
            ALTER TABLE supplier
            ADD COLUMN IF NOT EXISTS federal_tax_number VARCHAR(80)
            """
        )
    )
    db.execute(
        text(
            """
            ALTER TABLE supplier
            ADD COLUMN IF NOT EXISTS provincial_tax_number VARCHAR(80)
            """
        )
    )
    db.execute(
        text(
            """
            ALTER TABLE supplier
            ADD COLUMN IF NOT EXISTS email TEXT
            """
        )
    )
    db.execute(
        text(
            """
            ALTER TABLE supplier
            ADD COLUMN IF NOT EXISTS contact_name TEXT
            """
        )
    )
    db.execute(
        text(
            """
            ALTER TABLE supplier
            ADD COLUMN IF NOT EXISTS account_number VARCHAR(100)
            """
        )
    )
    db.execute(
        text(
            """
            ALTER TABLE supplier
            ADD COLUMN IF NOT EXISTS website TEXT
            """
        )
    )
    db.execute(
        text(
            """
            ALTER TABLE supplier
            ADD COLUMN IF NOT EXISTS company_name TEXT
            """
        )
    )
    db.execute(
        text(
            """
            ALTER TABLE supplier
            ADD COLUMN IF NOT EXISTS tax_identification_number VARCHAR(100)
            """
        )
    )
    db.commit()


def supplier_payload(row):

    return {
        "id": row.id,
        "name": row.name or "",
        "phone": row.phone or "",
        "fax": row.fax or "",
        "mobile": row.mobile or "",
        "billing_address": row.billing_address or "",
        "billing_postal_code": row.billing_postal_code or "",
        "email": row.email or "",
        "contact_name": row.contact_name or "",
        "account_number": row.account_number or "",
        "website": row.website or "",
        "company_name": row.company_name or "",
        "tax_identification_number": row.tax_identification_number or "",
        "federal_tax_number": row.federal_tax_number or "",
        "provincial_tax_number": row.provincial_tax_number or "",
        "active": row.active
    }


def contact_task_rows_by_contact(
    db,
    contact_ids: list[int]
):

    if not contact_ids:
        return {}

    rows = db.execute(
        text(
            """
            SELECT
                ctl.contact_id,
                ct.id,
                ct.code,
                ct.name,
                ct.sort_order,
                ct.active
            FROM contact_task_link ctl
            JOIN contact_task ct
                ON ct.id = ctl.contact_task_id
            WHERE ctl.contact_id = ANY(:contact_ids)
            ORDER BY
                ctl.contact_id,
                ct.sort_order,
                ct.name
            """
        ),
        {
            "contact_ids": contact_ids
        }
    ).mappings().all()

    tasks_by_contact = {
        contact_id: []
        for contact_id in contact_ids
    }

    for row in rows:
        tasks_by_contact.setdefault(
            row["contact_id"],
            []
        ).append(
            {
                "id": row["id"],
                "code": row["code"],
                "name": row["name"],
                "sort_order": row["sort_order"],
                "active": row["active"]
            }
        )

    return tasks_by_contact


def replace_contact_tasks(
    db,
    contact_id: int,
    task_ids: list[int]
):

    db.execute(
        text(
            """
            DELETE FROM contact_task_link
            WHERE contact_id = :contact_id
            """
        ),
        {
            "contact_id": contact_id
        }
    )

    for task_id in dict.fromkeys(task_ids or []):
        db.execute(
            text(
                """
                INSERT INTO contact_task_link (
                    contact_id,
                    contact_task_id
                )
                VALUES (
                    :contact_id,
                    :contact_task_id
                )
                """
            ),
            {
                "contact_id": contact_id,
                "contact_task_id": task_id
            }
        )


def contact_type_row(
    db,
    contact_type_id: int
):

    return db.execute(
        text(
            """
            SELECT
                id,
                code,
                name
            FROM contact_type
            WHERE id = :contact_type_id
                AND COALESCE(active, TRUE) = TRUE
            """
        ),
        {
            "contact_type_id": contact_type_id
        }
    ).fetchone()


def ensure_client_exists(
    db,
    client_id: int
):

    row = db.execute(
        text(
            """
            SELECT id
            FROM client
            WHERE id = :client_id
            """
        ),
        {
            "client_id": client_id
        }
    ).fetchone()

    return row is not None


def ensure_supplier_exists(
    db,
    supplier_id: int
):

    row = db.execute(
        text(
            """
            SELECT id
            FROM supplier
            WHERE id = :supplier_id
            """
        ),
        {
            "supplier_id": supplier_id
        }
    ).fetchone()

    return row is not None


def validate_contact_input(
    db,
    contact: ContactSave
):

    contact_name = clean_text(contact.name)

    if not contact_name:
        raise HTTPException(
            status_code=422,
            detail="Contact name is required"
        )

    contact_type = contact_type_row(
        db,
        contact.contact_type_id
    )

    if contact_type is None:
        raise HTTPException(
            status_code=422,
            detail="Contact type is invalid"
        )

    if contact_type.code == "client":
        if not contact.client_id:
            raise HTTPException(
                status_code=422,
                detail="Client id is required for client contacts"
            )

        if contact.supplier_id:
            raise HTTPException(
                status_code=422,
                detail="Supplier id must be empty for client contacts"
            )

        if not ensure_client_exists(
            db,
            contact.client_id
        ):
            raise HTTPException(
                status_code=404,
                detail="Client not found"
            )

    elif contact_type.code == "supplier":
        if not contact.supplier_id:
            raise HTTPException(
                status_code=422,
                detail="Supplier id is required for supplier contacts"
            )

        if contact.client_id:
            raise HTTPException(
                status_code=422,
                detail="Client id must be empty for supplier contacts"
            )

        if not ensure_supplier_exists(
            db,
            contact.supplier_id
        ):
            raise HTTPException(
                status_code=404,
                detail="Supplier not found"
            )

    else:
        raise HTTPException(
            status_code=422,
            detail="Unsupported contact type"
        )

    return {
        "name": contact_name,
        "title": none_if_blank(contact.title),
        "email": none_if_blank(contact.email),
        "phone": none_if_blank(contact.phone),
        "mobile": none_if_blank(contact.mobile),
        "contact_type_id": contact.contact_type_id,
        "client_id": contact.client_id,
        "supplier_id": contact.supplier_id,
        "active": contact.active,
        "task_ids": list(dict.fromkeys(contact.task_ids or []))
    }


@router.get("/contact-types")
def get_contact_types():

    db = SessionLocal()
    ensure_contact_schema(db)

    rows = db.execute(
        text(
            """
            SELECT
                id,
                code,
                name,
                active
            FROM contact_type
            WHERE COALESCE(active, TRUE) = TRUE
            ORDER BY id
            """
        )
    ).mappings().all()

    db.close()

    return [
        dict(row)
        for row in rows
    ]


@router.get("/contact-tasks")
def get_contact_tasks():

    db = SessionLocal()
    ensure_contact_schema(db)

    rows = db.execute(
        text(
            """
            SELECT
                id,
                code,
                name,
                sort_order,
                active
            FROM contact_task
            WHERE COALESCE(active, TRUE) = TRUE
            ORDER BY sort_order, name
            """
        )
    ).mappings().all()

    db.close()

    return [
        dict(row)
        for row in rows
    ]


@router.get("/suppliers")
def get_suppliers():

    db = SessionLocal()
    ensure_supplier_tax_schema(db)

    rows = db.execute(
        text(
            """
            SELECT
                id,
                name,
                phone,
                fax,
                mobile,
                billing_address,
                billing_postal_code,
                email,
                contact_name,
                account_number,
                website,
                company_name,
                tax_identification_number,
                federal_tax_number,
                provincial_tax_number,
                COALESCE(active, TRUE) AS active
            FROM supplier
            ORDER BY
                COALESCE(active, TRUE) DESC,
                name
            """
        )
    ).fetchall()

    db.close()

    return [
        supplier_payload(row)
        for row in rows
    ]


@router.put("/suppliers/{supplier_id}")
def update_supplier(
    supplier_id: int,
    supplier: SupplierSave
):

    supplier_name = clean_text(supplier.name)

    if not supplier_name:
        raise HTTPException(
            status_code=422,
            detail="Le nom du fournisseur est requis."
        )

    db = SessionLocal()
    ensure_supplier_tax_schema(db)

    row = db.execute(
        text(
            """
            UPDATE supplier
            SET
                name = :name,
                phone = :phone,
                fax = :fax,
                mobile = :mobile,
                billing_address = :billing_address,
                billing_postal_code = :billing_postal_code,
                email = :email,
                contact_name = :contact_name,
                account_number = :account_number,
                website = :website,
                company_name = :company_name,
                tax_identification_number = :tax_identification_number,
                federal_tax_number = :federal_tax_number,
                provincial_tax_number = :provincial_tax_number,
                active = :active
            WHERE id = :id
            RETURNING
                id,
                name,
                phone,
                fax,
                mobile,
                billing_address,
                billing_postal_code,
                email,
                contact_name,
                account_number,
                website,
                company_name,
                tax_identification_number,
                federal_tax_number,
                provincial_tax_number,
                COALESCE(active, TRUE) AS active
            """
        ),
        {
            "id": supplier_id,
            "name": supplier_name,
            "phone": none_if_blank(supplier.phone),
            "fax": none_if_blank(supplier.fax),
            "mobile": none_if_blank(supplier.mobile),
            "billing_address": none_if_blank(supplier.billing_address),
            "billing_postal_code": none_if_blank(supplier.billing_postal_code),
            "email": none_if_blank(supplier.email),
            "contact_name": none_if_blank(supplier.contact_name),
            "account_number": none_if_blank(supplier.account_number),
            "website": none_if_blank(supplier.website),
            "company_name": none_if_blank(supplier.company_name),
            "tax_identification_number": none_if_blank(supplier.tax_identification_number),
            "federal_tax_number": none_if_blank(supplier.federal_tax_number),
            "provincial_tax_number": none_if_blank(supplier.provincial_tax_number),
            "active": supplier.active
        }
    ).fetchone()

    if row is None:
        db.close()
        raise HTTPException(
            status_code=404,
            detail="Fournisseur introuvable."
        )

    db.commit()
    db.close()

    return supplier_payload(row)


@router.get("/contacts/options")
def get_contact_options():

    db = SessionLocal()
    ensure_contact_schema(db)
    ensure_supplier_tax_schema(db)

    client_rows = db.execute(
        text(
            """
            SELECT
                id,
                name
            FROM client
            WHERE COALESCE(active, TRUE) = TRUE
            ORDER BY name
            """
        )
    ).mappings().all()

    supplier_rows = db.execute(
        text(
            """
            SELECT
                id,
                name
            FROM supplier
            WHERE COALESCE(active, TRUE) = TRUE
            ORDER BY name
            """
        )
    ).mappings().all()

    db.close()

    return {
        "clients": [
            dict(row)
            for row in client_rows
        ],
        "suppliers": [
            dict(row)
            for row in supplier_rows
        ]
    }


@router.get("/contacts")
def get_contacts():

    db = SessionLocal()
    ensure_contact_schema(db)

    rows = db.execute(
        text(
            """
            SELECT
                c.id,
                c.contact_type_id,
                ct.code AS contact_type_code,
                ct.name AS contact_type_name,
                c.client_id,
                cl.name AS client_name,
                c.supplier_id,
                s.name AS supplier_name,
                c.name,
                c.title,
                c.email,
                c.phone,
                c.mobile,
                COALESCE(c.active, TRUE) AS active,
                c.created_at
            FROM contact c
            JOIN contact_type ct
                ON ct.id = c.contact_type_id
            LEFT JOIN client cl
                ON cl.id = c.client_id
            LEFT JOIN supplier s
                ON s.id = c.supplier_id
            ORDER BY
                COALESCE(c.active, TRUE) DESC,
                ct.name,
                COALESCE(cl.name, s.name, ''),
                c.name
            """
        )
    ).mappings().all()
    contact_ids = [
        row["id"]
        for row in rows
    ]
    task_map = contact_task_rows_by_contact(
        db,
        contact_ids
    )

    db.close()

    return [
        {
            **dict(row),
            "tasks": task_map.get(
                row["id"],
                []
            )
        }
        for row in rows
    ]


@router.post("/contacts")
def create_contact(
    contact: ContactSave
):

    db = SessionLocal()
    ensure_contact_schema(db)
    validated = validate_contact_input(
        db,
        contact
    )

    row = db.execute(
        text(
            """
            INSERT INTO contact (
                contact_type_id,
                client_id,
                supplier_id,
                name,
                title,
                email,
                phone,
                mobile,
                active
            )
            VALUES (
                :contact_type_id,
                :client_id,
                :supplier_id,
                :name,
                :title,
                :email,
                :phone,
                :mobile,
                :active
            )
            RETURNING id
            """
        ),
        validated
    ).fetchone()

    replace_contact_tasks(
        db,
        row.id,
        validated["task_ids"]
    )
    db.commit()
    db.close()

    return {
        "id": row.id,
        "message": "Contact created"
    }


@router.put("/contacts/{contact_id}")
def update_contact(
    contact_id: int,
    contact: ContactSave
):

    db = SessionLocal()
    ensure_contact_schema(db)
    validated = validate_contact_input(
        db,
        contact
    )

    row = db.execute(
        text(
            """
            UPDATE contact
            SET
                contact_type_id = :contact_type_id,
                client_id = :client_id,
                supplier_id = :supplier_id,
                name = :name,
                title = :title,
                email = :email,
                phone = :phone,
                mobile = :mobile,
                active = :active
            WHERE id = :id
            RETURNING id
            """
        ),
        {
            **validated,
            "id": contact_id
        }
    ).fetchone()

    if row is None:
        db.close()
        raise HTTPException(
            status_code=404,
            detail="Contact not found"
        )

    replace_contact_tasks(
        db,
        contact_id,
        validated["task_ids"]
    )
    db.commit()
    db.close()

    return {
        "id": row.id,
        "message": "Contact updated"
    }
