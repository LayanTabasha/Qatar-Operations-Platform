CREATE TABLE faults (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE RESTRICT,
  charger_id uuid NOT NULL REFERENCES chargers(id) ON DELETE RESTRICT,
  fault_code text,
  fault_type text NOT NULL,
  title text NOT NULL,
  description text,
  severity text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'open',
  reported_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolution_notes text,
  requires_site_visit boolean NOT NULL DEFAULT false,
  photo_path text,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  assigned_to uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT faults_status_check CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  CONSTRAINT faults_severity_check CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  CONSTRAINT faults_resolved_at_check CHECK (resolved_at IS NULL OR resolved_at >= reported_at)
);

CREATE TRIGGER faults_set_updated_at
BEFORE UPDATE ON faults
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
