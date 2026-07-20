INSERT INTO roles (name, description)
VALUES
  ('admin', 'Full system administration access'),
  ('manager', 'Operations management access'),
  ('operator', 'Day-to-day operations access'),
  ('viewer', 'Read-only platform access')
ON CONFLICT (name) DO UPDATE
SET description = EXCLUDED.description;
