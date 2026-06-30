CREATE TABLE IF NOT EXISTS app_snipeit_settings (
    id SMALLINT PRIMARY KEY DEFAULT 1,

    base_url TEXT NOT NULL,

    username VARCHAR(255),

    api_token TEXT,

    active BOOLEAN DEFAULT TRUE,

    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT single_snipeit_settings CHECK (id = 1)
);
