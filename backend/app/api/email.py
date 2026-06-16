import base64
import hashlib
import json
import os
import secrets
import smtplib
from datetime import datetime, timedelta
from email.message import EmailMessage
from typing import Literal
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from app.api.auth import ensure_user_columns, require_admin, password_hash
from app.database.database import SessionLocal


load_dotenv()

router = APIRouter()

UserRole = Literal["admin", "execution", "estimation", "entrepot"]


class EmailSettingsInput(BaseModel):
    smtp_host: str
    smtp_port: int = 587
    smtp_username: str | None = None
    smtp_password: str | None = None
    from_email: str
    from_name: str = "Sercora"
    reply_to_email: str | None = None
    use_tls: bool = True
    use_ssl: bool = False
    active: bool = True


class EmailTestRequest(BaseModel):
    recipient: str


class ForgotPasswordRequest(BaseModel):
    email: str


class SmsSettingsInput(BaseModel):
    provider_name: str = ""
    account_id: str | None = None
    api_key: str | None = None
    api_secret: str | None = None
    from_number: str | None = None
    alert_minutes_before: int = 30
    active: bool = False


class SmsTestRequest(BaseModel):
    destination: str
    message: str


class InviteUserRequest(BaseModel):
    username: str
    full_name: str
    email: str
    phone_number: str | None = None
    role: UserRole
    active: bool = True


class SetPasswordRequest(BaseModel):
    token: str
    password: str


def public_url():

    return os.getenv(
        "SERCORA_PUBLIC_URL",
        "https://sercora.serco.pro"
    ).rstrip("/")


def token_hash(
    token: str
):

    return hashlib.sha256(
        token.encode("utf-8")
    ).hexdigest()


def settings_payload(row):

    if row is None:
        return {
            "smtp_host": "",
            "smtp_port": 587,
            "smtp_username": "",
            "from_email": "",
            "from_name": "Sercora",
            "reply_to_email": "",
            "use_tls": True,
            "use_ssl": False,
            "active": False,
            "password_configured": False
        }

    return {
        "smtp_host": row.smtp_host or "",
        "smtp_port": row.smtp_port or 587,
        "smtp_username": row.smtp_username or "",
        "from_email": row.from_email or "",
        "from_name": row.from_name or "Sercora",
        "reply_to_email": row.reply_to_email or "",
        "use_tls": row.use_tls,
        "use_ssl": row.use_ssl,
        "active": row.active,
        "password_configured": bool(row.smtp_password)
    }


def sms_settings_payload(row):

    if row is None:
        return {
            "provider_name": "",
            "account_id": "",
            "api_key": "",
            "from_number": "",
            "alert_minutes_before": 30,
            "active": False,
            "secret_configured": False
        }

    return {
        "provider_name": row.provider_name or "",
        "account_id": row.account_id or "",
        "api_key": row.api_key or "",
        "from_number": row.from_number or "",
        "alert_minutes_before": row.alert_minutes_before or 30,
        "active": row.active,
        "secret_configured": bool(row.api_secret)
    }


