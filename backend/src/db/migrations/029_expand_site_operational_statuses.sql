ALTER TABLE sites
DROP CONSTRAINT sites_status_check,
ADD CONSTRAINT sites_status_check
CHECK (status IN ('active', 'inactive', 'maintenance', 'archived'));
