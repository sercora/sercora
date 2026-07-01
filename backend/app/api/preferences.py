import json
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import text

from app.api.auth import get_current_user
from app.database.database import SessionLocal


router = APIRouter()


class UserPreferenceSave(BaseModel):
    value: Any


def ensure_user_preference_schema(db):

    db.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS app_user_preference (
                id BIGSERIAL PRIMARY KEY,
                user_id BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
                preference_key VARCHAR(120) NOT NULL,
                preference_value JSONB NOT NULL DEFAULT '{}'::jsonb,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (user_id, preference_key)
            )
            """
        )
    )
    db.execute(
        text(
            """
            CREATE INDEX IF NOT EXISTS idx_app_user_preference_user
                ON app_user_preference(user_id, preference_key)
            """
        )
    )
    db.commit()


@router.get("/user-preferences/{preference_key}")
def get_user_preference(
    preference_key: str,
    user=Depends(get_current_user)
):

    db = SessionLocal()
    ensure_user_preference_schema(db)

    row = db.execute(
        text(
            """
            SELECT preference_value
            FROM app_user_preference
            WHERE user_id = :user_id
                AND preference_key = :preference_key
            """
        ),
        {
            "user_id": user["id"],
            "preference_key": preference_key
        }
    ).fetchone()

    db.close()

    return {
        "key": preference_key,
        "value": row.preference_value if row else None
    }


@router.put("/user-preferences/{preference_key}")
def save_user_preference(
    preference_key: str,
    preference: UserPreferenceSave,
    user=Depends(get_current_user)
):

    db = SessionLocal()
    ensure_user_preference_schema(db)

    db.execute(
        text(
            """
            INSERT INTO app_user_preference (
                user_id,
                preference_key,
                preference_value
            )
            VALUES (
                :user_id,
                :preference_key,
                CAST(:preference_value AS JSONB)
            )
            ON CONFLICT (user_id, preference_key)
            DO UPDATE SET
                preference_value = EXCLUDED.preference_value,
                updated_at = CURRENT_TIMESTAMP
            """
        ),
        {
            "user_id": user["id"],
            "preference_key": preference_key,
            "preference_value": json.dumps(preference.value)
        }
    )
    db.commit()
    db.close()

    return {
        "key": preference_key,
        "value": preference.value
    }
