import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import { closeDatabasePool, query, withTransaction } from "../config/database.js";

const legacyFaultSchema = z.object({
  id: z.string().optional(), faultId: z.string().trim().min(1).optional(), siteName: z.string().trim().min(1),
  chargerId: z.string().optional(), chargerName: z.string().trim().min(1), faultCode: z.string().optional(), ftbCode: z.string().optional(),
  component: z.string().optional(), faultName: z.string().trim().min(2), faultDescription: z.string().optional(), description: z.string().optional(),
  possibleCauses: z.string().optional(), recommendedAction: z.string().optional(), severity: z.string().optional(), priority: z.string().optional(),
  category: z.string().optional(), technicalCategory: z.string().optional(), status: z.string().optional(), reportedAt: z.string().datetime(),
  reportedBy: z.string().optional(), comments: z.string().optional(), siteVisitRequired: z.boolean().optional(),
}).passthrough();

const enumValue = (value, allowed, fallback) => allowed.includes(String(value || "").trim().toLowerCase().replace(/\s+/g, "_")) ? String(value).trim().toLowerCase().replace(/\s+/g, "_") : fallback;
export function validateLegacyFaults(value) {
  const records = Array.isArray(value) ? value : value?.faults;
  if (!Array.isArray(records)) return { valid: [], invalid: [{ index: null, reason: "Input must be a fault array or an object containing faults" }] };
  const valid = [], invalid = [];
  records.forEach((record, index) => { const result = legacyFaultSchema.safeParse(record); result.success ? valid.push({ index, record: result.data }) : invalid.push({ index, reason: result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ") }); });
  return { valid, invalid };
}

export function legacyFaultPayload(record, siteId, chargerId, userId) {
  return {
    ...(record.faultId ? { fault_reference: record.faultId } : {}), site_id: siteId, charger_id: chargerId,
    fault_code: record.faultCode || null, ftb_code: record.ftbCode || null, component: record.component || null,
    fault_type: record.category || "Other", title: record.faultName, description: record.description || null,
    technician_observation: record.faultDescription || null, possible_causes: record.possibleCauses || null,
    recommended_actions: record.recommendedAction || null, category: record.category || "Other", technical_category: record.technicalCategory || null,
    severity: enumValue(record.severity, ["low","medium","high","critical","not_classified"], "not_classified"),
    priority: enumValue(record.priority, ["low","medium","high","critical"], "medium"),
    status: enumValue(record.status, ["open","in_progress","resolved"], String(record.status || "").trim().toLowerCase() === "closed" ? "resolved" : "open"),
    reported_at: record.reportedAt, reported_by_name: record.reportedBy || null, comments: record.comments || null,
    resolution_notes: record.comments || null, requires_site_visit: record.siteVisitRequired === true, created_by: userId, updated_by: userId,
  };
}

export async function planBrowserFaultImport(value, db = { query }) {
  const checked = validateLegacyFaults(value), ready = [], skipped = [...checked.invalid];
  for (const item of checked.valid) {
    const { record, index } = item;
    const relation = await db.query(`SELECT s.id AS site_id, c.id AS charger_id FROM sites s JOIN chargers c ON c.site_id=s.id
      WHERE lower(s.name)=lower($1) AND lower(c.name)=lower($2) AND s.status='active' AND c.status <> 'archived' LIMIT 1`, [record.siteName, record.chargerName]);
    if (!relation.rows[0]) { skipped.push({ index, reason: "Active site/charger name pair was not found" }); continue; }
    const duplicate = await db.query(`SELECT id, fault_reference FROM faults WHERE archived_at IS NULL AND
      (($1::text IS NOT NULL AND fault_reference=$1) OR (site_id=$2 AND charger_id=$3 AND title=$4 AND reported_at=$5::timestamptz)) LIMIT 1`,
      [record.faultId || null, relation.rows[0].site_id, relation.rows[0].charger_id, record.faultName, record.reportedAt]);
    if (duplicate.rows[0]) { skipped.push({ index, reason: `Duplicate of ${duplicate.rows[0].fault_reference || duplicate.rows[0].id}` }); continue; }
    ready.push({ index, payload: legacyFaultPayload(record, relation.rows[0].site_id, relation.rows[0].charger_id) });
  }
  return { ready, skipped };
}

async function main() {
  const args = process.argv.slice(2), filename = args.find((arg) => !arg.startsWith("--")), commit = args.includes("--commit");
  if (!filename) throw new Error("Usage: npm run faults:import -- /path/reviewed.json [--commit] --user=<uuid>");
  const userId = args.find((arg) => arg.startsWith("--user="))?.slice(7);
  if (commit && !z.string().uuid().safeParse(userId).success) throw new Error("--commit requires --user=<authorized-user-uuid>");
  const input = JSON.parse(await readFile(filename, "utf8"));
  const plan = await planBrowserFaultImport(input);
  if (commit) await withTransaction(async (client) => { for (const item of plan.ready) { const payload = { ...item.payload, created_by: userId, updated_by: userId }; const columns=Object.keys(payload), values=Object.values(payload); await client.query(`INSERT INTO faults (${columns.join(",")}) VALUES (${values.map((_,i)=>`$${i+1}`).join(",")})`, values); } });
  console.log(JSON.stringify({ mode: commit ? "committed" : "dry-run", importable: plan.ready.length, inserted: commit ? plan.ready.length : 0, skipped: plan.skipped }, null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main().catch((error) => { console.error(error.message); process.exitCode=1; }).finally(closeDatabasePool);
