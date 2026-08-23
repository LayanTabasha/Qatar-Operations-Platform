ALTER TABLE operational_attachments
ADD COLUMN parent_type text,
ADD COLUMN parent_record_id text;

UPDATE operational_attachments
SET parent_type = 'site-visits', parent_record_id = site_visit_id::text
WHERE parent_type IS NULL;

ALTER TABLE operational_attachments
ALTER COLUMN parent_type SET NOT NULL,
ALTER COLUMN parent_record_id SET NOT NULL,
ALTER COLUMN site_visit_id DROP NOT NULL;

ALTER TABLE operational_attachments
ADD CONSTRAINT operational_attachments_parent_type_check
CHECK (parent_type IN ('site-visits', 'documents', 'faults', 'weekly-reports', 'troubleshooting')),
ADD CONSTRAINT operational_attachments_site_visit_parent_check
CHECK ((parent_type = 'site-visits') = (site_visit_id IS NOT NULL));

CREATE INDEX idx_operational_attachments_parent
ON operational_attachments(parent_type, parent_record_id);
