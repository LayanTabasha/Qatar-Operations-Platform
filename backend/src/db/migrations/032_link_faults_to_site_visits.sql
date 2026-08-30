ALTER TABLE faults DROP CONSTRAINT IF EXISTS faults_status_check;
ALTER TABLE faults
  ADD CONSTRAINT faults_status_check
  CHECK (status IN ('open', 'in_progress', 'monitoring', 'resolved'));

CREATE TABLE fault_site_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fault_id uuid NOT NULL REFERENCES faults(id) ON DELETE CASCADE,
  site_visit_id uuid NOT NULL REFERENCES site_visits(id) ON DELETE CASCADE,
  progress_update text,
  status_after_visit text NOT NULL,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fault_site_visits_unique_link UNIQUE (fault_id, site_visit_id),
  CONSTRAINT fault_site_visits_status_check
    CHECK (status_after_visit IN ('open', 'in_progress', 'monitoring', 'resolved'))
);

CREATE INDEX fault_site_visits_fault_id_idx ON fault_site_visits(fault_id);
CREATE INDEX fault_site_visits_site_visit_id_idx ON fault_site_visits(site_visit_id);

CREATE TRIGGER fault_site_visits_set_updated_at
BEFORE UPDATE ON fault_site_visits
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
