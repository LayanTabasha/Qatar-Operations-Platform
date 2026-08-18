ALTER TABLE site_visits
  ALTER COLUMN created_by DROP NOT NULL,
  ALTER COLUMN updated_by DROP NOT NULL,
  DROP CONSTRAINT site_visits_created_by_fkey,
  DROP CONSTRAINT site_visits_updated_by_fkey,
  ADD CONSTRAINT site_visits_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  ADD CONSTRAINT site_visits_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE faults
  ALTER COLUMN created_by DROP NOT NULL,
  DROP CONSTRAINT faults_created_by_fkey,
  ADD CONSTRAINT faults_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE documents
  ALTER COLUMN uploaded_by DROP NOT NULL,
  DROP CONSTRAINT documents_uploaded_by_fkey,
  ADD CONSTRAINT documents_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE reports
  ALTER COLUMN created_by DROP NOT NULL,
  DROP CONSTRAINT reports_created_by_fkey,
  ADD CONSTRAINT reports_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE operational_attachments
  ALTER COLUMN uploaded_by DROP NOT NULL,
  DROP CONSTRAINT operational_attachments_uploaded_by_fkey,
  ADD CONSTRAINT operational_attachments_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE troubleshooting_records
  ALTER COLUMN created_by DROP NOT NULL,
  DROP CONSTRAINT troubleshooting_records_created_by_fkey,
  ADD CONSTRAINT troubleshooting_records_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE sites
  DROP CONSTRAINT sites_archived_by_fkey,
  ADD CONSTRAINT sites_archived_by_fkey FOREIGN KEY (archived_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE chargers
  DROP CONSTRAINT chargers_archived_by_fkey,
  DROP CONSTRAINT chargers_restored_by_fkey,
  DROP CONSTRAINT chargers_deleted_by_fkey,
  ADD CONSTRAINT chargers_archived_by_fkey FOREIGN KEY (archived_by) REFERENCES users(id) ON DELETE SET NULL,
  ADD CONSTRAINT chargers_restored_by_fkey FOREIGN KEY (restored_by) REFERENCES users(id) ON DELETE SET NULL,
  ADD CONSTRAINT chargers_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE requests
  ALTER COLUMN requested_by DROP NOT NULL,
  DROP CONSTRAINT requests_requested_by_fkey,
  ADD CONSTRAINT requests_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE SET NULL;
