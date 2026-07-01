CREATE TABLE IF NOT EXISTS app_user_preference (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    preference_key VARCHAR(120) NOT NULL,
    preference_value JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, preference_key)
);

CREATE INDEX IF NOT EXISTS idx_app_user_preference_user
    ON app_user_preference(user_id, preference_key);
