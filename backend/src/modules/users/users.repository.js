import { query } from "../../config/database.js";

const userSelect = `
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

export async function findUserById(id) {
  const result = await query(
    `
      ${userSelect}
      WHERE users.id = $1
      LIMIT 1
    `,
    [id],
  );

  return result.rows[0] || null;
}

export async function countActiveAdmins() {
  const result = await query(
    `
      SELECT count(*)::int AS count
      FROM users
      JOIN roles ON roles.id = users.role_id
      WHERE roles.name = 'admin'
        AND users.is_active = true
    `,
  );

  return result.rows[0]?.count || 0;
}

export async function createUser({ full_name, email, password_hash, role_id }) {
  const result = await query(
    `
      INSERT INTO users (full_name, email, password_hash, role_id)
      VALUES ($1, $2, $3, $4)
      RETURNING id, full_name, email, is_active, last_login_at, created_at, updated_at
    `,
    [full_name, email, password_hash, role_id],
  );

  return result.rows[0];
}

export async function updateUserById(id, updates) {
  const assignments = [];
  const values = [];

  if (updates.full_name !== undefined) {
    values.push(updates.full_name);
    assignments.push(`full_name = $${values.length}`);
  }

  if (updates.role_id !== undefined) {
    values.push(updates.role_id);
    assignments.push(`role_id = $${values.length}`);
  }

  values.push(id);

  const result = await query(
    `
      UPDATE users
      SET ${assignments.join(", ")}
      WHERE id = $${values.length}
      RETURNING id
    `,
    values,
  );

  return result.rows[0] ? findUserById(id) : null;
}

export async function updateUserStatusById(id, isActive) {
  const result = await query(
    `
      UPDATE users
      SET is_active = $2
      WHERE id = $1
      RETURNING id
    `,
    [id, isActive],
  );

  return result.rows[0] ? findUserById(id) : null;
}

export async function updateUserPasswordById(id, passwordHash) {
  const result = await query(
    `
      UPDATE users
      SET password_hash = $2
      WHERE id = $1
      RETURNING id
    `,
    [id, passwordHash],
  );

  return result.rows[0] ? findUserById(id) : null;
}
