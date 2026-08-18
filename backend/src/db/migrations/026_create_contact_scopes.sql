CREATE TABLE IF NOT EXISTS contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid REFERENCES sites(id) ON DELETE RESTRICT,
  scope text NOT NULL DEFAULT 'specific_site',
  contact_name text NOT NULL,
  organization text,
  job_title text,
  email text,
  phone text,
  contact_type text,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE contacts ALTER COLUMN site_id DROP NOT NULL;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS scope text;
UPDATE contacts SET scope = CASE WHEN site_id IS NOT NULL THEN 'specific_site' ELSE 'external' END WHERE scope IS NULL;
ALTER TABLE contacts ALTER COLUMN scope SET DEFAULT 'specific_site';
ALTER TABLE contacts ALTER COLUMN scope SET NOT NULL;

ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_scope_check;
ALTER TABLE contacts ADD CONSTRAINT contacts_scope_check
  CHECK (scope IN ('all_sites', 'specific_site', 'external'));
ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_scope_site_check;
ALTER TABLE contacts ADD CONSTRAINT contacts_scope_site_check
  CHECK ((scope = 'specific_site' AND site_id IS NOT NULL) OR (scope IN ('all_sites', 'external') AND site_id IS NULL));

CREATE INDEX IF NOT EXISTS idx_contacts_site_id ON contacts(site_id);
CREATE INDEX IF NOT EXISTS idx_contacts_scope ON contacts(scope);
