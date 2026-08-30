ALTER TABLE site_visits
DROP CONSTRAINT site_visits_status_check,
ADD CONSTRAINT site_visits_status_check
CHECK (status IN ('scheduled', 'completed', 'follow_up_required'));
