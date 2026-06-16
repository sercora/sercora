ALTER TABLE estimate_line
    ADD COLUMN IF NOT EXISTS installation_link_source_line_id BIGINT REFERENCES estimate_line(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS installation_link_multiplier NUMERIC(12,4) DEFAULT 1,
    ADD COLUMN IF NOT EXISTS quantity_link_source_line_ids JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS quantity_link_multiplier NUMERIC(12,4) DEFAULT 1;
