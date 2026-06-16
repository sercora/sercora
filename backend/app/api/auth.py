import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from typing import Literal

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from app.database.database import SessionLocal


load_dotenv()

router = APIRouter()

UserRole = Literal["admin", "execution", "estimation", "entrepot"]
TOKEN_TTL_SECONDS = 12 * 60 * 60
DEFAULT_ADMIN_USERNAME = "admin"
DEFAULT_ADMIN_PASSWORD = "Sercora2026!"


class LoginRequest(BaseModel):
    username: str
    password: str


class UserCreate(BaseModel):
    username: str
    full_name: str
    email: str | None = None
    role: UserRole
    password: str
    active: bool = True


class UserUpdate(BaseModel):
    username: str | None = None
    full_name: str | None = None
    email: str | None = None
    role: UserRole | None = None
    password: str | None = None
    active: bool | None = None


class ProfileUpdate(BaseModel):
    full_name: str
    email: str | None = None
    current_password: str | None = None
    new_password: str | None = None


def auth_secret():

    return os.getenv(
        "SERCORA_AUTH_SECRET",
        "change-this-sercora-auth-secret"
    ).encode("utf-8")


def password_hash(password: str):

    salt = secrets.token_hex(16)
    iterations = 260000
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        iterations
    ).hex()

    return f"pbkdf2_sha256${iterations}${salt}${digest}"


def verify_password(password: str, stored_hash: str):

    try:
        algorithm, iterations, salt, digest = stored_hash.split("$")
    except ValueError:
        return False

    if algorithm != "pbkdf2_sha256":
        return False

    candidate = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        int(iterations)
    ).hex()

    return hmac.compare_digest(
        candidate,
        digest
    )


def encode_part(payload: dict):

    return base64.urlsafe_b64encode(
        json.dumps(
            payload,
            separators=(",", ":")
        ).encode("utf-8")
    ).decode("utf-8").rstrip("=")


def decode_part(value: str):

    padding = "=" * (-len(value) % 4)

    return json.loads(
        base64.urlsafe_b64decode(
            value + padding
        ).decode("utf-8")
    )


def create_token(user_id: int):

    payload = {
        "sub": user_id,
        "exp": int(time.time()) + TOKEN_TTL_SECONDS
    }
    encoded_payload = encode_part(payload)
    signature = hmac.new(
        auth_secret(),
        encoded_payload.encode("utf-8"),
        hashlib.sha256
    ).hexdigest()

    return encoded_payload + "." + signature


def parse_token(token: str):

    try:
        encoded_payload, signature = token.split(".", 1)
    except ValueError:
        raise HTTPException(
            status_code=401,
            detail="Invalid token"
        )

    expected_signature = hmac.new(
        auth_secret(),
        encoded_payload.encode("utf-8"),
        hashlib.sha256
    ).hexdigest()

    if not hmac.compare_digest(signature, expected_signature):
        raise HTTPException(
            status_code=401,
            detail="Invalid token"
        )

    payload = decode_part(encoded_payload)

    if int(payload.get("exp") or 0) < int(time.time()):
        raise HTTPException(
            status_code=401,
            detail="Token expired"
        )

    return int(payload["sub"])


def user_payload(row):

    values = row._mapping

    return {
        "id": values["id"],
        "username": values["username"],
        "full_name": values["full_name"],
        "email": values["email"],
        "role": values["role"],
        "active": values["active"],
        "must_change_password": values["must_change_password"],
        "created_at": values.get("created_at"),
        "last_login_at": values.get("last_login_at")
    }


def ensure_user_columns(db):

    db.execute(
        text(
            """
            ALTER TABLE app_user
            ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            """
        )
    )
    db.execute(
        text(
            """
            ALTER TABLE app_user
            ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            """
        )
    )
    db.execute(
        text(
            """
            ALTER TABLE app_user
            ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP
            """
        )
    )
    db.commit()


def get_user_by_id(
    db,
    user_id: int
):

    ensure_user_columns(db)

    row = db.execute(
        text(
            """
            SELECT
                id,
                username,
                full_name,
                email,
                role,
                active,
                must_change_password,
                created_at,
                last_login_at
            FROM app_user
            WHERE id = :id
            """
        ),
        {
            "id": user_id
        }
    ).fetchone()

    if row is None:
        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    return user_payload(row)


def ensure_default_admin(db):

    ensure_user_columns(db)

    count = db.execute(
        text("SELECT count(*) FROM app_user")
    ).scalar()

    if count:
        return

    db.execute(
        text(
            """
            INSERT INTO app_user (
                username,
                full_name,
                email,
                role,
                password_hash,
                active,
                must_change_password
            )
            VALUES (
                :username,
                :full_name,
                :email,
                'admin',
                :password_hash,
                TRUE,
                TRUE
            )
            """
        ),
        {
            "username": DEFAULT_ADMIN_USERNAME,
            "full_name": "Administrateur Sercora",
            "email": None,
            "password_hash": password_hash(DEFAULT_ADMIN_PASSWORD)
        }
    )
    db.commit()


def get_current_user(
    authorization: str | None = Header(default=None)
):

    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="Authentication required"
        )

    user_id = parse_token(
        authorization.removeprefix("Bearer ").strip()
    )
    db = SessionLocal()

    try:
        ensure_user_columns(db)
        row = db.execute(
            text(
                """
                SELECT
                    id,
                    username,
                    full_name,
                    email,
                    role,
                    active,
                    must_change_password,
                    created_at,
                    last_login_at
                FROM app_user
                WHERE id = :id
                """
            ),
            {
                "id": user_id
            }
        ).fetchone()

        if row is None or not row.active:
            raise HTTPException(
                status_code=401,
                detail="Inactive user"
            )

        return user_payload(row)

    finally:
        db.close()


