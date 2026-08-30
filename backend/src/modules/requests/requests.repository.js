import { query, withTransaction } from "../../config/database.js";
import { insertActivityLog } from "../activity-logs/activity-logs.repository.js";

const select = `SELECT requests.*, sites.name AS site_name, chargers.name AS charger_name,
  COALESCE(requester.full_name, 'Deleted user') AS requested_by_name, assignee.full_name AS assigned_to_name,
  COALESCE(responder.full_name, 'Deleted user') AS responded_by_name,
  CASE WHEN related_fault.id IS NULL THEN NULL ELSE jsonb_build_object(
    'id', related_fault.id, 'fault_reference', related_fault.fault_reference, 'title', related_fault.title,
    'status', related_fault.status, 'site_id', related_fault.site_id, 'site_name', fault_site.name,
    'charger_id', related_fault.charger_id, 'charger_name', fault_charger.name,
    'description', related_fault.description,
    'related_site_visits', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'id', sv.id, 'visit_date', sv.visit_date, 'time_in', sv.time_in, 'time_out', sv.time_out,
      'purpose', sv.purpose, 'status', sv.status, 'engineer', COALESCE(visit_creator.full_name, 'Deleted user')
    ) ORDER BY sv.visit_date DESC, sv.created_at DESC)
    FROM fault_site_visits fsv JOIN site_visits sv ON sv.id=fsv.site_visit_id
    LEFT JOIN users visit_creator ON visit_creator.id=sv.created_by
    WHERE fsv.fault_id=related_fault.id), '[]'::jsonb)
  ) END AS related_fault,
  (requests.due_date < CURRENT_DATE AND requests.status <> 'completed') AS overdue,
  COALESCE((SELECT jsonb_agg(jsonb_build_object('id', a.id, 'original_filename', a.original_filename,
    'mime_type', a.mime_type, 'file_size_bytes', a.file_size_bytes, 'created_at', a.created_at,
    'uploaded_by_name', COALESCE(uploader.full_name, 'Deleted user'), 'uploaded_by_role', uploader_role.name,
    'preview_url', '/api/v1/attachments/' || a.id || '/preview', 'download_url', '/api/v1/attachments/' || a.id || '/download') ORDER BY a.created_at)
    FROM operational_attachments a
    LEFT JOIN users uploader ON uploader.id = a.uploaded_by
    LEFT JOIN roles uploader_role ON uploader_role.id = uploader.role_id
    WHERE a.parent_type = 'requests' AND a.parent_record_id = requests.id::text), '[]'::jsonb) AS attachments
  FROM requests LEFT JOIN sites ON sites.id=requests.site_id LEFT JOIN chargers ON chargers.id=requests.charger_id
  LEFT JOIN users requester ON requester.id=requests.requested_by LEFT JOIN users assignee ON assignee.id=requests.assigned_to
  LEFT JOIN users responder ON responder.id=requests.responded_by
  LEFT JOIN faults related_fault ON related_fault.id=requests.fault_id
  LEFT JOIN sites fault_site ON fault_site.id=related_fault.site_id
  LEFT JOIN chargers fault_charger ON fault_charger.id=related_fault.charger_id`;

export async function findLinkableFaultById(id, client = { query }) {
  return (await client.query("SELECT id,site_id,charger_id,archived_at FROM faults WHERE id=$1 LIMIT 1", [id])).rows[0] || null;
}

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
    if (created.fault_id) await insertActivityLog(client, { userId: actor, action: "request_fault_linked", entityType: "request", entityId: created.id,
      description: `Linked request ${created.request_reference} to a fault`, context: { request_reference: created.request_reference, fault_id: created.fault_id, site_id: created.site_id }, ...audit });
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
    if (locked.priority !== changed.priority) await insertActivityLog(client, { ...common, action: "request_priority_changed", description: `Changed request ${locked.request_reference} priority`, context: { ...common.context, old_priority: locked.priority, new_priority: changed.priority } });
    if (locked.assigned_to !== changed.assigned_to) await insertActivityLog(client, { ...common, action: "request_assigned", description: `Changed request ${locked.request_reference} assignment`, context: { ...common.context, old_assigned_to: locked.assigned_to, new_assigned_to: changed.assigned_to } });
    if (locked.hq_response !== changed.hq_response) await insertActivityLog(client, { ...common, action: "request_response_updated", description: `Updated HQ response for ${locked.request_reference}` });
    if (locked.fault_id !== changed.fault_id) {
      const action = !locked.fault_id ? "request_fault_linked" : (!changed.fault_id ? "request_fault_removed" : "request_fault_changed");
      const description = !locked.fault_id ? `Linked request ${locked.request_reference} to a fault` : (!changed.fault_id ? `Removed the fault link from request ${locked.request_reference}` : `Changed the fault linked to request ${locked.request_reference}`);
      await insertActivityLog(client, { ...common, action, description, context: { ...common.context, old_fault_id: locked.fault_id, new_fault_id: changed.fault_id } });
    }
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
