import { query, withTransaction } from "../../config/database.js";
import { insertActivityLog } from "../activity-logs/activity-logs.repository.js";

export const parentTypes = {
  "site-visits": { table: "site_visits" },
  documents: {}, faults: { table: "faults" }, "weekly-reports": {}, troubleshooting: {}, requests: { table: "requests" },
};

const attachmentSelect = `
  SELECT operational_attachments.*, users.full_name AS uploaded_by_name
  FROM operational_attachments
  JOIN users ON users.id = operational_attachments.uploaded_by
`;

export async function parentExists(parentType, parentId) {
  const config = parentTypes[parentType];
  if (!config.table) return true;
  const activeClause = parentType === "requests" ? " AND deleted_at IS NULL" : parentType === "faults" ? " AND archived_at IS NULL" : "";
  const result = await query(`SELECT id FROM ${config.table} WHERE id = $1${activeClause}`, [parentId]);
  return Boolean(result.rows[0]);
}

export async function operationalAttachmentParentIsActive(attachment) {
  if (attachment.parent_type === "requests") return parentExists("requests", attachment.parent_record_id);
  if (attachment.parent_type === "faults") return parentExists("faults", attachment.parent_record_id);
  return true;
}

export async function listAttachments(parentType, parentId) {
  const result = await query(`${attachmentSelect} WHERE operational_attachments.parent_type = $1 AND operational_attachments.parent_record_id = $2 ORDER BY operational_attachments.created_at`, [parentType, parentId]);
  return result.rows;
}

export async function findAttachment(id, client = { query }) {
  const result = await client.query(`${attachmentSelect} WHERE operational_attachments.id = $1`, [id]);
  return result.rows[0] || null;
}

export async function insertAttachment(parentType, parentId, file, userId, audit = {}) {
  return withTransaction(async (client) => {
    const siteVisitId = parentType === "site-visits" ? parentId : null;
    const result = await client.query(
    `INSERT INTO operational_attachments (site_visit_id, parent_type, parent_record_id, original_filename, stored_filename, storage_path, mime_type, file_extension, file_size_bytes, uploaded_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
    [siteVisitId, parentType, parentId, file.originalname, file.filename, file.path, file.mimetype, file.extension, file.size, userId],
  );
    if (parentType === "requests") {
      const request = (await client.query("SELECT request_reference, site_id, charger_id FROM requests WHERE id=$1", [parentId])).rows[0];
      await insertActivityLog(client, { userId, action: "request_attachment_uploaded", entityType: "request", entityId: parentId,
        description: `Uploaded attachment to ${request.request_reference}`, context: { request_reference: request.request_reference, site_id: request.site_id, charger_id: request.charger_id, attachment_id: result.rows[0].id }, ...audit });
    }
    return findAttachment(result.rows[0].id, client);
  });
}

export async function replaceAttachmentFile(id, file, userId) {
  const result = await query(
    `UPDATE operational_attachments SET original_filename=$2, stored_filename=$3, storage_path=$4, mime_type=$5,
      file_extension=$6, file_size_bytes=$7, preview_path=NULL, preview_generated_at=NULL, uploaded_by=$8
     WHERE id=$1 RETURNING id`,
    [id, file.originalname, file.filename, file.path, file.mimetype, file.extension, file.size, userId],
  );
  return result.rows[0] ? findAttachment(id) : null;
}

export async function setAttachmentPreview(id, previewPath) {
  await query("UPDATE operational_attachments SET preview_path=$2, preview_generated_at=now() WHERE id=$1", [id, previewPath]);
}

export async function deleteAttachmentRecord(id) {
  const result = await query("DELETE FROM operational_attachments WHERE id=$1 RETURNING *", [id]);
  return result.rows[0] || null;
}
