import { query, withTransaction } from "../../config/database.js";
import { insertActivityLog } from "../activity-logs/activity-logs.repository.js";

const select = `SELECT requests.*, sites.name AS site_name, chargers.name AS charger_name,
  requester.full_name AS requested_by_name, assignee.full_name AS assigned_to_name,
  responder.full_name AS responded_by_name,
  (requests.due_date < CURRENT_DATE AND requests.status <> 'completed') AS overdue,
  COALESCE((SELECT jsonb_agg(jsonb_build_object('id', a.id, 'original_filename', a.original_filename,
    'mime_type', a.mime_type, 'file_size_bytes', a.file_size_bytes, 'created_at', a.created_at,
    'uploaded_by_name', uploader.full_name, 'uploaded_by_role', uploader_role.name,
    'preview_url', '/api/v1/attachments/' || a.id || '/preview', 'download_url', '/api/v1/attachments/' || a.id || '/download') ORDER BY a.created_at)
    FROM operational_attachments a
    JOIN users uploader ON uploader.id = a.uploaded_by
    JOIN roles uploader_role ON uploader_role.id = uploader.role_id
    WHERE a.parent_type = 'requests' AND a.parent_record_id = requests.id::text), '[]'::jsonb) AS attachments
  FROM requests LEFT JOIN sites ON sites.id=requests.site_id LEFT JOIN chargers ON chargers.id=requests.charger_id
  JOIN users requester ON requester.id=requests.requested_by LEFT JOIN users assignee ON assignee.id=requests.assigned_to
  LEFT JOIN users responder ON responder.id=requests.responded_by`;

export async function listRequests(options) {
  const values = [], filters = ["requests.deleted_at IS NULL"];
  for (const [key, column] of [["status", "requests.status"], ["priority", "requests.priority"], ["category", "requests.category"], ["site_id", "requests.site_id"], ["charger_id", "requests.charger_id"], ["assigned_to", "requests.assigned_to"]]) {
    if (options[key]) { values.push(options[key]); filters.push(`${column} = $${values.length}`); }
  }
  if (options.search) { values.push(`%${options.search}%`); filters.push(`(requests.title ILIKE $${values.length} OR requests.description ILIKE $${values.length} OR requests.request_reference ILIKE $${values.length})`); }
  if (options.overdue === true) filters.push("requests.due_date < CURRENT_DATE AND requests.status <> 'completed'");
  if (options.overdue === false) filters.push("NOT (requests.due_date < CURRENT_DATE AND requests.status <> 'completed')");
  values.push(options.limit || 100);
  return (await query(`${select} WHERE ${filters.join(" AND ")} ORDER BY requests.created_at DESC LIMIT $${values.length}`, values)).rows;
}

export async function findRequestById(id, client = { query }) {
  return (await client.query(`${select} WHERE requests.id=$1 AND requests.deleted_at IS NULL LIMIT 1`, [id])).rows[0] || null;
}

export async function findRequestByIdIncludingDeleted(id, client = { query }) {
  return (await client.query("SELECT * FROM requests WHERE id=$1 LIMIT 1", [id])).rows[0] || null;
}

export async function insertRequest(input, actor, audit) {
  return withTransaction(async (client) => {
    const columns = [...Object.keys(input), "requested_by"], values = [...Object.values(input), actor];
    const result = await client.query(`INSERT INTO requests (${columns.join(",")}) VALUES (${values.map((_, i) => `$${i + 1}`).join(",")}) RETURNING *`, values);
    const created = result.rows[0];
    await insertActivityLog(client, { userId: actor, action: "request_created", entityType: "request", entityId: created.id,
      description: `Created request ${created.request_reference}`, context: { request_reference: created.request_reference, site_id: created.site_id, charger_id: created.charger_id }, ...audit });
    return findRequestById(created.id, client);
  });
}

export async function updateRequestById(id, updates, actor, audit) {
  return withTransaction(async (client) => {
    const locked = (await client.query("SELECT * FROM requests WHERE id=$1 AND deleted_at IS NULL FOR UPDATE", [id])).rows[0];
    if (!locked) return null;
    const entries = Object.entries(updates), values = [id, ...entries.map(([, value]) => value ?? null)];
    const changed = (await client.query(`UPDATE requests SET ${entries.map(([key], i) => `${key}=$${i + 2}`).join(",")} WHERE id=$1 RETURNING *`, values)).rows[0];
    const common = { userId: actor, entityType: "request", entityId: id, context: { request_reference: locked.request_reference, site_id: changed.site_id, charger_id: changed.charger_id }, ...audit };
    await insertActivityLog(client, { ...common, action: "request_updated", description: `Updated request ${locked.request_reference}` });
    if (locked.status !== changed.status) await insertActivityLog(client, { ...common, action: "request_status_changed", description: `Changed request ${locked.request_reference} status`, context: { ...common.context, old_status: locked.status, new_status: changed.status } });
    if (locked.assigned_to !== changed.assigned_to) await insertActivityLog(client, { ...common, action: "request_assigned", description: `Changed request ${locked.request_reference} assignment`, context: { ...common.context, old_assigned_to: locked.assigned_to, new_assigned_to: changed.assigned_to } });
    if (locked.hq_response !== changed.hq_response) await insertActivityLog(client, { ...common, action: "request_response_updated", description: `Updated HQ response for ${locked.request_reference}` });
    return findRequestById(id, client);
  });
}

export async function softDeleteRequestById(id, actor, audit) {
  return withTransaction(async (client) => {
    const deleted = (await client.query(
      "UPDATE requests SET deleted_at=now(), deleted_by=$2 WHERE id=$1 AND deleted_at IS NULL RETURNING *",
      [id, actor],
    )).rows[0];
    if (!deleted) return null;
    await insertActivityLog(client, { userId: actor, action: "request_deleted", entityType: "request", entityId: id,
      description: `Deleted request ${deleted.request_reference}: ${deleted.title}`,
      context: { request_reference: deleted.request_reference, title: deleted.title, site_id: deleted.site_id, charger_id: deleted.charger_id }, ...audit });
    return deleted;
  });
}
