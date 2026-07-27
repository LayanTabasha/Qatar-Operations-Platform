import { query } from "../../config/database.js";

const safeUserSelect = `
  SELECT
    users.id,
    users.full_name,
    users.email,
    users.is_active,
    users.last_login_at,
    users.created_at,
    users.updated_at,
    roles.name AS role
  FROM users
  JOIN roles ON roles.id = users.role_id
`;

export async function findUserWithPasswordByEmail(email) {
  const result = await query(
    `
      SELECT
        users.id,
        users.full_name,
        users.email,
        users.password_hash,
        users.is_active,
        users.last_login_at,
        users.created_at,
        users.updated_at,
        roles.name AS role
      FROM users
      JOIN roles ON roles.id = users.role_id
      WHERE lower(users.email::text) = lower($1)
      LIMIT 1
    `,
    [email],
  );

  return result.rows[0] || null;
}

export async function findSafeUserById(id) {
  const result = await query(
    `
      ${safeUserSelect}
      WHERE users.id = $1
      LIMIT 1
    `,
    [id],
  );

  return result.rows[0] || null;
}

export async function updateLastLoginAt(id) {
  await query("UPDATE users SET last_login_at = now() WHERE id = $1", [id]);
}
