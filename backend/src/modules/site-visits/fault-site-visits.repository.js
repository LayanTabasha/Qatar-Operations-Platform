import { ApiError } from "../../utils/api-error.js";
import { normalizeFaultLifecycle } from "../faults/fault-lifecycle.js";

export async function recalculateFaultStatuses(client, faultIds, userId, now = () => new Date().toISOString()) {
  for (const faultId of [...new Set(faultIds)].sort()) {
    const current = (await client.query("SELECT status,resolved_at FROM faults WHERE id=$1 AND archived_at IS NULL FOR UPDATE", [faultId])).rows[0];
    if (!current) continue;
    const latest = await client.query(
      `SELECT fsv.status_after_visit,fsv.progress_update
       FROM fault_site_visits fsv JOIN site_visits sv ON sv.id=fsv.site_visit_id
       WHERE fsv.fault_id=$1 ORDER BY sv.visit_date DESC,sv.created_at DESC,fsv.created_at DESC LIMIT 1`,
      [faultId],
    );
    const status = latest.rows[0]?.status_after_visit || "open";
    const lifecycle = normalizeFaultLifecycle(current.status, status, now);
    const resolvedAt = Object.hasOwn(lifecycle, "resolved_at") ? lifecycle.resolved_at : current.resolved_at;
    await client.query(
      `UPDATE faults SET status=$2,resolved_at=$3,updated_by=$4,
        confirmed_cause=CASE WHEN $2='resolved' THEN COALESCE(confirmed_cause,'Resolved during linked site visit') ELSE confirmed_cause END,
        resolution_action_taken=CASE WHEN $2='resolved' THEN COALESCE(resolution_action_taken,$5,'Resolved during linked site visit') ELSE resolution_action_taken END
       WHERE id=$1 AND archived_at IS NULL`,
      [faultId, status, resolvedAt, userId, latest.rows[0]?.progress_update || null],
    );
  }
}

export async function syncFaultLinks(client, siteVisitId, siteId, links, userId) {
  const uniqueLinks = [...new Map(links.map((link) => [link.fault_id, link])).values()];
  if (uniqueLinks.length) {
    const valid = await client.query(
      "SELECT id FROM faults WHERE id = ANY($1::uuid[]) AND site_id=$2 AND archived_at IS NULL",
      [uniqueLinks.map((link) => link.fault_id), siteId],
    );
    if (valid.rowCount !== uniqueLinks.length) {
      throw new ApiError(400, "INVALID_FAULT_VISIT_RELATIONSHIP", "Every linked fault must belong to the Site Visit site");
    }
  }

  const previous = await client.query("SELECT fault_id FROM fault_site_visits WHERE site_visit_id=$1", [siteVisitId]);
  const affected = new Set([...previous.rows.map((row) => row.fault_id), ...uniqueLinks.map((link) => link.fault_id)]);
  await client.query(
    "DELETE FROM fault_site_visits WHERE site_visit_id=$1 AND NOT (fault_id = ANY($2::uuid[]))",
    [siteVisitId, uniqueLinks.map((link) => link.fault_id)],
  );
  for (const link of uniqueLinks) {
    await client.query(
      `INSERT INTO fault_site_visits (fault_id,site_visit_id,progress_update,status_after_visit,created_by,updated_by)
       VALUES ($1,$2,$3,$4,$5,$5)
       ON CONFLICT (fault_id,site_visit_id) DO UPDATE SET
         progress_update=EXCLUDED.progress_update,status_after_visit=EXCLUDED.status_after_visit,updated_by=EXCLUDED.updated_by`,
      [link.fault_id, siteVisitId, link.progress_update ?? null, link.status_after_visit, userId],
    );
  }

  await recalculateFaultStatuses(client, [...affected], userId);
}
