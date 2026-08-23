ALTER TABLE site_visits
ADD COLUMN status text NOT NULL DEFAULT 'completed';

ALTER TABLE site_visits
ADD COLUMN updated_by uuid REFERENCES users(id) ON DELETE RESTRICT;

ALTER TABLE site_visits
ADD CONSTRAINT site_visits_status_check
CHECK (status IN ('scheduled', 'ongoing', 'completed', 'cancelled', 'follow_up_required'));
