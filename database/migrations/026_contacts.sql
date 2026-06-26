CREATE TABLE contact_type (
    id SERIAL PRIMARY KEY,

    code VARCHAR(50) UNIQUE NOT NULL,

    name VARCHAR(100) UNIQUE NOT NULL,

    active BOOLEAN DEFAULT TRUE
);

CREATE TABLE contact_task (
    id SERIAL PRIMARY KEY,

    code VARCHAR(50) UNIQUE NOT NULL,

    name VARCHAR(100) UNIQUE NOT NULL,

    sort_order INTEGER DEFAULT 0,

    active BOOLEAN DEFAULT TRUE
);

CREATE TABLE contact (
    id BIGSERIAL PRIMARY KEY,

    contact_type_id INTEGER NOT NULL REFERENCES contact_type(id),

    client_id BIGINT REFERENCES client(id) ON DELETE SET NULL,

    supplier_id BIGINT REFERENCES supplier(id) ON DELETE SET NULL,

    name VARCHAR(255) NOT NULL,

    title VARCHAR(255),

    email VARCHAR(255),

    phone VARCHAR(80),

    mobile VARCHAR(80),

    active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_contact_owner CHECK (
        (
            CASE WHEN client_id IS NOT NULL THEN 1 ELSE 0 END
        ) + (
            CASE WHEN supplier_id IS NOT NULL THEN 1 ELSE 0 END
        ) = 1
    )
);

CREATE TABLE contact_task_link (
    contact_id BIGINT NOT NULL REFERENCES contact(id) ON DELETE CASCADE,

    contact_task_id INTEGER NOT NULL REFERENCES contact_task(id) ON DELETE CASCADE,

    PRIMARY KEY (contact_id, contact_task_id)
);

CREATE INDEX idx_contact_type_active_name
    ON contact(contact_type_id, active, name);

CREATE INDEX idx_contact_client_active_name
    ON contact(client_id, active, name);

CREATE INDEX idx_contact_supplier_active_name
    ON contact(supplier_id, active, name);

INSERT INTO contact_type (code, name)
VALUES
('client', 'Clients'),
('supplier', 'Fournisseurs')
ON CONFLICT (code) DO NOTHING;

INSERT INTO contact_task (code, name, sort_order)
VALUES
('payables', 'Payables', 10),
('commande', 'Commande', 20),
('estimation', 'Estimation', 30),
('direction', 'Direction', 40),
('projets', 'Projets', 50)
ON CONFLICT (code) DO NOTHING;
