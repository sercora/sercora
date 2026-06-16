CREATE TABLE IF NOT EXISTS product_document (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES product(id) ON DELETE CASCADE,
    source VARCHAR(100) NOT NULL,
    source_document_id BIGINT,
    source_uuid VARCHAR(100),
    document_type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    url TEXT NOT NULL,
    language VARCHAR(20),
    active BOOLEAN DEFAULT TRUE,
    synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_document_source_uuid
    ON product_document(product_id, source, source_uuid)
    WHERE source_uuid IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_document_source_id
    ON product_document(product_id, source, source_document_id)
    WHERE source_document_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_product_document_product_type
    ON product_document(product_id, document_type);


CREATE TABLE IF NOT EXISTS product_coverage_option (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES product(id) ON DELETE CASCADE,
    coverage_type VARCHAR(50) NOT NULL,
    label VARCHAR(255),
    thickness_mm NUMERIC(8, 3),
    tile_size_label VARCHAR(100),
    coverage_value NUMERIC(12, 4) NOT NULL,
    coverage_unit VARCHAR(50) NOT NULL,
    sort_order INTEGER DEFAULT 0,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_product_coverage_type
        CHECK (coverage_type IN ('thickness', 'tile_size'))
);

CREATE INDEX IF NOT EXISTS idx_product_coverage_option_product
    ON product_coverage_option(product_id, sort_order, id);