def ensure_sms_settings_table(db):

    db.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS app_sms_settings (
                id SMALLINT PRIMARY KEY DEFAULT 1,
                provider_name VARCHAR(80),
                account_id VARCHAR(255),
                api_key VARCHAR(255),
                api_secret TEXT,
                from_number VARCHAR(40),
                alert_minutes_before INTEGER DEFAULT 30,
                active BOOLEAN DEFAULT FALSE,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT single_sms_settings CHECK (id = 1)
            )
            """
        )
    )
    db.commit()


def get_settings_row(db):

    return db.execute(
        text(
            """
            SELECT
                smtp_host,
                smtp_port,
                smtp_username,
                smtp_password,
                from_email,
                from_name,
                reply_to_email,
                use_tls,
                use_ssl,
                active
            FROM app_email_settings
            WHERE id = 1
            """
        )
    ).fetchone()


def get_sms_settings_row(db):

    ensure_sms_settings_table(db)

    return db.execute(
        text(
            """
            SELECT
                provider_name,
                account_id,
                api_key,
                api_secret,
                from_number,
                alert_minutes_before,
                active
            FROM app_sms_settings
            WHERE id = 1
            """
        )
    ).fetchone()


def require_email_settings(db):

    row = get_settings_row(db)

    if (
        row is None or
        not row.active or
        not row.smtp_host or
        not row.from_email
    ):
        raise HTTPException(
            status_code=400,
            detail="SMTP is not configured"
        )

    return row


def require_sms_settings(db):

    row = get_sms_settings_row(db)

    if (
        row is None or
        not row.active or
        not row.provider_name or
        not row.from_number
    ):
        raise HTTPException(
            status_code=400,
            detail="VoIP/SMS is not configured"
        )

    return row


def send_email(
    settings,
    recipient: str,
    subject: str,
    body: str
):

    message = EmailMessage()
    sender_name = settings.from_name or "Sercora"
    message["From"] = f"{sender_name} <{settings.from_email}>"
    message["To"] = recipient
    message["Subject"] = subject

    if settings.reply_to_email:
        message["Reply-To"] = settings.reply_to_email

    message.set_content(body)

    if settings.use_ssl:
        smtp = smtplib.SMTP_SSL(
            settings.smtp_host,
            settings.smtp_port,
            timeout=15
        )
    else:
        smtp = smtplib.SMTP(
            settings.smtp_host,
            settings.smtp_port,
            timeout=15
        )

    try:
        if settings.use_tls and not settings.use_ssl:
            smtp.starttls()

        if settings.smtp_username:
            smtp.login(
                settings.smtp_username,
                settings.smtp_password or ""
            )

        smtp.send_message(message)

    finally:
        smtp.quit()


def provider_key(
    provider_name: str
):

    return (
        provider_name
        .strip()
        .lower()
        .replace(".", "")
        .replace("-", "")
        .replace("_", "")
        .replace(" ", "")
    )


def sms_http_request(
    request: Request
):

    try:
        with urlopen(
            request,
            timeout=20
        ) as response:
            payload = response.read().decode("utf-8", errors="replace")

        return {
            "status_code": response.status,
            "body": payload[:1000]
        }

    except HTTPError as error:
        payload = error.read().decode("utf-8", errors="replace")
        raise HTTPException(
            status_code=502,
            detail=f"Erreur fournisseur SMS ({error.code}): {payload[:300]}"
        ) from error

    except (URLError, TimeoutError, OSError) as error:
        raise HTTPException(
            status_code=502,
            detail=f"Fournisseur SMS indisponible: {error}"
        ) from error


def sms_json_body(
    response
):

    body = response.get("body") or ""

    try:
        return json.loads(body)
    except json.JSONDecodeError:
        return None


def sms_provider_detail(
    response
):

    payload = sms_json_body(response)

    if isinstance(payload, dict):
        if payload.get("message"):
            return str(payload["message"])

        if payload.get("error_message"):
            return str(payload["error_message"])

        if payload.get("status"):
            return "status=" + str(payload["status"])

        if payload.get("sid"):
            return "sid=" + str(payload["sid"])

        data = payload.get("data")

        if isinstance(data, dict):
            if data.get("id"):
                return "id=" + str(data["id"])

            if data.get("record_type"):
                return str(data["record_type"])

        errors = payload.get("errors")

        if isinstance(errors, list) and errors:
            first_error = errors[0]

            if isinstance(first_error, dict):
                return str(
                    first_error.get("detail") or
                    first_error.get("title") or
                    first_error
                )

    body = (response.get("body") or "").strip()

    if body:
        return body[:300]

    return "Aucun detail fournisseur"


def ensure_sms_provider_success(
    provider: str,
    response
):

    status_code = response.get("status_code")
    payload = sms_json_body(response)
    detail = sms_provider_detail(response)
    body = (response.get("body") or "").strip().lower()

    if provider == "twilio":
        if status_code not in (200, 201):
            raise HTTPException(
                status_code=502,
                detail=f"Twilio a refuse le SMS: {detail}"
            )

        if isinstance(payload, dict) and payload.get("sid"):
            return detail

        raise HTTPException(
            status_code=502,
            detail=f"Reponse Twilio inattendue: {detail}"
        )

    if provider == "telnyx":
        if status_code not in (200, 202):
            raise HTTPException(
                status_code=502,
                detail=f"Telnyx a refuse le SMS: {detail}"
            )

        if isinstance(payload, dict):
            errors = payload.get("errors")

            if errors:
                raise HTTPException(
                    status_code=502,
                    detail=f"Telnyx a refuse le SMS: {detail}"
                )

            data = payload.get("data")

            if isinstance(data, dict) and data.get("id"):
                return detail

        raise HTTPException(
            status_code=502,
            detail=f"Reponse Telnyx inattendue: {detail}"
        )

    if provider in ("voipms", "voip"):
        if status_code != 200:
            raise HTTPException(
                status_code=502,
                detail=f"VoIP.ms a refuse le SMS: {detail}"
            )

        if isinstance(payload, dict):
            provider_status = str(payload.get("status") or "").lower()

            if provider_status == "success":
                return detail

            raise HTTPException(
                status_code=502,
                detail=f"VoIP.ms n'a pas accepte le SMS: {detail}"
            )

        if "success" in body and "error" not in body and "failed" not in body:
            return detail

        raise HTTPException(
            status_code=502,
            detail=f"Reponse VoIP.ms inattendue: {detail}"
        )

    return detail


def sms_headers(
    extra_headers: dict | None = None
):

    headers = {
        "User-Agent": "Sercora/1.0 (+https://sercora.serco.pro)",
        "Accept": "application/json,text/plain,*/*"
    }

    if extra_headers:
        headers.update(extra_headers)

    return headers


def send_sms(
    settings,
    destination: str,
    message: str
):

    clean_destination = destination.strip()
    clean_message = message.strip()

    if not clean_destination:
        raise HTTPException(
            status_code=422,
            detail="Numero de destination requis"
        )

    if not clean_message:
        raise HTTPException(
            status_code=422,
            detail="Message SMS requis"
        )

    provider = provider_key(settings.provider_name or "")

    def voip_ms_phone(value: str):
        return "".join(
            character
            for character in (value or "")
            if character.isdigit()
        )

    if provider == "twilio":
        if not settings.account_id or not settings.api_secret:
            raise HTTPException(
                status_code=400,
                detail="Twilio requiert l'ID compte et le secret/token API"
            )

        data = urlencode(
            {
                "From": settings.from_number,
                "To": clean_destination,
                "Body": clean_message
            }
        ).encode("utf-8")
        auth_token = base64.b64encode(
            f"{settings.account_id}:{settings.api_secret}".encode("utf-8")
        ).decode("ascii")

        response = sms_http_request(
            Request(
                f"https://api.twilio.com/2010-04-01/Accounts/{settings.account_id}/Messages.json",
                data=data,
                headers=sms_headers(
                    {
                    "Authorization": "Basic " + auth_token,
                    "Content-Type": "application/x-www-form-urlencoded"
                    }
                ),
                method="POST"
            )
        )

        response["detail"] = ensure_sms_provider_success(
            provider,
            response
        )
        return response

    if provider == "telnyx":
        api_token = settings.api_secret or settings.api_key

        if not api_token:
            raise HTTPException(
                status_code=400,
                detail="Telnyx requiert une cle ou un token API"
            )

        data = json.dumps(
            {
                "from": settings.from_number,
                "to": clean_destination,
                "text": clean_message
            }
        ).encode("utf-8")

        response = sms_http_request(
            Request(
                "https://api.telnyx.com/v2/messages",
                data=data,
                headers=sms_headers(
                    {
                    "Authorization": "Bearer " + api_token,
                    "Content-Type": "application/json"
                    }
                ),
                method="POST"
            )
        )

        response["detail"] = ensure_sms_provider_success(
            provider,
            response
        )
        return response

    if provider in ("voipms", "voip"):
        voip_api_password = settings.api_key or settings.api_secret

        if (
            not settings.account_id or
            not voip_api_password
        ):
            raise HTTPException(
                status_code=400,
                detail="VoIP.ms requiert l'ID compte et l'API password"
            )

        form_values = {
            "api_username": settings.account_id,
            "api_password": voip_api_password,
            "method": "sendSMS",
            "did": voip_ms_phone(settings.from_number),
            "dst": voip_ms_phone(clean_destination),
            "message": clean_message
        }
        query_string = urlencode(form_values)

        response = sms_http_request(
            Request(
                "https://voip.ms/api/v1/rest.php?" + query_string,
                headers=sms_headers(),
                method="GET"
            )
        )

        response["detail"] = ensure_sms_provider_success(
            provider,
            response
        )
        return response

    raise HTTPException(
        status_code=400,
        detail=(
            "Fournisseur SMS non supporte pour le test. "
            "Utilise Twilio, Telnyx ou VoIP.ms."
        )
    )


def create_user_token(
    db,
    user_id: int,
    purpose: str
):

    raw_token = secrets.token_urlsafe(36)
    db.execute(
        text(
            """
            INSERT INTO app_user_token (
                user_id,
                token_hash,
                purpose,
                expires_at
            )
            VALUES (
                :user_id,
                :token_hash,
                :purpose,
                :expires_at
            )
            """
        ),
        {
            "user_id": user_id,
            "token_hash": token_hash(raw_token),
            "purpose": purpose,
            "expires_at": datetime.utcnow() + timedelta(days=7)
        }
    )

    return raw_token


def setup_link(
    token: str
):

    return public_url() + "/?setup_token=" + token


def send_setup_email(
    db,
    user_id: int,
    email: str,
    full_name: str,
    purpose: str
):

    settings = require_email_settings(db)
    raw_token = create_user_token(
        db,
        user_id,
        purpose
    )
    link = setup_link(raw_token)
    subject = (
        "Invitation Sercora" if purpose == "invite" else
        "Reinitialisation du mot de passe Sercora"
    )
    body = (
        f"Bonjour {full_name},\n\n"
        "Un lien Sercora a ete genere pour configurer votre mot de passe.\n\n"
        f"{link}\n\n"
        "Ce lien expire dans 7 jours.\n"
    )

    send_email(
        settings,
        email,
        subject,
        body
    )


@router.post("/auth/forgot-password")
def forgot_password(
    request: ForgotPasswordRequest
):

    db = SessionLocal()

    try:
        ensure_user_columns(db)
        email = request.email.strip().lower()

        if not email:
            raise HTTPException(
                status_code=422,
                detail="Courriel requis"
            )

        row = db.execute(
            text(
                """
                SELECT
                    id,
                    full_name,
                    email
                FROM app_user
                WHERE lower(email) = :email
                    AND active = TRUE
                ORDER BY id
                LIMIT 1
                """
            ),
            {
                "email": email
            }
        ).fetchone()

        if row is not None:
            send_setup_email(
                db,
                row.id,
                row.email,
                row.full_name,
                "password_reset"
            )
            db.commit()

        return {
            "message": (
                "Si un compte actif utilise ce courriel, "
                "un lien de modification sera envoye."
            )
        }

    finally:
        db.close()


@router.get("/admin/email-settings")
def get_email_settings(_admin=Depends(require_admin)):

    db = SessionLocal()

    try:
        return settings_payload(
            get_settings_row(db)
        )

    finally:
        db.close()


@router.put("/admin/email-settings")
def save_email_settings(
    settings: EmailSettingsInput,
    _admin=Depends(require_admin)
):

    db = SessionLocal()

    try:
        current = get_settings_row(db)
        smtp_password = (
            settings.smtp_password if settings.smtp_password else
            (current.smtp_password if current is not None else None)
        )

        db.execute(
            text(
                """
                INSERT INTO app_email_settings (
                    id,
                    smtp_host,
                    smtp_port,
                    smtp_username,
                    smtp_password,
                    from_email,
                    from_name,
                    reply_to_email,
                    use_tls,
                    use_ssl,
                    active,
                    updated_at
                )
                VALUES (
                    1,
                    :smtp_host,
                    :smtp_port,
                    :smtp_username,
                    :smtp_password,
                    :from_email,
                    :from_name,
                    :reply_to_email,
                    :use_tls,
                    :use_ssl,
                    :active,
                    CURRENT_TIMESTAMP
                )
                ON CONFLICT (id)
                DO UPDATE SET
                    smtp_host = EXCLUDED.smtp_host,
                    smtp_port = EXCLUDED.smtp_port,
                    smtp_username = EXCLUDED.smtp_username,
                    smtp_password = EXCLUDED.smtp_password,
                    from_email = EXCLUDED.from_email,
                    from_name = EXCLUDED.from_name,
                    reply_to_email = EXCLUDED.reply_to_email,
                    use_tls = EXCLUDED.use_tls,
                    use_ssl = EXCLUDED.use_ssl,
                    active = EXCLUDED.active,
                    updated_at = CURRENT_TIMESTAMP
                """
            ),
            {
                "smtp_host": settings.smtp_host.strip(),
                "smtp_port": settings.smtp_port,
                "smtp_username": (settings.smtp_username or "").strip() or None,
                "smtp_password": smtp_password,
                "from_email": settings.from_email.strip(),
                "from_name": settings.from_name.strip() or "Sercora",
                "reply_to_email": (
                    (settings.reply_to_email or "").strip() or None
                ),
                "use_tls": settings.use_tls,
                "use_ssl": settings.use_ssl,
                "active": settings.active
            }
        )
        db.commit()

        return settings_payload(
            get_settings_row(db)
        )

    finally:
        db.close()


@router.post("/admin/email-settings/test")
def test_email_settings(
    request: EmailTestRequest,
    _admin=Depends(require_admin)
):

    db = SessionLocal()

    try:
        ensure_user_columns(db)
        settings = require_email_settings(db)
        send_email(
            settings,
            request.recipient,
            "Test SMTP Sercora",
            "Le SMTP Sercora est configure et fonctionnel."
        )

        return {
            "message": "Test email sent"
        }

    finally:
        db.close()


@router.get("/admin/sms-settings")
def get_sms_settings(_admin=Depends(require_admin)):

    db = SessionLocal()

    try:
        return sms_settings_payload(
            get_sms_settings_row(db)
        )

    finally:
        db.close()


@router.put("/admin/sms-settings")
def save_sms_settings(
    settings: SmsSettingsInput,
    _admin=Depends(require_admin)
):

    db = SessionLocal()

    try:
        current = get_sms_settings_row(db)
        api_secret = (
            settings.api_secret if settings.api_secret else
            (current.api_secret if current is not None else None)
        )
        alert_minutes_before = max(
            1,
            min(
                1440,
                settings.alert_minutes_before or 30
            )
        )

        db.execute(
            text(
                """
                INSERT INTO app_sms_settings (
                    id,
                    provider_name,
                    account_id,
                    api_key,
                    api_secret,
                    from_number,
                    alert_minutes_before,
                    active,
                    updated_at
                )
                VALUES (
                    1,
                    :provider_name,
                    :account_id,
                    :api_key,
                    :api_secret,
                    :from_number,
                    :alert_minutes_before,
                    :active,
                    CURRENT_TIMESTAMP
                )
                ON CONFLICT (id)
                DO UPDATE SET
                    provider_name = EXCLUDED.provider_name,
                    account_id = EXCLUDED.account_id,
                    api_key = EXCLUDED.api_key,
                    api_secret = EXCLUDED.api_secret,
                    from_number = EXCLUDED.from_number,
                    alert_minutes_before = EXCLUDED.alert_minutes_before,
                    active = EXCLUDED.active,
                    updated_at = CURRENT_TIMESTAMP
                """
            ),
            {
                "provider_name": settings.provider_name.strip(),
                "account_id": (settings.account_id or "").strip() or None,
                "api_key": (settings.api_key or "").strip() or None,
                "api_secret": api_secret,
                "from_number": (settings.from_number or "").strip() or None,
                "alert_minutes_before": alert_minutes_before,
                "active": settings.active
            }
        )
        db.commit()

        return sms_settings_payload(
            get_sms_settings_row(db)
        )

    finally:
        db.close()


@router.post("/admin/sms-settings/test")
def test_sms_settings(
    request: SmsTestRequest,
    _admin=Depends(require_admin)
):

    db = SessionLocal()

    try:
        settings = require_sms_settings(db)
        provider_response = send_sms(
            settings,
            request.destination,
            request.message
        )

        return {
            "message": "Test SMS sent",
            "provider": settings.provider_name,
            "provider_status": provider_response["status_code"],
            "provider_detail": provider_response.get("detail")
        }

    finally:
        db.close()


@router.post("/user-invitations")
def invite_new_user(
    request: InviteUserRequest,
    _admin=Depends(require_admin)
):

    db = SessionLocal()

    try:
        settings = require_email_settings(db)

        try:
            row = db.execute(
                text(
                    """
                    INSERT INTO app_user (
                        username,
                        full_name,
                        email,
                        phone_number,
                        role,
                        password_hash,
                        active,
                        must_change_password
                    )
                    VALUES (
                        :username,
                        :full_name,
                        :email,
                        :phone_number,
                        :role,
                        :password_hash,
                        :active,
                        TRUE
                    )
                    RETURNING id
                    """
                ),
                {
                    "username": request.username.strip(),
                    "full_name": request.full_name.strip(),
                    "email": request.email.strip(),
                    "phone_number": (request.phone_number or "").strip() or None,
                    "role": request.role,
                    "password_hash": password_hash(secrets.token_urlsafe(32)),
                    "active": request.active
                }
            ).fetchone()

        except IntegrityError:
            db.rollback()
            raise HTTPException(
                status_code=409,
                detail="Username already exists"
            )

        raw_token = create_user_token(
            db,
            row.id,
            "invite"
        )

        send_email(
            settings,
            request.email.strip(),
            "Invitation Sercora",
            (
                f"Bonjour {request.full_name.strip()},\n\n"
                "Votre compte Sercora a ete cree.\n\n"
                "Configurez votre mot de passe avec ce lien:\n"
                f"{setup_link(raw_token)}\n\n"
                "Ce lien expire dans 7 jours.\n"
            )
        )
        db.commit()

        return {
            "id": row.id,
            "message": "Invitation sent"
        }

    finally:
        db.close()


@router.post("/users/{user_id}/invite")
def invite_existing_user(
    user_id: int,
    _admin=Depends(require_admin)
):

    db = SessionLocal()

    try:
        row = db.execute(
            text(
                """
                SELECT id, full_name, email
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

        if not row.email:
            raise HTTPException(
                status_code=400,
                detail="User email is required"
            )

        send_setup_email(
            db,
            row.id,
            row.email,
            row.full_name,
            "invite"
        )
        db.commit()

        return {
            "message": "Invitation sent"
        }

    finally:
        db.close()


