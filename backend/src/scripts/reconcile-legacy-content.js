import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "../config/database.js";

const supportedKinds = new Map([["weeklyReport", "weekly-reports"], ["guide", "troubleshooting"]]);
function requiredDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) ? String(value) : "";
}

async function uniqueMatch(client, sql, values, label) {
  const rows = (await client.query(sql, values)).rows;
  if (rows.length === 1) return { value: rows[0], error: "" };
  return { value: null, error: rows.length ? `Ambiguous ${label}` : `${label} not found` };
}

async function resolveSite(client, record) {
  if (record.siteId) return uniqueMatch(client, "SELECT id,name FROM sites WHERE id=$1 AND status <> 'archived'", [record.siteId], "operational site");
  if (!record.siteName) return { value: null, error: "Site is required" };
  return uniqueMatch(client, "SELECT id,name FROM sites WHERE lower(name)=lower($1) AND status <> 'archived'", [record.siteName], "operational site");
}

async function resolveCharger(client, record, siteId) {
  if (!record.chargerId && !record.chargerName) return { value: null, error: "" };
  if (record.chargerId) return uniqueMatch(client, "SELECT id,name FROM chargers WHERE id=$1 AND site_id=$2 AND status<>'archived'", [record.chargerId, siteId], "charger at selected site");
  return uniqueMatch(client, "SELECT id,name FROM chargers WHERE lower(name)=lower($1) AND site_id=$2 AND status<>'archived'", [record.chargerName, siteId], "charger at selected site");
}

async function resolveAttachment(client, record) {
  if (record.attachmentId) return uniqueMatch(client, "SELECT id,parent_type,parent_record_id,original_filename FROM operational_attachments WHERE id=$1", [record.attachmentId], "attachment");
  const filename = record.originalFileName || record.fileName || record.name;
  if (!filename) return { value: null, error: "" };
  return uniqueMatch(client, "SELECT id,parent_type,parent_record_id,original_filename FROM operational_attachments WHERE lower(original_filename)=lower($1)", [filename], "attachment filename");
}

async function attachmentHasLiveParent(client, attachment) {
  const config = {
    documents: ["documents", ""],
    "weekly-reports": ["reports", " AND report_type='weekly'"],
    troubleshooting: ["troubleshooting_records", ""],
  }[attachment.parent_type];
  if (!config || !attachment.parent_record_id) return false;
  return Boolean((await client.query(`SELECT id FROM ${config[0]} WHERE id=$1${config[1]} LIMIT 1`, [attachment.parent_record_id])).rows[0]);
}

async function duplicateParent(client, type, record, siteId) {
  if (type === "weekly-reports") {
    return (await client.query("SELECT id FROM reports WHERE report_type='weekly' AND site_id=$1 AND lower(title)=lower($2) AND period_start=$3 AND period_end=$4 LIMIT 1", [siteId, record.title, record.weekStart, record.weekEnd])).rows[0];
  }
  return (await client.query("SELECT id FROM troubleshooting_records WHERE site_id=$1 AND lower(title)=lower($2) AND lower(issue_category)=lower($3) LIMIT 1", [siteId, record.title, record.guideCategory])).rows[0];
}

