ALTER TABLE project
    ADD COLUMN IF NOT EXISTS address_line1 VARCHAR(255),
    ADD COLUMN IF NOT EXISTS address_line2 VARCHAR(255),
    ADD COLUMN IF NOT EXISTS city VARCHAR(120),
    ADD COLUMN IF NOT EXISTS province VARCHAR(80),
    ADD COLUMN IF NOT EXISTS postal_code VARCHAR(20);


CREATE TABLE IF NOT EXISTS estimate_supplier_quote (
    id BIGSERIAL PRIMARY KEY,
    estimate_id BIGINT NOT NULL REFERENCES estimate(id) ON DELETE CASCADE,
    supplier_id BIGINT REFERENCES supplier(id),
    supplier_name VARCHAR(255) NOT NULL,
    expires_on DATE,
    quote_reference VARCHAR(120),
    notes TEXT,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_estimate_supplier_quote_estimate
    ON estimate_supplier_quote(estimate_id, active, expires_on);
