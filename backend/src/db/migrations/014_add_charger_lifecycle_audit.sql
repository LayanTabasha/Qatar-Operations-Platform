ALTER TABLE chargers
ADD COLUMN previous_status text,
ADD COLUMN archived_at timestamptz,
ADD COLUMN archived_by uuid REFERENCES users(id) ON DELETE RESTRICT,
ADD COLUMN restored_at timestamptz,
ADD COLUMN restored_by uuid REFERENCES users(id) ON DELETE RESTRICT,
ADD COLUMN deleted_at timestamptz,
ADD COLUMN deleted_by uuid REFERENCES users(id) ON DELETE RESTRICT;

ALTER TABLE chargers
ADD CONSTRAINT chargers_previous_status_check
CHECK (previous_status IS NULL OR previous_status IN ('active', 'maintenance', 'faulted'));
