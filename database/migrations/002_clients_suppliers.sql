CREATE TABLE client_type (
    id SERIAL PRIMARY KEY,

    name VARCHAR(100) UNIQUE NOT NULL,

    active BOOLEAN DEFAULT TRUE
);

CREATE TABLE client (
    id BIGSERIAL PRIMARY KEY,

    client_type_id INTEGER REFERENCES client_type(id),

    name VARCHAR(255) UNIQUE NOT NULL,

    active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE supplier_type (
    id SERIAL PRIMARY KEY,

    name VARCHAR(100) UNIQUE NOT NULL,

    active BOOLEAN DEFAULT TRUE
);

CREATE TABLE supplier (
    id BIGSERIAL PRIMARY KEY,

    supplier_type_id INTEGER REFERENCES supplier_type(id),

    name VARCHAR(255) UNIQUE NOT NULL,

    active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE product_supplier (
    id BIGSERIAL PRIMARY KEY,

    product_id BIGINT REFERENCES product(id),

    supplier_id BIGINT REFERENCES supplier(id),

    supplier_product_code VARCHAR(100)
);
