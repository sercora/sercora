CREATE TABLE IF NOT EXISTS supplier_discount (
    id BIGSERIAL PRIMARY KEY,
    supplier_name VARCHAR(255) UNIQUE NOT NULL,
    discount_percent NUMERIC(7, 3),
    active BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO supplier_discount (
    supplier_name,
    discount_percent,
    active
)
VALUES
    ('Schluter', 40, TRUE),
    ('Centura', 45, TRUE),
    ('Olympia', NULL, TRUE)
ON CONFLICT (supplier_name)
DO NOTHING;
