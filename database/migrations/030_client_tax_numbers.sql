ALTER TABLE client
    ADD COLUMN IF NOT EXISTS federal_tax_number VARCHAR(80);

ALTER TABLE client
    ADD COLUMN IF NOT EXISTS provincial_tax_number VARCHAR(80);
