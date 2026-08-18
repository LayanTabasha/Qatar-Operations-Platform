import { query, withTransaction } from "../../config/database.js";
import { insertActivityLog } from "../activity-logs/activity-logs.repository.js";

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
    chargers.operator,
    chargers.administrator,
    chargers.installation_date,
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
    chargers.archived_by,
    chargers.archive_reason,
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
  const filters = ["chargers.deleted_at IS NULL", "sites.status = 'active'"];

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
        AND chargers.status <> 'archived'
        AND sites.status = 'active'
      LIMIT 1
    `,
    [id],
  );

  return result.rows[0] || null;
}

export async function findAnyChargerById(id) {
  const result = await query(
    `${chargerSummarySelect} WHERE chargers.id = $1 AND chargers.deleted_at IS NULL LIMIT 1`,
    [id],
  );
  return result.rows[0] || null;
}

export async function listArchivedChargers() {
  const result = await query(`
    SELECT chargers.id, chargers.name, chargers.code, chargers.site_id, sites.name AS site_name,
      chargers.status, chargers.previous_status, chargers.archived_at, chargers.archived_by,
      users.full_name AS archived_by_name, chargers.archive_reason,
      COALESCE(visits.count, 0)::integer AS site_visit_count,
      COALESCE(faults.count, 0)::integer AS fault_count,
      COALESCE(documents.count, 0)::integer AS document_count,
      COALESCE(troubleshooting.count, 0)::integer AS troubleshooting_count,
      chargers.created_at, chargers.updated_at
    FROM chargers
    JOIN sites ON sites.id = chargers.site_id
    LEFT JOIN users ON users.id = chargers.archived_by
    LEFT JOIN (SELECT charger_id, COUNT(*) AS count FROM site_visits WHERE charger_id IS NOT NULL GROUP BY charger_id) visits ON visits.charger_id = chargers.id
    LEFT JOIN (SELECT charger_id, COUNT(*) AS count FROM faults GROUP BY charger_id) faults ON faults.charger_id = chargers.id
    LEFT JOIN (SELECT charger_id, COUNT(*) AS count FROM documents WHERE charger_id IS NOT NULL GROUP BY charger_id) documents ON documents.charger_id = chargers.id
    LEFT JOIN (SELECT charger_id, COUNT(*) AS count FROM troubleshooting_records WHERE charger_id IS NOT NULL GROUP BY charger_id) troubleshooting ON troubleshooting.charger_id = chargers.id
    WHERE chargers.status = 'archived' AND chargers.deleted_at IS NULL
    ORDER BY chargers.archived_at DESC NULLS LAST, chargers.name ASC
  `);
  return result.rows;
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
        operator,
        administrator,
        installation_date,
        model,
        serial_number,
        type,
        power_kw,
        firmware_version,
        description,
        image_path
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING id
    `,
    [
      charger.site_id,
      charger.name,
      charger.code,
      charger.manufacturer ?? null,
      charger.operator ?? null,
      charger.administrator ?? null,
      charger.installation_date ?? null,
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

export async function archiveChargerById(id, userId, previousStatus, reason, audit) {
  return withTransaction(async (client) => {
    const result = await client.query(
      `UPDATE chargers SET status = 'archived', previous_status = $2, archived_at = now(),
        archived_by = $3, archive_reason = $4
       WHERE id = $1 AND status <> 'archived' AND deleted_at IS NULL RETURNING *`,
      [id, previousStatus, userId, reason || null],
    );
    const charger = result.rows[0];
    if (!charger) return null;
    await insertActivityLog(client, {
      userId, action: "charger_archived", entityType: "charger", entityId: id,
      description: `Archived charger ${charger.name}`,
      context: { charger_name: charger.name, site_id: charger.site_id, archive_reason: reason || null }, ...audit,
    });
    return charger;
  });
}

export async function restoreChargerById(id, userId, audit) {
  return withTransaction(async (client) => {
    const result = await client.query(
      `UPDATE chargers SET status = 'active', restored_at = now(), restored_by = $2,
        archived_at = NULL, archived_by = NULL, archive_reason = NULL, previous_status = NULL
       WHERE id = $1 AND status = 'archived' AND deleted_at IS NULL RETURNING *`,
      [id, userId],
    );
    const charger = result.rows[0];
    if (!charger) return null;
    await insertActivityLog(client, {
      userId, action: "charger_restored", entityType: "charger", entityId: id,
      description: `Restored charger ${charger.name}`,
      context: { charger_name: charger.name, site_id: charger.site_id }, ...audit,
    });
    return charger;
  });
}

export async function permanentlyDeleteChargerById(id, userId, audit) {
  return withTransaction(async (client) => {
    const chargerResult = await client.query("SELECT * FROM chargers WHERE id = $1 AND deleted_at IS NULL FOR UPDATE", [id]);
    const charger = chargerResult.rows[0];
    if (!charger) return { state: "not_found" };
    if (charger.status !== "archived") return { state: "not_archived" };
    const countsResult = await client.query(
      `SELECT
        (SELECT COUNT(*) FROM site_visits WHERE charger_id = $1)::integer AS site_visits,
        (SELECT COUNT(*) FROM faults WHERE charger_id = $1)::integer AS faults,
        (SELECT COUNT(*) FROM documents WHERE charger_id = $1)::integer AS documents,
        (SELECT COUNT(*) FROM troubleshooting_records WHERE charger_id = $1)::integer AS troubleshooting_records`,
      [id],
    );
    const dependencies = countsResult.rows[0];
    if (Object.values(dependencies).some((count) => count > 0)) return { state: "dependencies", dependencies };
    await client.query("DELETE FROM chargers WHERE id = $1", [id]);
    await insertActivityLog(client, {
      userId, action: "charger_permanently_deleted", entityType: "charger", entityId: id,
      description: `Permanently deleted archived charger ${charger.name}`,
      context: { charger_name: charger.name, charger_code: charger.code, site_id: charger.site_id }, ...audit,
    });
    return { state: "deleted", charger };
  });
}
