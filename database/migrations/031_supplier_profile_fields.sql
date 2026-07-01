ALTER TABLE supplier
    ADD COLUMN IF NOT EXISTS email TEXT;

ALTER TABLE supplier
    ADD COLUMN IF NOT EXISTS contact_name TEXT;

ALTER TABLE supplier
    ADD COLUMN IF NOT EXISTS account_number VARCHAR(100);

ALTER TABLE supplier
    ADD COLUMN IF NOT EXISTS website TEXT;

ALTER TABLE supplier
    ADD COLUMN IF NOT EXISTS company_name TEXT;

ALTER TABLE supplier
    ADD COLUMN IF NOT EXISTS tax_identification_number VARCHAR(100);
