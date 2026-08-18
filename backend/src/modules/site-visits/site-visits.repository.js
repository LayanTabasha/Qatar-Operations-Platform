import { query, withTransaction } from "../../config/database.js";
import { insertActivityLog } from "../activity-logs/activity-logs.repository.js";

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
    site_visits.updated_at,
    COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'id', a.id, 'original_filename', a.original_filename, 'mime_type', a.mime_type, 'file_extension', a.file_extension,
      'file_size_bytes', a.file_size_bytes, 'uploaded_by_name', attachment_user.full_name, 'created_at', a.created_at,
      'updated_at', a.updated_at, 'preview_url', '/api/v1/attachments/' || a.id || '/preview',
      'download_url', '/api/v1/attachments/' || a.id || '/download'
    ) ORDER BY a.created_at)
    FROM operational_attachments a JOIN users attachment_user ON attachment_user.id = a.uploaded_by
    WHERE a.site_visit_id = site_visits.id), '[]'::jsonb) AS attachments
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
      null,
      visit.created_by,
      visit.updated_by,
    ],
  );

  return findSiteVisitById(result.rows[0].id);
}

export async function updateSiteVisitById(id, updates, audit = {}) {
  const entries = Object.entries(updates);
  const setClauses = entries.map(([column], index) => `${column} = $${index + 2}`);
  const values = [id, ...entries.map(([, value]) => value ?? null)];
  const result = await withTransaction(async (client) => {
    const changed = await client.query(`
      UPDATE site_visits
      SET ${setClauses.join(", ")}
      WHERE id = $1
      RETURNING id
    `,
    values);
    if (!changed.rows[0]) return changed;
    const record = await client.query("SELECT id,site_id,charger_id,purpose FROM site_visits WHERE id=$1", [id]);
    await insertActivityLog(client, { userId: updates.updated_by, action: "site_visit_updated", entityType: "site_visit", entityId: id,
      description: `Updated site visit ${record.rows[0].purpose}`, context: { site_id: record.rows[0].site_id, charger_id: record.rows[0].charger_id }, ...audit });
    return changed;
  });

  return result.rows[0] ? findSiteVisitById(result.rows[0].id) : null;
}

export async function deleteSiteVisitById(id, actor, record, audit = {}) {
  return withTransaction(async (client) => {
    const result = await client.query("DELETE FROM site_visits WHERE id=$1 RETURNING id", [id]);
    if (!result.rows[0]) return false;
    await insertActivityLog(client, { userId: actor, action: "site_visit_deleted", entityType: "site_visit", entityId: id,
      description: `Deleted site visit ${record.purpose}`, context: { site_id: record.site_id, site_name: record.site_name, charger_id: record.charger_id, charger_name: record.charger_name }, ...audit });
    return true;
  });
}
