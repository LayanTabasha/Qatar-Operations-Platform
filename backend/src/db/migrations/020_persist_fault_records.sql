CREATE SEQUENCE fault_reference_seq;

ALTER TABLE faults
ADD COLUMN fault_reference text,
ADD COLUMN ftb_code text,
ADD COLUMN component text,
ADD COLUMN category text,
ADD COLUMN technical_category text,
ADD COLUMN possible_causes text,
ADD COLUMN recommended_actions text,
ADD COLUMN priority text NOT NULL DEFAULT 'medium',
ADD COLUMN charger_status text,
ADD COLUMN reported_by_name text,
ADD COLUMN comments text,
ADD COLUMN updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN archived_at timestamptz,
ADD COLUMN archived_by uuid REFERENCES users(id) ON DELETE SET NULL;

UPDATE faults
SET fault_reference = 'FLT-' || to_char(reported_at, 'YYYY') || '-' || lpad(nextval('fault_reference_seq')::text, 6, '0')
WHERE fault_reference IS NULL;

ALTER TABLE faults
ALTER COLUMN fault_reference SET NOT NULL,
ALTER COLUMN fault_reference SET DEFAULT ('FLT-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('fault_reference_seq')::text, 6, '0')),
DROP CONSTRAINT faults_severity_check,
ADD CONSTRAINT faults_severity_check CHECK (severity IN ('low', 'medium', 'high', 'critical', 'not_classified')),
ADD CONSTRAINT faults_priority_check CHECK (priority IN ('low', 'medium', 'high', 'critical')),
ADD CONSTRAINT faults_reference_unique UNIQUE (fault_reference);

CREATE INDEX idx_faults_active_filters
ON faults(site_id, charger_id, status, reported_at DESC)
WHERE archived_at IS NULL;

