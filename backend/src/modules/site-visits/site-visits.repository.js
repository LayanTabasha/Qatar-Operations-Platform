import { query } from "../../config/database.js";

const siteVisitSelect = `
  SELECT
    site_visits.id,
    site_visits.site_id,
    sites.name AS site_name,
    site_visits.charger_id,
    chargers.name AS charger_name,
    site_visits.visit_date,
    to_char(site_visits.time_in, 'HH24:MI') AS time_in,
    to_char(site_visits.time_out, 'HH24:MI') AS time_out,
    site_visits.visited_by,
    site_visits.purpose,
    site_visits.status,
    site_visits.observations,
    site_visits.actions_taken,
    site_visits.follow_up_required,
    site_visits.report_file_path,
    site_visits.created_by,
    created_by_user.full_name AS recorded_by_name,
    site_visits.created_at,
    site_visits.updated_by,
    updated_by_user.full_name AS last_modified_by_name,
    site_visits.updated_at
  FROM site_visits
  JOIN sites ON sites.id = site_visits.site_id
  LEFT JOIN chargers ON chargers.id = site_visits.charger_id
  JOIN users created_by_user ON created_by_user.id = site_visits.created_by
  LEFT JOIN users updated_by_user ON updated_by_user.id = site_visits.updated_by
`;

export async function listSiteVisits({ site_id, charger_id, limit = 100 } = {}) {
  const values = [];
  const filters = [];

  if (site_id) {
    values.push(site_id);
    filters.push(`site_visits.site_id = $${values.length}`);
  }

  if (charger_id) {
    values.push(charger_id);
    filters.push(`site_visits.charger_id = $${values.length}`);
  }

  values.push(limit);
  const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
  const result = await query(
    `
      ${siteVisitSelect}
      ${whereClause}
      ORDER BY site_visits.visit_date DESC, site_visits.created_at DESC
      LIMIT $${values.length}
    `,
    values,
  );

  return result.rows;
}

export async function findSiteVisitById(id) {
  const result = await query(
    `
      ${siteVisitSelect}
      WHERE site_visits.id = $1
      LIMIT 1
    `,
    [id],
  );

  return result.rows[0] || null;
}

export async function insertSiteVisit(visit) {
  const result = await query(
    `
      INSERT INTO site_visits (
        site_id,
        charger_id,
        visit_date,
        time_in,
        time_out,
        visited_by,
        purpose,
        status,
        observations,
        actions_taken,
        follow_up_required,
        report_file_path,
        created_by,
        updated_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING id
    `,
    [
      visit.site_id,
      visit.charger_id ?? null,
      visit.visit_date,
      visit.time_in ?? null,
      visit.time_out ?? null,
      visit.visited_by,
      visit.purpose,
      visit.status,
      visit.observations ?? null,
      visit.actions_taken ?? null,
      visit.status === "follow_up_required" || visit.follow_up_required === true,
      visit.report_file_path ?? null,
      visit.created_by,
      visit.updated_by,
    ],
  );

  return findSiteVisitById(result.rows[0].id);
}

export async function updateSiteVisitById(id, updates) {
  const entries = Object.entries(updates);
  const setClauses = entries.map(([column], index) => `${column} = $${index + 2}`);
  const values = [id, ...entries.map(([, value]) => value ?? null)];
  const result = await query(
    `
      UPDATE site_visits
      SET ${setClauses.join(", ")}
      WHERE id = $1
      RETURNING id
    `,
    values,
  );

  return result.rows[0] ? findSiteVisitById(result.rows[0].id) : null;
}
