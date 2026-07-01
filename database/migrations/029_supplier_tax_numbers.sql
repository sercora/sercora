ALTER TABLE supplier
    ADD COLUMN IF NOT EXISTS phone TEXT;

ALTER TABLE supplier
    ADD COLUMN IF NOT EXISTS fax TEXT;

ALTER TABLE supplier
    ADD COLUMN IF NOT EXISTS mobile TEXT;

ALTER TABLE supplier
    ADD COLUMN IF NOT EXISTS billing_address TEXT;

ALTER TABLE supplier
    ADD COLUMN IF NOT EXISTS billing_postal_code VARCHAR(20);

ALTER TABLE supplier
    ADD COLUMN IF NOT EXISTS federal_tax_number VARCHAR(80);

ALTER TABLE supplier
    ADD COLUMN IF NOT EXISTS provincial_tax_number VARCHAR(80);
