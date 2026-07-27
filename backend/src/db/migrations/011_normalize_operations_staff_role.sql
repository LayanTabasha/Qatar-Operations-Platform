INSERT INTO roles (name, description)
VALUES ('operations_staff', 'Full operational access without user or role management')
ON CONFLICT (name) DO UPDATE
SET description = EXCLUDED.description;

UPDATE users
SET role_id = (SELECT id FROM roles WHERE name = 'operations_staff')
WHERE role_id IN (SELECT id FROM roles WHERE name = 'operator');

DELETE FROM roles
WHERE name = 'operator'
  AND NOT EXISTS (
    SELECT 1
    FROM users
    WHERE users.role_id = roles.id
  );
