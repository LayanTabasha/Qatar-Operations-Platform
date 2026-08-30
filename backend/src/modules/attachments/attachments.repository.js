import { query, withTransaction } from "../../config/database.js";
import { insertActivityLog } from "../activity-logs/activity-logs.repository.js";

export const parentTypes = {
  "site-visits": { table: "site_visits" },
  documents: { table: "documents" },
  faults: { table: "faults", condition: "archived_at IS NULL" },
  "weekly-reports": { table: "reports", condition: "report_type = 'weekly'" },
  troubleshooting: { table: "troubleshooting_records" },
  requests: { table: "requests", condition: "deleted_at IS NULL" },
};

const attachmentSelect = `
  SELECT operational_attachments.*, COALESCE(users.full_name, 'Deleted user') AS uploaded_by_name
  FROM operational_attachments
  LEFT JOIN users ON users.id = operational_attachments.uploaded_by
`;

export async function parentExists(parentType, parentId) {
  const config = parentTypes[parentType];
  if (!config?.table) return false;
  const condition = config.condition ? ` AND ${config.condition}` : "";
  const result = await query(`SELECT id FROM ${config.table} WHERE id = $1${condition}`, [parentId]);
  return Boolean(result.rows[0]);
}

export async function operationalAttachmentParentIsActive(attachment) {
  return parentExists(attachment.parent_type, attachment.parent_record_id);
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

export async function deleteSiteVisitAttachmentRecords(siteVisitId, client = { query }) {
  const result = await client.query(
    `DELETE FROM operational_attachments
     WHERE site_visit_id=$1 OR (parent_type='site-visits' AND parent_record_id=$1::text)
     RETURNING storage_path,preview_path`,
    [siteVisitId],
  );
  return result.rows;
}
