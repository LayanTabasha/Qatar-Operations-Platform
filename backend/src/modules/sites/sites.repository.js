import { query, withTransaction } from "../../config/database.js";
import { insertActivityLog } from "../activity-logs/activity-logs.repository.js";

const sortColumns = {
  name: "sites.name",
  created_at: "sites.created_at",
  updated_at: "sites.updated_at",
};

const siteSummarySelect = `
  SELECT
    sites.id,
    sites.name,
    sites.code,
    sites.location,
    sites.address,
    sites.description,
    sites.image_path,
    sites.status,
    sites.archived_at,
    sites.archive_reason,
    sites.archived_by,
    archived_by_user.full_name AS archived_by_name,
    COALESCE(charger_counts.charger_count, 0)::integer AS charger_count,
    COALESCE(fault_counts.open_fault_count, 0)::integer AS open_fault_count,
    visit_counts.last_site_visit,
    sites.created_at,
    sites.updated_at
  FROM sites
  LEFT JOIN users archived_by_user ON archived_by_user.id = sites.archived_by
  LEFT JOIN (
    SELECT site_id, COUNT(*)::integer AS charger_count
    FROM chargers
    WHERE status = 'active'
      AND deleted_at IS NULL
    GROUP BY site_id
  ) charger_counts ON charger_counts.site_id = sites.id
  LEFT JOIN (
    SELECT site_id, COUNT(*)::integer AS open_fault_count
    FROM faults
    WHERE status IN ('open', 'in_progress')
    GROUP BY site_id
  ) fault_counts ON fault_counts.site_id = sites.id
  LEFT JOIN (
    SELECT site_id, MAX(visit_date) AS last_site_visit
    FROM site_visits
    GROUP BY site_id
  ) visit_counts ON visit_counts.site_id = sites.id
`;

export async function listSites({ status, search, sort, order, limit }) {
  const values = [status];
  const filters = ["sites.status = $1"];

  if (search) {
    values.push(`%${search}%`);
    filters.push(`(
      sites.name ILIKE $${values.length}
      OR sites.code ILIKE $${values.length}
      OR sites.location ILIKE $${values.length}
      OR sites.address ILIKE $${values.length}
    )`);
  }

  values.push(limit);

  const sortColumn = sortColumns[sort] || sortColumns.name;
  const sortOrder = order === "desc" ? "DESC" : "ASC";

  const result = await query(
    `
      ${siteSummarySelect}
      WHERE ${filters.join(" AND ")}
      ORDER BY ${sortColumn} ${sortOrder}, sites.name ASC
      LIMIT $${values.length}
    `,
    values,
  );

  return result.rows;
}

export async function listArchivedSites() {
  const result = await query(`
    SELECT sites.id, sites.name, sites.code, sites.location, sites.status,
      sites.archived_at, sites.archived_by, users.full_name AS archived_by_name,
      sites.archive_reason,
      COALESCE(chargers.count, 0)::integer AS charger_count,
      COALESCE(visits.count, 0)::integer AS site_visit_count,
      COALESCE(faults.count, 0)::integer AS fault_count,
      COALESCE(documents.count, 0)::integer AS document_count,
      COALESCE(reports.count, 0)::integer AS report_count,
      COALESCE(troubleshooting.count, 0)::integer AS troubleshooting_count,
      sites.created_at, sites.updated_at
    FROM sites
    LEFT JOIN users ON users.id = sites.archived_by
    LEFT JOIN (SELECT site_id, COUNT(*) AS count FROM chargers GROUP BY site_id) chargers ON chargers.site_id = sites.id
    LEFT JOIN (SELECT site_id, COUNT(*) AS count FROM site_visits GROUP BY site_id) visits ON visits.site_id = sites.id
    LEFT JOIN (SELECT site_id, COUNT(*) AS count FROM faults GROUP BY site_id) faults ON faults.site_id = sites.id
    LEFT JOIN (SELECT site_id, COUNT(*) AS count FROM documents GROUP BY site_id) documents ON documents.site_id = sites.id
    LEFT JOIN (SELECT site_id, COUNT(*) AS count FROM reports GROUP BY site_id) reports ON reports.site_id = sites.id
    LEFT JOIN (SELECT site_id, COUNT(*) AS count FROM troubleshooting_records GROUP BY site_id) troubleshooting ON troubleshooting.site_id = sites.id
    WHERE sites.status = 'archived'
    ORDER BY sites.archived_at DESC NULLS LAST, sites.name ASC
  `);
  return result.rows;
}

