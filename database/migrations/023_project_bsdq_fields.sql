ALTER TABLE project
    ADD COLUMN IF NOT EXISTS bsdq_project_number VARCHAR(80);

ALTER TABLE project
    ADD COLUMN IF NOT EXISTS bsdq_due_time VARCHAR(10);

CREATE INDEX IF NOT EXISTS idx_project_bsdq_project_number
    ON project(bsdq_project_number)
    WHERE bsdq_project_number IS NOT NULL;
