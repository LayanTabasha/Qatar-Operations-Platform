import { query } from "../../config/database.js";

const userSelect = `
  SELECT
    users.id,
    users.full_name,
    users.email,
    users.is_active,
    roles.name AS role
  FROM users
  JOIN roles ON roles.id = users.role_id
`;

export async function listUsers({ limit = 100 } = {}) {
  const result = await query(
    `
      ${userSelect}
      ORDER BY users.full_name ASC
      LIMIT $1
    `,
    [limit],
  );

  return result.rows;
}

export async function findRoleByName(name) {
  const result = await query("SELECT id, name FROM roles WHERE name = $1 LIMIT 1", [name]);
  return result.rows[0] || null;
}

export async function createUser({ full_name, email, password_hash, role_id }) {
  const result = await query(
    `
      INSERT INTO users (full_name, email, password_hash, role_id)
      VALUES ($1, $2, $3, $4)
      RETURNING id, full_name, email, is_active
    `,
    [full_name, email, password_hash, role_id],
  );

  return result.rows[0];
}
