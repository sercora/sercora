ALTER TABLE project
    ADD COLUMN IF NOT EXISTS submission_state VARCHAR(30) DEFAULT 'NEW';

ALTER TABLE project
    ADD COLUMN IF NOT EXISTS submission_state_user_id BIGINT;

ALTER TABLE project
    ADD COLUMN IF NOT EXISTS submission_state_updated_at TIMESTAMP;

UPDATE project
SET submission_state = 'NEW'
WHERE submission_state IS NULL;

CREATE INDEX IF NOT EXISTS idx_project_submission_state
    ON project(submission_state, bid_due_date, project_name);
