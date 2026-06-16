CREATE TABLE IF NOT EXISTS app_email_settings (
    id SMALLINT PRIMARY KEY DEFAULT 1,
    smtp_host VARCHAR(255),
    smtp_port INTEGER DEFAULT 587,
    smtp_username VARCHAR(255),
    smtp_password TEXT,
    from_email VARCHAR(255),
    from_name VARCHAR(255) DEFAULT 'Sercora',
    use_tls BOOLEAN DEFAULT TRUE,
    use_ssl BOOLEAN DEFAULT FALSE,
    active BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT single_email_settings CHECK (id = 1)
);

CREATE TABLE IF NOT EXISTS app_user_token (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) UNIQUE NOT NULL,
    purpose VARCHAR(40) NOT NULL CHECK (
        purpose IN ('invite', 'password_reset')
    ),
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_app_user_token_user
    ON app_user_token(user_id);

CREATE INDEX IF NOT EXISTS idx_app_user_token_lookup
    ON app_user_token(token_hash, purpose, expires_at, used_at);
