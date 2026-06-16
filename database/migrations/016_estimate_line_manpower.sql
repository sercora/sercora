ALTER TABLE estimate_line
    ADD COLUMN IF NOT EXISTS manpower_multiplier NUMERIC(8,2) DEFAULT 1;
