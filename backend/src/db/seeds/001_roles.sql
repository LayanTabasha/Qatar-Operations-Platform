INSERT INTO roles (name, description)
VALUES
  ('admin', 'Full system administration access'),
  ('operations_staff', 'Full operational access without user or role management'),
  ('viewer', 'Read-only platform access')
ON CONFLICT (name) DO UPDATE
SET description = EXCLUDED.description;
