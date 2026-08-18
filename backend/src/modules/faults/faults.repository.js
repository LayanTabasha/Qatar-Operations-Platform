import { query, withTransaction } from "../../config/database.js";
import { insertActivityLog } from "../activity-logs/activity-logs.repository.js";

const select = `SELECT faults.*, sites.name AS site_name, chargers.name AS charger_name,
  creator.full_name AS created_by_name, updater.full_name AS updated_by_name,
  COALESCE((SELECT jsonb_agg(jsonb_build_object('id', a.id, 'original_filename', a.original_filename,
    'mime_type', a.mime_type, 'file_size_bytes', a.file_size_bytes, 'created_at', a.created_at,
    'preview_url', '/api/v1/attachments/' || a.id || '/preview', 'download_url', '/api/v1/attachments/' || a.id || '/download') ORDER BY a.created_at)
    FROM operational_attachments a WHERE a.parent_type = 'faults' AND a.parent_record_id = faults.id::text), '[]'::jsonb) AS attachments
  FROM faults JOIN sites ON sites.id=faults.site_id JOIN chargers ON chargers.id=faults.charger_id
  JOIN users creator ON creator.id=faults.created_by LEFT JOIN users updater ON updater.id=faults.updated_by`;

export async function listFaults(options = {}) {
  const values = [], filters = ["faults.archived_at IS NULL", "sites.status = 'active'", "chargers.status <> 'archived'"];
  for (const [key, column] of [["site_id", "faults.site_id"], ["charger_id", "faults.charger_id"], ["status", "faults.status"], ["severity", "faults.severity"]]) {
    if (options[key]) { values.push(options[key]); filters.push(`${column} = $${values.length}`); }
  }
  if (options.date_from) { values.push(options.date_from); filters.push(`faults.reported_at >= $${values.length}::date`); }
  if (options.date_to) { values.push(options.date_to); filters.push(`faults.reported_at < ($${values.length}::date + interval '1 day')`); }
  values.push(options.limit || 100);
  return (await query(`${select} WHERE ${filters.join(" AND ")} ORDER BY faults.reported_at DESC, faults.created_at DESC LIMIT $${values.length}`, values)).rows;
}

export async function findFaultById(id) {
  return (await query(`${select} WHERE faults.id=$1 AND faults.archived_at IS NULL LIMIT 1`, [id])).rows[0] || null;
}

export async function findFaultByReference(reference) {
  return (await query("SELECT * FROM faults WHERE fault_reference=$1 LIMIT 1", [reference])).rows[0] || null;
}

export async function insertFault(fault) {
  const columns = Object.keys(fault), values = Object.values(fault);
  const result = await query(`INSERT INTO faults (${columns.join(",")}) VALUES (${values.map((_, i) => `$${i + 1}`).join(",")}) RETURNING id`, values);
  return findFaultById(result.rows[0].id);
}

export async function updateFaultById(id, updates, audit = {}) {
  const entries = Object.entries(updates), values = [id, ...entries.map(([, value]) => value ?? null)];
  const result = await withTransaction(async (client) => {
    const changed = await client.query(`UPDATE faults SET ${entries.map(([key], i) => `${key}=$${i + 2}`).join(",")} WHERE id=$1 AND archived_at IS NULL RETURNING id,title,site_id,charger_id`, values);
    if (changed.rows[0]) await insertActivityLog(client, { userId: updates.updated_by, action: "fault_updated", entityType: "fault", entityId: id,
      description: `Updated fault ${changed.rows[0].title}`, context: { site_id: changed.rows[0].site_id, charger_id: changed.rows[0].charger_id }, ...audit });
    return changed;
  });
  return result.rows[0] ? findFaultById(id) : null;
}

export async function archiveFaultById(id, userId, record, audit = {}) {
  return withTransaction(async (client) => {
    const archived=(await client.query("UPDATE faults SET archived_at=now(), archived_by=$2, updated_by=$2 WHERE id=$1 AND archived_at IS NULL RETURNING id", [id, userId])).rows[0];
    if (!archived) return null;
    await insertActivityLog(client, { userId, action: "fault_deleted", entityType: "fault", entityId: id,
      description: `Archived fault ${record.fault_reference || record.title}`, context: { fault_reference: record.fault_reference, site_id: record.site_id, charger_id: record.charger_id }, ...audit });
    return archived;
  });
}