@router.post("/users/{user_id}/password-reset")
def send_password_reset(
    user_id: int,
    _admin=Depends(require_admin)
):

    db = SessionLocal()

    try:
        row = db.execute(
            text(
                """
                SELECT id, full_name, email
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

        if not row.email:
            raise HTTPException(
                status_code=400,
                detail="User email is required"
            )

        send_setup_email(
            db,
            row.id,
            row.email,
            row.full_name,
            "password_reset"
        )
        db.commit()

        return {
            "message": "Password reset sent"
        }

    finally:
        db.close()


@router.post("/auth/set-password")
def set_password(
    request: SetPasswordRequest
):

    db = SessionLocal()

    try:
        row = db.execute(
            text(
                """
                SELECT
                    id,
                    user_id
                FROM app_user_token
                WHERE token_hash = :token_hash
                    AND used_at IS NULL
                    AND expires_at > CURRENT_TIMESTAMP
                """
            ),
            {
                "token_hash": token_hash(request.token)
            }
        ).fetchone()

        if row is None:
            raise HTTPException(
                status_code=400,
                detail="Invalid or expired token"
            )

        db.execute(
            text(
                """
                UPDATE app_user
                SET
                    password_hash = :password_hash,
                    active = TRUE,
                    must_change_password = FALSE,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = :user_id
                """
            ),
            {
                "user_id": row.user_id,
                "password_hash": password_hash(request.password)
            }
        )
        db.execute(
            text(
                """
                UPDATE app_user_token
                SET used_at = CURRENT_TIMESTAMP
                WHERE id = :id
                """
            ),
            {
                "id": row.id
            }
        )
        db.commit()

        return {
            "message": "Password updated"
        }

    finally:
        db.close()
