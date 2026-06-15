ALTER TABLE product
    ADD COLUMN IF NOT EXISTS prosol_product_id BIGINT,
    ADD COLUMN IF NOT EXISTS prosol_uuid VARCHAR(100),
    ADD COLUMN IF NOT EXISTS prosol_sku VARCHAR(100),
    ADD COLUMN IF NOT EXISTS manufacturer_sku VARCHAR(100),
    ADD COLUMN IF NOT EXISTS category_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS image_url TEXT,
    ADD COLUMN IF NOT EXISTS source_url TEXT,
    ADD COLUMN IF NOT EXISTS default_purchase_price NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS msrp_price NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS price_updated_at TIMESTAMP;

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_prosol_product_id
    ON product(prosol_product_id)
    WHERE prosol_product_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_prosol_uuid
    ON product(prosol_uuid)
    WHERE prosol_uuid IS NOT NULL;
