ALTER TABLE sites
ADD COLUMN archived_at timestamptz,
ADD COLUMN archived_by uuid REFERENCES users(id) ON DELETE RESTRICT,
ADD COLUMN archive_reason text;

ALTER TABLE chargers
ADD COLUMN archive_reason text;

CREATE INDEX idx_sites_archived_at
ON sites(archived_at DESC)
WHERE status = 'archived';

CREATE INDEX idx_chargers_archived_at
ON chargers(archived_at DESC)
WHERE status = 'archived' AND deleted_at IS NULL;
