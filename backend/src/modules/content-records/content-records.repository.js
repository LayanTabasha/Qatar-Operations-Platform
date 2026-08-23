import { query, withTransaction } from "../../config/database.js";
import { insertActivityLog } from "../activity-logs/activity-logs.repository.js";

const attachmentJson = (type, idExpression) => `COALESCE((SELECT jsonb_agg(jsonb_build_object(
  'id', a.id, 'original_filename', a.original_filename, 'mime_type', a.mime_type, 'file_extension', a.file_extension,
  'file_size_bytes', a.file_size_bytes, 'uploaded_by_name', au.full_name, 'created_at', a.created_at, 'updated_at', a.updated_at,
  'preview_url', '/api/v1/attachments/' || a.id || '/preview', 'download_url', '/api/v1/attachments/' || a.id || '/download',
  'preview_available', true, 'parent_type', a.parent_type, 'parent_record_id', a.parent_record_id
) ORDER BY a.created_at DESC) FROM operational_attachments a JOIN users au ON au.id=a.uploaded_by
WHERE a.parent_type='${type}' AND a.parent_record_id=${idExpression}::text), '[]'::jsonb)`;

const selects = {
  documents: `SELECT d.id,d.site_id,s.name site_name,d.charger_id,c.name charger_name,d.document_type,d.title,d.description,
    d.document_date,d.uploaded_by,u.full_name uploaded_by_name,d.created_at,d.updated_at,${attachmentJson("documents", "d.id")} attachments
    FROM documents d LEFT JOIN sites s ON s.id=d.site_id LEFT JOIN chargers c ON c.id=d.charger_id LEFT JOIN users u ON u.id=d.uploaded_by`,
  "weekly-reports": `SELECT r.id,r.site_id,s.name site_name,r.title,r.period_start,r.period_end,r.notes,r.created_by,
    u.full_name uploaded_by_name,r.created_at,r.updated_at,${attachmentJson("weekly-reports", "r.id")} attachments
    FROM reports r LEFT JOIN sites s ON s.id=r.site_id LEFT JOIN users u ON u.id=r.created_by WHERE r.report_type='weekly'`,
  troubleshooting: `SELECT t.id,t.site_id,s.name site_name,t.charger_id,c.name charger_name,t.title,t.issue_category,t.symptoms,
    t.possible_cause,t.troubleshooting_steps,t.resolution,t.notes,t.created_by,u.full_name uploaded_by_name,t.created_at,t.updated_at,
    ${attachmentJson("troubleshooting", "t.id")} attachments FROM troubleshooting_records t LEFT JOIN sites s ON s.id=t.site_id
    LEFT JOIN chargers c ON c.id=t.charger_id LEFT JOIN users u ON u.id=t.created_by`,
};

export async function listContentRecords(type) {
  const result = await query(`${selects[type]} ORDER BY created_at DESC LIMIT 500`);
  return result.rows;
}

export async function findContentRecord(type, id) {
  const joiner = type === "weekly-reports" ? " AND" : " WHERE";
  const result = await query(`${selects[type]}${joiner} ${type === "documents" ? "d" : type === "weekly-reports" ? "r" : "t"}.id=$1`, [id]);
  return result.rows[0] || null;
}

export async function insertContentRecord(type, input, userId) {
  let sql; let values;
  if (type === "documents") {
    sql = `INSERT INTO documents(site_id,charger_id,document_type,title,description,document_date,uploaded_by)
      VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id`;
    values = [input.site_id || null,input.charger_id || null,input.document_type,input.title,input.description || null,input.document_date,userId];
  } else if (type === "weekly-reports") {
    sql = `INSERT INTO reports(site_id,report_type,title,period_start,period_end,notes,created_by)
      VALUES($1,'weekly',$2,$3,$4,$5,$6) RETURNING id`;
    values = [input.site_id || null,input.title,input.period_start,input.period_end,input.notes || null,userId];
  } else {
    sql = `INSERT INTO troubleshooting_records(site_id,charger_id,title,issue_category,symptoms,possible_cause,troubleshooting_steps,resolution,notes,created_by)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`;
    values = [input.site_id || null,input.charger_id || null,input.title,input.issue_category,input.symptoms || null,input.possible_cause || null,input.troubleshooting_steps || null,input.resolution || null,input.notes || null,userId];
  }
  const result = await query(sql, values); return findContentRecord(type, result.rows[0].id);
}

const updateColumns = {
  documents: ["site_id","charger_id","document_type","title","description","document_date"],
  "weekly-reports": ["site_id","title","period_start","period_end","notes"],
  troubleshooting: ["site_id","charger_id","title","issue_category","symptoms","possible_cause","troubleshooting_steps","resolution","notes"],
};
export async function updateContentRecord(type, id, input, actor, audit = {}) {
  const entries = updateColumns[type].filter((key) => input[key] !== undefined).map((key) => [key,input[key] || null]);
  if (!entries.length) return findContentRecord(type,id);
  const table = type === "documents" ? "documents" : type === "weekly-reports" ? "reports" : "troubleshooting_records";
  const values=[id,...entries.map(([,value])=>value)];
  const updated = await withTransaction(async (client) => {
    const result=await client.query(`UPDATE ${table} SET ${entries.map(([key],i)=>`${key}=$${i+2}`).join(",")} WHERE id=$1${type === "weekly-reports" ? " AND report_type='weekly'" : ""} RETURNING id,title,site_id${type === "weekly-reports" ? "" : ",charger_id"}`,values);
    const record=result.rows[0];
    if (!record) return false;
    await insertActivityLog(client, {
      userId: actor, action: `${type === "weekly-reports" ? "weekly_report" : type === "documents" ? "document" : "troubleshooting"}_updated`,
      entityType: type === "weekly-reports" ? "weekly_report" : type === "documents" ? "document" : "troubleshooting",
      entityId: id, description: `Updated ${type === "weekly-reports" ? "weekly report" : type === "documents" ? "document" : "troubleshooting record"} ${record.title}`,
      context: { title: record.title, site_id: record.site_id || null, charger_id: record.charger_id || null }, ...audit,
    });
    return true;
  });
  return updated ? findContentRecord(type,id) : null;
}

export async function deleteContentRecord(type,id,actor,record,audit = {}) {
  const table=type === "documents" ? "documents" : type === "weekly-reports" ? "reports" : "troubleshooting_records";
  const extra=type === "weekly-reports" ? " AND report_type='weekly'" : "";
  return withTransaction(async (client) => {
    // The attachment rows and parent are removed in one transaction. This avoids
    // leaving a live content record without its attachment when the parent delete
    // or audit write fails.
    const attachments=(await client.query(`DELETE FROM operational_attachments
      WHERE parent_type=$1 AND parent_record_id=$2
      RETURNING storage_path,preview_path`,[type,id])).rows;
    const result=await client.query(`DELETE FROM ${table} WHERE id=$1${extra} RETURNING id`,[id]);
    if (!result.rows[0]) return false;
    await insertActivityLog(client, {
      userId: actor, action: `${type === "weekly-reports" ? "weekly_report" : type === "documents" ? "document" : "troubleshooting"}_deleted`,
      entityType: type === "weekly-reports" ? "weekly_report" : type === "documents" ? "document" : "troubleshooting",
      entityId: id, description: `Deleted ${type === "weekly-reports" ? "weekly report" : type === "documents" ? "document" : "troubleshooting record"} ${record.title}`,
      context: { title: record.title, site_id: record.site_id || null, site_name: record.site_name || null, charger_id: record.charger_id || null, charger_name: record.charger_name || null }, ...audit,
    });
    return { attachments };
  });
}
