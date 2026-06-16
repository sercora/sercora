from fastapi import APIRouter, HTTPException
from sqlalchemy import text

from app.database.database import SessionLocal
from app.schemas.client import ClientSave

router = APIRouter()


@router.get("/client-types")
def get_client_types():

    db = SessionLocal()

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

    rows = db.execute(
        text(
            """
            SELECT
                c.id,
                c.name,
                c.client_type_id,
                ct.name AS client_type_name,
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
                c.active,
                c.created_at
            ORDER BY
                COALESCE(c.active, TRUE) DESC,
                c.name
            """
        )
    ).mappings().all()

    db.close()

    return [
        dict(row)
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

    row = db.execute(
        text(
            """
            INSERT INTO client (
                name,
                client_type_id,
                active
            )
            VALUES (
                :name,
                :client_type_id,
                :active
            )
            RETURNING id
            """
        ),
        {
            "name": client_name,
            "client_type_id": client.client_type_id,
            "active": client.active
        }
    ).fetchone()

    db.commit()
    db.close()

    return {
        "id": row.id,
        "message": "Client created"
    }


@router.put("/clients/{client_id}")
def update_client(
    client_id: int,
    client: ClientSave
):

    client_name = validate_client(client)
    db = SessionLocal()

    row = db.execute(
        text(
            """
            UPDATE client
            SET
                name = :name,
                client_type_id = :client_type_id,
                active = :active
            WHERE id = :id
            RETURNING id
            """
        ),
        {
            "id": client_id,
            "name": client_name,
            "client_type_id": client.client_type_id,
            "active": client.active
        }
    ).fetchone()

    if row is None:
        db.close()
        raise HTTPException(
            status_code=404,
            detail="Client not found"
        )

    db.commit()
    db.close()

    return {
        "id": row.id,
        "message": "Client updated"
    }