def require_admin(user=Depends(get_current_user)):

    if user["role"] != "admin":
        raise HTTPException(
            status_code=403,
            detail="Admin role required"
        )

    return user


@router.post("/auth/login")
def login(request: LoginRequest):

    db = SessionLocal()

    try:
        ensure_default_admin(db)
        row = db.execute(
            text(
                """
                SELECT
                    id,
                    username,
                    full_name,
                    email,
                    role,
                    password_hash,
                    active,
                    must_change_password,
                    created_at,
                    last_login_at
                FROM app_user
                WHERE lower(username) = lower(:username)
                """
            ),
            {
                "username": request.username.strip()
            }
        ).fetchone()

        if (
            row is None or
            not row.active or
            not verify_password(request.password, row.password_hash)
        ):
            raise HTTPException(
                status_code=401,
                detail="Invalid username or password"
            )

        db.execute(
            text(
                """
                UPDATE app_user
                SET last_login_at = CURRENT_TIMESTAMP
                WHERE id = :id
                """
            ),
            {
                "id": row.id
            }
        )
        db.commit()

        row = db.execute(
            text(
                """
                SELECT
                    id,
                    username,
                    full_name,
                    email,
                    role,
                    active,
                    must_change_password,
                    created_at,
                    last_login_at
                FROM app_user
                WHERE id = :id
                """
            ),
            {
                "id": row.id
            }
        ).fetchone()

        return {
            "token": create_token(row.id),
            "user": user_payload(row)
        }

    finally:
        db.close()


@router.get("/auth/me")
def me(user=Depends(get_current_user)):

    return user


@router.put("/auth/me")
def update_profile(
    profile: ProfileUpdate,
    user=Depends(get_current_user)
):

    db = SessionLocal()

    try:
        values = {
            "id": user["id"],
            "full_name": profile.full_name.strip(),
            "email": (profile.email or "").strip() or None
        }
        password_sql = ""

        if profile.new_password:
            row = db.execute(
                text(
                    """
                    SELECT password_hash
                    FROM app_user
                    WHERE id = :id
                    """
                ),
                {
                    "id": user["id"]
                }
            ).fetchone()

            if (
                not profile.current_password or
                not verify_password(profile.current_password, row.password_hash)
            ):
                raise HTTPException(
                    status_code=400,
                    detail="Current password is invalid"
                )

            values["password_hash"] = password_hash(profile.new_password)
            password_sql = """
                password_hash = :password_hash,
                must_change_password = FALSE,
            """

        db.execute(
            text(
                """
                UPDATE app_user
                SET
                    full_name = :full_name,
                    email = :email,
                    """ + password_sql + """
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = :id
                """
            ),
            values
        )
        db.commit()

        return get_user_by_id(db, user["id"])

    finally:
        db.close()


@router.get("/users")
def get_users(_admin=Depends(require_admin)):

    db = SessionLocal()

    try:
        ensure_user_columns(db)
        rows = db.execute(
            text(
                """
                SELECT
                    id,
                    username,
                    full_name,
                    email,
                    role,
                    active,
                    must_change_password,
                    created_at,
                    last_login_at
                FROM app_user
                ORDER BY active DESC, full_name, username
                """
            )
        )

        return [
            user_payload(row)
            for row in rows
        ]

    finally:
        db.close()


@router.post("/users")
def create_user(
    user: UserCreate,
    _admin=Depends(require_admin)
):

    db = SessionLocal()

    try:
        ensure_user_columns(db)
        try:
            row = db.execute(
                text(
                    """
                    INSERT INTO app_user (
                        username,
                        full_name,
                        email,
                        role,
                        password_hash,
                        active,
                        must_change_password
                    )
                    VALUES (
                        :username,
                        :full_name,
                        :email,
                        :role,
                        :password_hash,
                        :active,
                        TRUE
                    )
                    RETURNING id
                    """
                ),
                {
                    "username": user.username.strip(),
                    "full_name": user.full_name.strip(),
                    "email": (user.email or "").strip() or None,
                    "role": user.role,
                    "password_hash": password_hash(user.password),
                    "active": user.active
                }
            ).fetchone()
            db.commit()

        except IntegrityError:
            db.rollback()
            raise HTTPException(
                status_code=409,
                detail="Username already exists"
            )

        return {
            "id": row.id,
            "message": "User created"
        }

    finally:
        db.close()


@router.put("/users/{user_id}")
def update_user(
    user_id: int,
    user: UserUpdate,
    _admin=Depends(require_admin)
):

    db = SessionLocal()

    try:
        ensure_user_columns(db)
        current = db.execute(
            text("SELECT id FROM app_user WHERE id = :id"),
            {
                "id": user_id
            }
        ).fetchone()

        if current is None:
            raise HTTPException(
                status_code=404,
                detail="User not found"
            )

        values = {
            "id": user_id,
            "username": user.username,
            "full_name": user.full_name,
            "email": user.email,
            "role": user.role,
            "active": user.active
        }
        password_sql = ""

        if user.password:
            values["password_hash"] = password_hash(user.password)
            password_sql = """
                password_hash = :password_hash,
                must_change_password = TRUE,
            """

        try:
            db.execute(
                text(
                    """
                    UPDATE app_user
                    SET
                        username = COALESCE(:username, username),
                        full_name = COALESCE(:full_name, full_name),
                        email = :email,
                        role = COALESCE(:role, role),
                        active = COALESCE(:active, active),
                        """ + password_sql + """
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = :id
                    """
                ),
                values
            )
            db.commit()

        except IntegrityError:
            db.rollback()
            raise HTTPException(
                status_code=409,
                detail="Username already exists"
            )

        return {
            "message": "User updated"
        }

    finally:
        db.close()
