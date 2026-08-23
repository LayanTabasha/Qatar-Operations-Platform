CREATE TABLE documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid REFERENCES sites(id) ON DELETE SET NULL,
  charger_id uuid REFERENCES chargers(id) ON DELETE SET NULL,
  document_type text NOT NULL,
  title text NOT NULL,
  description text,
  original_filename text NOT NULL,
  stored_filename text NOT NULL,
  storage_path text NOT NULL,
  mime_type text NOT NULL,
  file_size_bytes bigint NOT NULL,
  uploaded_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT documents_file_size_positive CHECK (file_size_bytes > 0),
  CONSTRAINT documents_owner_check CHECK (site_id IS NOT NULL OR charger_id IS NOT NULL OR document_type = 'general')
);

CREATE TRIGGER documents_set_updated_at
BEFORE UPDATE ON documents
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
