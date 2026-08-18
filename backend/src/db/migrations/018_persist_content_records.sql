ALTER TABLE documents
ALTER COLUMN original_filename DROP NOT NULL,
ALTER COLUMN stored_filename DROP NOT NULL,
ALTER COLUMN storage_path DROP NOT NULL,
ALTER COLUMN mime_type DROP NOT NULL,
ALTER COLUMN file_size_bytes DROP NOT NULL;

ALTER TABLE documents ADD COLUMN document_date date NOT NULL DEFAULT CURRENT_DATE;

CREATE TABLE troubleshooting_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid REFERENCES sites(id) ON DELETE SET NULL,
  charger_id uuid REFERENCES chargers(id) ON DELETE SET NULL,
  title text NOT NULL,
  issue_category text NOT NULL,
  symptoms text,
  possible_cause text,
  troubleshooting_steps text,
  resolution text,
  notes text,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER troubleshooting_records_set_updated_at
BEFORE UPDATE ON troubleshooting_records
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_troubleshooting_records_site_id ON troubleshooting_records(site_id);
CREATE INDEX idx_troubleshooting_records_charger_id ON troubleshooting_records(charger_id);
