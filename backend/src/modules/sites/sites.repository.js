import { query } from "../../config/database.js";

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
    COALESCE(charger_counts.charger_count, 0)::integer AS charger_count,
    COALESCE(fault_counts.open_fault_count, 0)::integer AS open_fault_count,
    visit_counts.last_site_visit,
    sites.created_at,
    sites.updated_at
  FROM sites
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
