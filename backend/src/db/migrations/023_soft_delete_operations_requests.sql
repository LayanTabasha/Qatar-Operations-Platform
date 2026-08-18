ALTER TABLE requests
ADD COLUMN deleted_at timestamptz,
ADD COLUMN deleted_by uuid REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX idx_requests_active_created_at
ON requests(created_at DESC)
WHERE deleted_at IS NULL;
