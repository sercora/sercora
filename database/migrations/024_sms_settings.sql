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
);
