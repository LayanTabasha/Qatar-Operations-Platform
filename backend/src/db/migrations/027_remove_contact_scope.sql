ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_scope_site_check;
ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_scope_check;
DROP INDEX IF EXISTS idx_contacts_scope;
ALTER TABLE contacts DROP COLUMN IF EXISTS scope;
