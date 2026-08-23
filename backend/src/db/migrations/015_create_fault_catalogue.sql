CREATE TABLE fault_catalogue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dtc_code text NOT NULL,
  dtc_code_normalized text NOT NULL,
  ftb_code text NOT NULL DEFAULT '',
  fault_title text NOT NULL,
  description text,
  possible_causes text,
  recommended_actions text,
  severity text,
  category text,
  charger_model text NOT NULL DEFAULT '',
  component text NOT NULL DEFAULT '',
  source_version text,
  source_sheet text,
  source_row integer,
  manufacturer_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  imported_at timestamptz,
  imported_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fault_catalogue_dtc_code_not_blank CHECK (btrim(dtc_code) <> ''),
  CONSTRAINT fault_catalogue_fault_title_not_blank CHECK (btrim(fault_title) <> ''),
  CONSTRAINT fault_catalogue_source_row_positive CHECK (source_row IS NULL OR source_row > 0)
);

CREATE UNIQUE INDEX fault_catalogue_unique_scope
ON fault_catalogue (dtc_code_normalized, ftb_code, charger_model, component);

CREATE INDEX idx_fault_catalogue_dtc_code ON fault_catalogue(dtc_code_normalized);
CREATE INDEX idx_fault_catalogue_fault_title ON fault_catalogue(fault_title);
CREATE INDEX idx_fault_catalogue_category ON fault_catalogue(category);
CREATE INDEX idx_fault_catalogue_charger_model ON fault_catalogue(charger_model);
CREATE INDEX idx_fault_catalogue_is_active ON fault_catalogue(is_active);

CREATE TRIGGER fault_catalogue_set_updated_at
BEFORE UPDATE ON fault_catalogue
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

ALTER TABLE faults
ADD COLUMN fault_catalogue_id uuid REFERENCES fault_catalogue(id) ON DELETE SET NULL,
ADD COLUMN catalogue_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
ADD COLUMN technician_observation text;

CREATE INDEX idx_faults_fault_catalogue_id ON faults(fault_catalogue_id);
