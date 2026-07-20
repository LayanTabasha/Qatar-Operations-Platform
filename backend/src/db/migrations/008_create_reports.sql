CREATE TABLE reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid REFERENCES sites(id) ON DELETE SET NULL,
  report_type text NOT NULL,
  title text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  notes text,
  generated_file_path text,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reports_type_check CHECK (report_type IN ('weekly', 'monthly', 'site_visit', 'custom')),
  CONSTRAINT reports_period_order_check CHECK (period_end >= period_start)
);

CREATE TRIGGER reports_set_updated_at
BEFORE UPDATE ON reports
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
