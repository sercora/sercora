from fastapi import APIRouter, HTTPException
from sqlalchemy import text

from app.database.database import SessionLocal
from app.schemas.room import RoomCreate
from app.schemas.room import RoomUpdate

router = APIRouter()


@router.get("/rooms")
def get_rooms():

    db = SessionLocal()

    rows = db.execute(
        text(
            """
            SELECT
                id,
                estimate_id,
                phase_name,
                phase_label,
                floor_name,
                floor_label,
                room_name
            FROM room
            ORDER BY
                phase_name,
                floor_name,
                room_name
            """
        )
    )

    rooms = []

    for row in rows:

        rooms.append(
            {
                "id": row.id,
                "estimate_id": row.estimate_id,
                "phase_name": row.phase_name,
                "phase_label": row.phase_label,
                "floor_name": row.floor_name,
                "floor_label": row.floor_label,
                "room_name": row.room_name
            }
        )

    db.close()

    return rooms


@router.get("/rooms/{room_id}")
def get_room(room_id: int):

    db = SessionLocal()

    row = db.execute(
        text(
            """
            SELECT
                id,
                estimate_id,
                phase_name,
                phase_label,
                floor_name,
                floor_label,
                room_name
            FROM room
            WHERE id=:id
            """
        ),
        {"id": room_id}
    ).fetchone()

    db.close()

    if row is None:

        raise HTTPException(
            status_code=404,
            detail="Room not found"
        )

    return {
        "id": row.id,
        "estimate_id": row.estimate_id,
        "phase_name": row.phase_name,
        "phase_label": row.phase_label,
        "floor_name": row.floor_name,
        "floor_label": row.floor_label,
        "room_name": row.room_name
    }


@router.post("/rooms")
def create_room(room: RoomCreate):

    db = SessionLocal()

    row = db.execute(
        text(
            """
            INSERT INTO room (
                estimate_id,
                phase_name,
                phase_label,
                floor_name,
                floor_label,
                room_name
            )
            VALUES (
                :estimate_id,
                :phase_name,
                :phase_label,
                :floor_name,
                :floor_label,
                :room_name
            )
            RETURNING id
            """
        ),
        {
            "estimate_id": room.estimate_id,
            "phase_name": room.phase_name,
            "phase_label": room.phase_label,
            "floor_name": room.floor_name,
            "floor_label": room.floor_label,
            "room_name": room.room_name
        }
    ).fetchone()

    db.execute(
        text(
            """
            INSERT INTO estimate_quantity (
                estimate_line_id,
                room_id,
                quantity
            )
            SELECT
                id,
                :room_id,
                0
            FROM estimate_line
            WHERE estimate_id = :estimate_id
            """
        ),
        {
            "room_id": row.id,
            "estimate_id": room.estimate_id
        }
    )

    db.commit()

    db.close()

    return {
        "id": row.id,
        "message": "Room created"
    }


@router.put("/rooms/{room_id}")
def update_room(
    room_id: int,
    room: RoomUpdate
):

    db = SessionLocal()

    row = db.execute(
        text(
            """
            UPDATE room
            SET
                phase_name = :phase_name,
                phase_label = :phase_label,
                floor_name = :floor_name,
                floor_label = :floor_label,
                room_name = :room_name
            WHERE id = :id
            RETURNING id
            """
        ),
        {
            "id": room_id,
            "phase_name": room.phase_name,
            "phase_label": room.phase_label,
            "floor_name": room.floor_name,
            "floor_label": room.floor_label,
            "room_name": room.room_name
        }
    ).fetchone()

    db.commit()

    db.close()

    if row is None:

        raise HTTPException(
            status_code=404,
            detail="Room not found"
        )

    return {
        "id": room_id,
        "message": "Room updated"
    }


@router.delete("/rooms/{room_id}")
def delete_room(room_id: int):

    db = SessionLocal()

    row = db.execute(
        text(
            """
            SELECT id
            FROM room
            WHERE id = :id
            """
        ),
        {
            "id": room_id
        }
    ).fetchone()

    if row is None:

        db.close()

        raise HTTPException(
            status_code=404,
            detail="Room not found"
        )

    db.execute(
        text(
            """
            DELETE FROM estimate_quantity
            WHERE room_id = :id
            """
        ),
        {
            "id": room_id
        }
    )

    db.execute(
        text(
            """
            DELETE FROM room
            WHERE id = :id
            """
        ),
        {
            "id": room_id
        }
    )

    db.commit()

    db.close()

    return {
        "id": room_id,
        "message": "Room deleted"
    }