export async function planLegacyContentRecovery(client, records) {
  const plan = [];
  for (const record of records) {
    const type = supportedKinds.get(record.kind);
    if (!type) { plan.push({ status: "skipped", reason: "Unsupported legacy kind", record }); continue; }
    if (!record.title) { plan.push({ status: "skipped", reason: "Title is required", record }); continue; }
    if (type === "weekly-reports" && (!requiredDate(record.weekStart) || !requiredDate(record.weekEnd))) { plan.push({ status: "skipped", reason: "Weekly report requires YYYY-MM-DD period dates", record }); continue; }
    if (type === "troubleshooting" && !record.guideCategory) { plan.push({ status: "skipped", reason: "Troubleshooting category is required", record }); continue; }
    const site = await resolveSite(client, record);
    if (site.error) { plan.push({ status: "skipped", reason: site.error, record }); continue; }
    const charger = type === "troubleshooting" ? await resolveCharger(client, record, site.value.id) : { value: null, error: "" };
    if (charger.error) { plan.push({ status: "skipped", reason: charger.error, record }); continue; }
    const duplicate = await duplicateParent(client, type, record, site.value.id);
    if (duplicate) { plan.push({ status: "duplicate", parentId: duplicate.id, type, record }); continue; }
    const attachmentMatch = await resolveAttachment(client, record);
    let attachment = attachmentMatch.value;
    let attachmentRecovery = attachment ? "relink" : "none";
    let attachmentNote = attachmentMatch.error || (!attachment ? "No server-side attachment supplied" : "");
    if (attachment && await attachmentHasLiveParent(client, attachment)) {
      attachment = null;
      attachmentRecovery = "none";
      attachmentNote = "Matching attachment belongs to another live parent and will not be reused";
    }
    if (attachmentRecovery === "none") attachmentNote = `${attachmentNote}. Manual re-upload required.`;
    plan.push({ status: "ready", type, site: site.value, charger: charger.value, attachmentRecovery, attachmentNote, attachment, record });
  }
  return plan;
}

async function commitReadyRecord(client, item, actorId) {
  let parentId;
  if (item.type === "weekly-reports") {
    parentId = (await client.query("INSERT INTO reports(site_id,report_type,title,period_start,period_end,notes,created_by) VALUES($1,'weekly',$2,$3,$4,$5,$6) RETURNING id", [item.site.id, item.record.title, item.record.weekStart, item.record.weekEnd, item.record.notes || item.record.description || null, actorId])).rows[0].id;
  } else {
    parentId = (await client.query("INSERT INTO troubleshooting_records(site_id,charger_id,title,issue_category,symptoms,possible_cause,troubleshooting_steps,resolution,notes,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id", [item.site.id, item.charger?.id || null, item.record.title, item.record.guideCategory, item.record.symptoms || null, item.record.possibleCause || null, item.record.troubleshootingSteps || null, item.record.resolution || null, item.record.notes || item.record.description || null, actorId])).rows[0].id;
  }
  if (item.attachmentRecovery === "relink" && item.attachment) await client.query("UPDATE operational_attachments SET parent_type=$2,parent_record_id=$3 WHERE id=$1", [item.attachment.id, item.type, parentId]);
  return parentId;
}

export async function runLegacyContentRecovery({ client, records, commit = false, actorId = "" }) {
  const plan = await planLegacyContentRecovery(client, records);
  if (!commit) return { mode: "dry-run", writes: 0, plan };
  if (!actorId) throw new Error("--actor-id is required with --commit");
  await client.query("BEGIN");
  try {
    let writes = 0;
    for (const item of plan.filter(({ status }) => status === "ready")) { item.parentId = await commitReadyRecord(client, item, actorId); item.status = "imported"; writes += 1; }
    await client.query("COMMIT");
    return { mode: "commit", writes, plan };
  } catch (error) { await client.query("ROLLBACK"); throw error; }
}

async function main() {
  const args = process.argv.slice(2);
  const commit = args.includes("--commit");
  const input = args.find((arg) => !arg.startsWith("--"));
  const actorIndex = args.indexOf("--actor-id");
  const actorId = actorIndex >= 0 ? args[actorIndex + 1] : "";
  if (!input) throw new Error("Usage: node src/scripts/reconcile-legacy-content.js <legacy.json> [--commit --actor-id <uuid>]");
  const parsed = JSON.parse(await fs.readFile(path.resolve(input), "utf8"));
  const records = Array.isArray(parsed) ? parsed : parsed.uploads;
  if (!Array.isArray(records)) throw new Error("Input must be an array or an object with an uploads array");
  const client = await pool.connect();
  try { process.stdout.write(`${JSON.stringify(await runLegacyContentRecovery({ client, records, commit, actorId }), null, 2)}\n`); }
  finally { client.release(); await pool.end(); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(async (error) => { process.stderr.write(`${error.message}\n`); await pool.end(); process.exitCode = 1; });
