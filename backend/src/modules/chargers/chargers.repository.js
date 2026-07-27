import { query } from "../../config/database.js";

const sortColumns = {
  name: "chargers.name",
  code: "chargers.code",
  created_at: "chargers.created_at",
  updated_at: "chargers.updated_at",
  power_kw: "chargers.power_kw",
};

const chargerSummarySelect = `
  SELECT
    chargers.id,
    chargers.site_id,
    sites.name AS site_name,
    chargers.name,
    chargers.code,
    chargers.manufacturer,
    chargers.model,
    chargers.serial_number,
    chargers.type,
    chargers.power_kw,
    chargers.firmware_version,
    chargers.description,
    chargers.image_path,
    chargers.status,
    chargers.previous_status,
    chargers.archived_at,
    archived_by_user.full_name AS archived_by_name,
    chargers.restored_at,
    restored_by_user.full_name AS restored_by_name,
    chargers.deleted_at,
    deleted_by_user.full_name AS deleted_by_name,
    COALESCE(fault_counts.open_fault_count, 0)::integer AS open_fault_count,
    visit_counts.last_site_visit,
    chargers.created_at,
    chargers.updated_at
  FROM chargers
  JOIN sites ON sites.id = chargers.site_id
  LEFT JOIN users archived_by_user ON archived_by_user.id = chargers.archived_by
  LEFT JOIN users restored_by_user ON restored_by_user.id = chargers.restored_by
  LEFT JOIN users deleted_by_user ON deleted_by_user.id = chargers.deleted_by
  LEFT JOIN (
    SELECT charger_id, COUNT(*)::integer AS open_fault_count
    FROM faults
    WHERE status IN ('open', 'in_progress')
    GROUP BY charger_id
  ) fault_counts ON fault_counts.charger_id = chargers.id
  LEFT JOIN (
    SELECT charger_id, MAX(visit_date) AS last_site_visit
    FROM site_visits
    WHERE charger_id IS NOT NULL
    GROUP BY charger_id
  ) visit_counts ON visit_counts.charger_id = chargers.id
`;

export async function listChargers({ site_id, status, type, search, sort, order, limit }) {
  const values = [];
  const filters = ["chargers.deleted_at IS NULL"];

  if (site_id) {
    values.push(site_id);
    filters.push(`chargers.site_id = $${values.length}`);
  }

  if (status) {
    values.push(status);
    filters.push(`chargers.status = $${values.length}`);
  } else {
    filters.push("chargers.status = 'active'");
  }

  if (type) {
    values.push(type);
    filters.push(`chargers.type = $${values.length}`);
  }

  if (search) {
    values.push(`%${search}%`);
    filters.push(`(
      chargers.name ILIKE $${values.length}
      OR chargers.code ILIKE $${values.length}
      OR chargers.model ILIKE $${values.length}
      OR chargers.manufacturer ILIKE $${values.length}
      OR chargers.serial_number ILIKE $${values.length}
    )`);
  }

  values.push(limit);

  const sortColumn = sortColumns[sort] || sortColumns.name;
  const sortOrder = order === "desc" ? "DESC" : "ASC";
  const whereClause = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";

  const result = await query(
    `
      ${chargerSummarySelect}
      ${whereClause}
      ORDER BY ${sortColumn} ${sortOrder}, chargers.name ASC
      LIMIT $${values.length}
    `,
    values,
  );

  return result.rows;
}

export async function findChargerById(id) {
  const result = await query(
    `
      ${chargerSummarySelect}
      WHERE chargers.id = $1
        AND chargers.deleted_at IS NULL
      LIMIT 1
    `,
    [id],
  );

  return result.rows[0] || null;
}

export async function findDeletedChargerById(id) {
  const result = await query(
    `
      ${chargerSummarySelect}
      WHERE chargers.id = $1
        AND chargers.deleted_at IS NOT NULL
      LIMIT 1
    `,
    [id],
  );

  return result.rows[0] || null;
}

export async function insertCharger(charger) {
  const result = await query(
    `
      INSERT INTO chargers (
        site_id,
        name,
        code,
        manufacturer,
        model,
        serial_number,
        type,
        power_kw,
        firmware_version,
        description,
        image_path
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id
    `,
    [
      charger.site_id,
      charger.name,
      charger.code,
      charger.manufacturer ?? null,
      charger.model ?? null,
      charger.serial_number ?? null,
      charger.type,
      charger.power_kw,
      charger.firmware_version ?? null,
      charger.description ?? null,
      charger.image_path ?? null,
    ],
  );

  return findChargerById(result.rows[0].id);
}

export async function updateChargerById(id, updates) {
  const entries = Object.entries(updates);
  const setClauses = entries.map(([column], index) => `${column} = $${index + 2}`);
  const values = [id, ...entries.map(([, value]) => value ?? null)];

  const result = await query(
    `
      UPDATE chargers
      SET ${setClauses.join(", ")}
      WHERE id = $1
      RETURNING id
    `,
    values,
  );

  if (result.rowCount === 0) {
    return null;
  }

  return findChargerById(result.rows[0].id);
}

export async function updateChargerStatusById(id, status) {
  const result = await query(
    `
      UPDATE chargers
      SET status = $2
      WHERE id = $1
      RETURNING id
    `,
    [id, status],
  );

  if (result.rowCount === 0) {
    return null;
  }

  return findChargerById(result.rows[0].id);
}

export async function archiveChargerById(id, userId, previousStatus) {
  const result = await query(
    `
      UPDATE chargers
      SET status = 'archived',
          previous_status = $2,
          archived_at = now(),
          archived_by = $3
      WHERE id = $1
        AND deleted_at IS NULL
      RETURNING id
    `,
    [id, previousStatus, userId],
  );

  return result.rows[0] ? findChargerById(result.rows[0].id) : null;
}

export async function restoreChargerById(id, userId) {
  const result = await query(
    `
      UPDATE chargers
      SET status = 'active',
          restored_at = now(),
          restored_by = $2
      WHERE id = $1
        AND status = 'archived'
        AND deleted_at IS NULL
      RETURNING id
    `,
    [id, userId],
  );

  return result.rows[0] ? findChargerById(result.rows[0].id) : null;
}

export async function softDeleteArchivedChargerById(id, userId) {
  const result = await query(
    `
      UPDATE chargers
      SET deleted_at = now(),
          deleted_by = $2
      WHERE id = $1
        AND status = 'archived'
        AND deleted_at IS NULL
      RETURNING id
    `,
    [id, userId],
  );

  return result.rows[0] ? findDeletedChargerById(result.rows[0].id) : null;
}
