CREATE TABLE product_type (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    active BOOLEAN DEFAULT TRUE
);

CREATE TABLE unit (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    symbol VARCHAR(20) NOT NULL
);

CREATE TABLE surface_type (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    category VARCHAR(50),
    sort_order INTEGER DEFAULT 0,
    active BOOLEAN DEFAULT TRUE
);

CREATE TABLE product (
    id BIGSERIAL PRIMARY KEY,

    product_type_id INTEGER REFERENCES product_type(id),

    name VARCHAR(255) NOT NULL,

    manufacturer_name VARCHAR(255),

    collection_name VARCHAR(255),

    color_name VARCHAR(255),

    finish_name VARCHAR(255),

    size_name VARCHAR(100),

    default_unit_id INTEGER REFERENCES unit(id),

    default_grout_color VARCHAR(100),

    prosol_product_id BIGINT,

    prosol_uuid VARCHAR(100),

    prosol_sku VARCHAR(100),

    manufacturer_sku VARCHAR(100),

    category_name VARCHAR(255),

    image_url TEXT,

    source_url TEXT,

    default_purchase_price NUMERIC(12,2),

    msrp_price NUMERIC(12,2),

    price_updated_at TIMESTAMP,

    active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX idx_product_prosol_product_id
    ON product(prosol_product_id)
    WHERE prosol_product_id IS NOT NULL;

CREATE UNIQUE INDEX idx_product_prosol_uuid
    ON product(prosol_uuid)
    WHERE prosol_uuid IS NOT NULL;

CREATE TABLE product_document (
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

CREATE UNIQUE INDEX idx_product_document_source_uuid
    ON product_document(product_id, source, source_uuid)
    WHERE source_uuid IS NOT NULL;

CREATE UNIQUE INDEX idx_product_document_source_id
    ON product_document(product_id, source, source_document_id)
    WHERE source_document_id IS NOT NULL;

CREATE INDEX idx_product_document_product_type
    ON product_document(product_id, document_type);

CREATE TABLE product_coverage_option (
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

CREATE INDEX idx_product_coverage_option_product
    ON product_coverage_option(product_id, sort_order, id);

CREATE TABLE project (
    id BIGSERIAL PRIMARY KEY,

    project_number VARCHAR(50),

    project_name VARCHAR(255) NOT NULL,

    architect_name VARCHAR(255),

    plan_date DATE,

    plan_pages TEXT,

    spec_sections TEXT,

    status VARCHAR(50) DEFAULT 'PENDING',

    address_line1 VARCHAR(255),

    address_line2 VARCHAR(255),

    city VARCHAR(120),

    province VARCHAR(80),

    postal_code VARCHAR(20),

    probable_schedule VARCHAR(255),

    start_date DATE,
    end_date DATE,

    tile_holdback_percent NUMERIC(5,2),

    warranty_years INTEGER,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE estimate (
    id BIGSERIAL PRIMARY KEY,

    project_id BIGINT REFERENCES project(id),

    parent_estimate_id BIGINT REFERENCES estimate(id),

    revision_number INTEGER,

    estimate_type VARCHAR(50),

    used_hourly_rate NUMERIC(12,2),

    global_profit_percent NUMERIC(6,2),

    description TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE room (
    id BIGSERIAL PRIMARY KEY,

    estimate_id BIGINT REFERENCES estimate(id),

    phase_name VARCHAR(50),

    phase_label VARCHAR(120),

    floor_name VARCHAR(50),

    floor_label VARCHAR(120),

    room_name VARCHAR(255),

    sort_order INTEGER DEFAULT 0
);

CREATE TABLE estimate_line (
    id BIGSERIAL PRIMARY KEY,

    estimate_id BIGINT REFERENCES estimate(id),

    product_id BIGINT REFERENCES product(id),

    surface_type_id INTEGER REFERENCES surface_type(id),

    unit_id INTEGER REFERENCES unit(id),

    grout_color VARCHAR(100),

    loss_percent NUMERIC(6,2),

    purchase_price NUMERIC(12,2),

    profit_percent NUMERIC(6,2),

    profit_forced BOOLEAN DEFAULT FALSE,

    installation_cost NUMERIC(12,2),

    installation_link_source_line_id BIGINT REFERENCES estimate_line(id) ON DELETE SET NULL,

    installation_link_multiplier NUMERIC(12,4) DEFAULT 1,

    quantity_link_source_line_ids JSONB DEFAULT '[]'::jsonb,

    quantity_link_multiplier NUMERIC(12,4) DEFAULT 1,

    manpower_multiplier NUMERIC(8,2) DEFAULT 1,

    sort_order INTEGER DEFAULT 0,

    notes TEXT
);

CREATE TABLE estimate_quantity (
    id BIGSERIAL PRIMARY KEY,

    estimate_line_id BIGINT REFERENCES estimate_line(id),

    room_id BIGINT REFERENCES room(id),

    quantity NUMERIC(12,2) DEFAULT 0
);

CREATE TABLE estimate_supplier_quote (
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

CREATE INDEX idx_estimate_supplier_quote_estimate
    ON estimate_supplier_quote(estimate_id, active, expires_on);