export async function archiveSiteById(id, actor, reason, audit) {
  return withTransaction(async (client) => {
    const result = await client.query(
      `UPDATE sites SET status = 'archived', archived_at = now(), archived_by = $2, archive_reason = $3
       WHERE id = $1 AND status <> 'archived' RETURNING *`,
      [id, actor, reason || null],
    );
    const site = result.rows[0];
    if (!site) return null;
    await insertActivityLog(client, {
      userId: actor, action: "site_archived", entityType: "site", entityId: id,
      description: `Archived site ${site.name}`,
      context: { site_name: site.name, archive_reason: reason || null }, ...audit,
    });
    return site;
  });
}

export async function restoreSiteById(id, actor, audit) {
  return withTransaction(async (client) => {
    const result = await client.query(
      `UPDATE sites SET status = 'active', archived_at = NULL, archived_by = NULL, archive_reason = NULL
       WHERE id = $1 AND status = 'archived' RETURNING *`,
      [id],
    );
    const site = result.rows[0];
    if (!site) return null;
    await insertActivityLog(client, {
      userId: actor, action: "site_restored", entityType: "site", entityId: id,
      description: `Restored site ${site.name}`,
      context: { site_name: site.name }, ...audit,
    });
    return site;
  });
}

export async function permanentlyDeleteSiteById(id, actor, audit) {
  return withTransaction(async (client) => {
    const siteResult = await client.query("SELECT * FROM sites WHERE id = $1 FOR UPDATE", [id]);
    const site = siteResult.rows[0];
    if (!site) return { state: "not_found" };
    if (site.status !== "archived") return { state: "not_archived" };
    const countsResult = await client.query(
      `SELECT
        (SELECT COUNT(*) FROM chargers WHERE site_id = $1)::integer AS chargers,
        (SELECT COUNT(*) FROM site_visits WHERE site_id = $1)::integer AS site_visits,
        (SELECT COUNT(*) FROM faults WHERE site_id = $1)::integer AS faults,
        (SELECT COUNT(*) FROM documents WHERE site_id = $1)::integer AS documents,
        (SELECT COUNT(*) FROM reports WHERE site_id = $1)::integer AS reports,
        (SELECT COUNT(*) FROM troubleshooting_records WHERE site_id = $1)::integer AS troubleshooting_records`,
      [id],
    );
    const dependencies = countsResult.rows[0];
    if (Object.values(dependencies).some((count) => count > 0)) return { state: "dependencies", dependencies };
    await client.query("DELETE FROM sites WHERE id = $1", [id]);
    await insertActivityLog(client, {
      userId: actor, action: "site_permanently_deleted", entityType: "site", entityId: id,
      description: `Permanently deleted archived site ${site.name}`,
      context: { site_name: site.name, site_code: site.code }, ...audit,
    });
    return { state: "deleted", site };
  });
}

export async function findSiteById(id) {
  const result = await query(
    `
      ${siteSummarySelect}
      WHERE sites.id = $1
      LIMIT 1
    `,
    [id],
  );

  return result.rows[0] || null;
}

export async function findActiveSiteById(id) {
  const result = await query(
    `${siteSummarySelect} WHERE sites.id = $1 AND sites.status = 'active' LIMIT 1`,
    [id],
  );
  return result.rows[0] || null;
}

export async function insertSite(site) {
  const result = await query(
    `
      INSERT INTO sites (name, code, location, address, description, image_path)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `,
    [site.name, site.code, site.location ?? null, site.address ?? null, site.description ?? null, site.image_path ?? null],
  );

  return findSiteById(result.rows[0].id);
}

export async function updateSiteById(id, updates) {
  const entries = Object.entries(updates);
  const setClauses = entries.map(([column], index) => `${column} = $${index + 2}`);
  const values = [id, ...entries.map(([, value]) => value ?? null)];

  const result = await query(
    `
      UPDATE sites
      SET ${setClauses.join(", ")}
      WHERE id = $1
      RETURNING id
    `,
    values,
  );

  if (result.rowCount === 0) {
    return null;
  }

  return findSiteById(result.rows[0].id);
}

export async function updateSiteStatusById(id, status) {
  const result = await query(
    `
      UPDATE sites
      SET status = $2
      WHERE id = $1
      RETURNING id
    `,
    [id, status],
  );

  if (result.rowCount === 0) {
    return null;
  }

  return findSiteById(result.rows[0].id);
}

export async function updateSiteImagePathById(id, imagePath) {
  const result = await query(
    `
      UPDATE sites
      SET image_path = $2
      WHERE id = $1
      RETURNING id
    `,
    [id, imagePath],
  );

  if (result.rowCount === 0) {
    return null;
  }

  return findSiteById(result.rows[0].id);
}
