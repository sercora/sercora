ALTER TABLE client
    ADD COLUMN IF NOT EXISTS phone TEXT;

ALTER TABLE client
    ADD COLUMN IF NOT EXISTS fax TEXT;

ALTER TABLE client
    ADD COLUMN IF NOT EXISTS mobile TEXT;

ALTER TABLE client
    ADD COLUMN IF NOT EXISTS billing_address TEXT;

ALTER TABLE client
    ADD COLUMN IF NOT EXISTS billing_postal_code VARCHAR(20);

ALTER TABLE client
    ADD COLUMN IF NOT EXISTS rbq VARCHAR(80);

CREATE TABLE IF NOT EXISTS client_estimator (
    id BIGSERIAL PRIMARY KEY,

    client_id BIGINT NOT NULL REFERENCES client(id) ON DELETE CASCADE,

    name TEXT NOT NULL,

    cell TEXT,

    email TEXT,

    active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_client_estimator_client
    ON client_estimator(client_id, active, name);
