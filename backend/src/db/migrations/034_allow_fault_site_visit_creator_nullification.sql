ALTER TABLE fault_site_visits
  ALTER COLUMN created_by DROP NOT NULL,
  DROP CONSTRAINT IF EXISTS fault_site_visits_created_by_fkey;

ALTER TABLE fault_site_visits
  ADD CONSTRAINT fault_site_visits_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
