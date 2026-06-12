CREATE TABLE labor_type (
    id SERIAL PRIMARY KEY,

    name VARCHAR(100) UNIQUE NOT NULL,

    active BOOLEAN DEFAULT TRUE
);

CREATE TABLE project (
    id BIGSERIAL PRIMARY KEY,

    project_number VARCHAR(50),

    project_name VARCHAR(255) NOT NULL,

    status VARCHAR(50) DEFAULT 'PENDING',

    start_date DATE,
    end_date DATE,

    tile_holdback_percent NUMERIC(6,2),

    warranty_years INTEGER,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE project_client (
    id BIGSERIAL PRIMARY KEY,

    project_id BIGINT REFERENCES project(id),

    client_id BIGINT REFERENCES client(id)
);

CREATE TABLE labor_rate (
    id BIGSERIAL PRIMARY KEY,

    project_id BIGINT REFERENCES project(id),

    labor_type_id INTEGER REFERENCES labor_type(id),

    hourly_rate NUMERIC(12,2)
);

CREATE TABLE estimate (
    id BIGSERIAL PRIMARY KEY,

    project_id BIGINT REFERENCES project(id),

    parent_estimate_id BIGINT REFERENCES estimate(id),

    revision_number INTEGER NOT NULL,

    estimate_type VARCHAR(50),

    billable_to_client BOOLEAN,

    description TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
