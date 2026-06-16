ALTER TABLE app_email_settings
    ADD COLUMN IF NOT EXISTS reply_to_email VARCHAR(255);
