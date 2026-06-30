ALTER TABLE supplier
    ADD COLUMN IF NOT EXISTS federal_tax_number VARCHAR(80);

ALTER TABLE supplier
    ADD COLUMN IF NOT EXISTS provincial_tax_number VARCHAR(80);
