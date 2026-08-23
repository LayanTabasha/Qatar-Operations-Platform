INSERT INTO roles (name, description)
VALUES ('hq_user', 'HQ request processing access only')
ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description;

CREATE SEQUENCE request_reference_seq;

CREATE TABLE requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_reference text NOT NULL UNIQUE DEFAULT
    ('REQ-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('request_reference_seq')::text, 6, '0')),
  title text NOT NULL,
  description text NOT NULL,
  category text,
  priority text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  site_id uuid REFERENCES sites(id) ON DELETE SET NULL,
  charger_id uuid REFERENCES chargers(id) ON DELETE SET NULL,
  requested_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  assigned_to uuid REFERENCES users(id) ON DELETE SET NULL,
  due_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  hq_response text,
  responded_by uuid REFERENCES users(id) ON DELETE SET NULL,
  responded_at timestamptz,
  CONSTRAINT requests_category_check CHECK (category IS NULL OR category IN
    ('firmware', 'software', 'configuration', 'network', 'hardware', 'documentation', 'other')),
  CONSTRAINT requests_priority_check CHECK (priority IN ('low', 'medium', 'high')),
  CONSTRAINT requests_status_check CHECK (status IN ('open', 'in_progress', 'completed'))
);

CREATE TRIGGER requests_set_updated_at
BEFORE UPDATE ON requests
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_requests_status ON requests(status);
CREATE INDEX idx_requests_priority ON requests(priority);
CREATE INDEX idx_requests_site_id ON requests(site_id);
CREATE INDEX idx_requests_charger_id ON requests(charger_id);
CREATE INDEX idx_requests_assigned_to ON requests(assigned_to);
CREATE INDEX idx_requests_created_at ON requests(created_at DESC);
CREATE INDEX idx_requests_due_date ON requests(due_date);

ALTER TABLE operational_attachments
DROP CONSTRAINT operational_attachments_parent_type_check,
ADD CONSTRAINT operational_attachments_parent_type_check
CHECK (parent_type IN ('site-visits', 'documents', 'faults', 'weekly-reports', 'troubleshooting', 'requests'));
