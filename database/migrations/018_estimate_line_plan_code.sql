ALTER TABLE estimate_line
    ADD COLUMN IF NOT EXISTS plan_code VARCHAR(80);
