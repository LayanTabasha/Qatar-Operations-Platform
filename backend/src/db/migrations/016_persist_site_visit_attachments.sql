CREATE TABLE operational_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_visit_id uuid NOT NULL UNIQUE REFERENCES site_visits(id) ON DELETE CASCADE,
  original_filename text NOT NULL,
  stored_filename text NOT NULL UNIQUE,
  storage_path text NOT NULL UNIQUE,
  mime_type text NOT NULL,
  file_extension text NOT NULL,
  file_size_bytes bigint NOT NULL,
  preview_path text,
  preview_generated_at timestamptz,
  uploaded_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT operational_attachments_file_size_positive CHECK (file_size_bytes > 0)
);

CREATE TRIGGER operational_attachments_set_updated_at
BEFORE UPDATE ON operational_attachments
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_operational_attachments_site_visit_id
ON operational_attachments(site_visit_id);
