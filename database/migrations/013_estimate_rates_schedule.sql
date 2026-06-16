ALTER TABLE project
    ADD COLUMN IF NOT EXISTS probable_schedule VARCHAR(255);

ALTER TABLE estimate
    ADD COLUMN IF NOT EXISTS used_hourly_rate NUMERIC(12, 2),
    ADD COLUMN IF NOT EXISTS global_profit_percent NUMERIC(6, 2);

ALTER TABLE estimate_line
    ADD COLUMN IF NOT EXISTS profit_forced BOOLEAN DEFAULT FALSE;
