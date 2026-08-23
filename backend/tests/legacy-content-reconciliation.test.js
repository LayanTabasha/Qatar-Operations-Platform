import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";
import { runLegacyContentRecovery } from "../src/scripts/reconcile-legacy-content.js";

const root = path.resolve(process.cwd(), "..");

function frontendReconciler() {
  const source = fs.readFileSync(path.join(root, "frontend/pages/sites/sites-data-mappers.js"), "utf8");
  const start = source.indexOf("function contentIdentityValue");
  const end = source.indexOf("function mapContentRecord", start);
  const context = vm.createContext({});
  vm.runInContext(source.slice(start, end), context);
  return vm.runInContext("reconcileLegacyContentUploads", context);
}

function clientFor({ sites = [{ id: "site-1", name: "Msheireb" }], chargers = [], duplicate = null, attachments = [], liveParent = false } = {}) {
  return { query: vi.fn(async (sql, values = []) => {
    if (sql.includes("FROM sites")) return { rows: sites.filter((site) => !values[0] || site.id === values[0] || site.name.toLowerCase() === String(values[0]).toLowerCase()) };
    if (sql.includes("FROM chargers")) return { rows: chargers };
    if (sql.includes("FROM operational_attachments")) return { rows: attachments };
    if (sql.includes("FROM reports WHERE report_type='weekly' AND site_id")) return { rows: duplicate ? [{ id: duplicate }] : [] };
    if (sql.includes("FROM troubleshooting_records WHERE site_id")) return { rows: duplicate ? [{ id: duplicate }] : [] };
    if (sql.startsWith("SELECT id FROM reports") || sql.startsWith("SELECT id FROM troubleshooting_records") || sql.startsWith("SELECT id FROM documents")) return { rows: liveParent ? [{ id: values[0] }] : [] };
    if (sql.startsWith("INSERT INTO reports")) return { rows: [{ id: "new-report-parent" }] };
    if (sql.startsWith("INSERT INTO troubleshooting_records")) return { rows: [{ id: "new-guide-parent" }] };
    if (sql.startsWith("UPDATE operational_attachments")) return { rows: [] };
    if (["BEGIN", "COMMIT", "ROLLBACK"].includes(sql)) return { rows: [] };
    throw new Error(`Unexpected SQL in test: ${sql}`);
  }) };
}

describe("legacy content reconciliation", () => {
  it("lets the PostgreSQL parent override a matching legacy upload without duplicating the row", () => {
    const reconcile = frontendReconciler();
    const backend = [{ kind: "document", recordId: "parent-1", recordPersisted: true, attachmentPersisted: true, originalFileName: "June Charger Report.docx", name: "June Charger Report.docx" }];
    const legacy = [{ kind: "document", title: "DOC", name: "June Charger Report.docx" }, { kind: "guide", title: "trb", name: "guide.pdf" }];
    const remaining = reconcile(backend, legacy);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].title).toBe("trb");
    expect(backend[0]).toMatchObject({ recordId: "parent-1", recordPersisted: true, attachmentPersisted: true });
  });

  it("plans weekly-report and troubleshooting recovery without writes by default", async () => {
    const client = clientFor({ chargers: [{ id: "charger-1", name: "DC 1" }] });
    const records = [
      { kind: "weeklyReport", title: "report", siteId: "site-1", weekStart: "2026-06-01", weekEnd: "2026-06-07" },
      { kind: "guide", title: "trb", guideCategory: "Reset", siteId: "site-1", chargerId: "charger-1" },
    ];
    const result = await runLegacyContentRecovery({ client, records });
    expect(result).toMatchObject({ mode: "dry-run", writes: 0 });
    expect(result.plan.map(({ status }) => status)).toEqual(["ready", "ready"]);
    expect(result.plan.map(({ attachmentRecovery }) => attachmentRecovery)).toEqual(["none", "none"]);
    expect(result.plan.every(({ attachmentNote }) => attachmentNote.endsWith("Manual re-upload required."))).toBe(true);
    expect(client.query.mock.calls.some(([sql]) => /^(INSERT|UPDATE|BEGIN)/.test(sql))).toBe(false);
  });

  it("plans the supplied parent-only troubleshooting and weekly-report records", async () => {
    const client = clientFor({
      sites: [{ id: "mowasalat-site", name: "Mowasalat" }],
      chargers: [{ id: "bee63c28-b5db-4faf-9729-c5024e4a88d1", name: "Mowasalat DC Charger 01" }],
      attachments: [],
    });
    const result = await runLegacyContentRecovery({ client, records: [
      { kind: "guide", title: "trb", siteName: "Mowasalat", chargerId: "bee63c28-b5db-4faf-9729-c5024e4a88d1", chargerName: "Mowasalat DC Charger 01", guideCategory: "Reset Procedure", description: "fd", name: "June Charger Report.docx" },
      { kind: "weeklyReport", title: "report", siteName: "Mowasalat", weekStart: "2026-02-27", weekEnd: "2026-03-06", notes: "", name: "AC Chargers.docx" },
    ] });
    expect(result.plan).toHaveLength(2);
    expect(result.plan.every((item) => item.status === "ready" && item.attachmentRecovery === "none" && item.attachment === null)).toBe(true);
  });

  it("never steals an attachment linked to another live parent", async () => {
    const attachment = { id: "attachment-1", parent_type: "documents", parent_record_id: "live-document", original_filename: "June Charger Report.docx" };
    const client = clientFor({ attachments: [attachment], liveParent: true, chargers: [{ id: "charger-1", name: "DC 1" }] });
    const result = await runLegacyContentRecovery({ client, records: [{ kind: "guide", title: "trb", siteId: "site-1", chargerId: "charger-1", guideCategory: "Reset Procedure", name: "June Charger Report.docx" }] });
    expect(result.plan[0]).toMatchObject({ status: "ready", attachmentRecovery: "none", attachment: null });
    expect(result.plan[0].attachmentNote).toContain("belongs to another live parent");
  });

  it("commit creates only the parent when no safe attachment exists", async () => {
    const client = clientFor();
    const result = await runLegacyContentRecovery({ client, records: [{ kind: "weeklyReport", title: "report", siteId: "site-1", weekStart: "2026-02-27", weekEnd: "2026-03-06", name: "AC Chargers.docx" }], commit: true, actorId: "actor-1" });
    expect(result).toMatchObject({ mode: "commit", writes: 1 });
    expect(result.plan[0]).toMatchObject({ status: "imported", parentId: "new-report-parent", attachmentRecovery: "none", attachment: null });
    expect(client.query.mock.calls.some(([sql]) => sql.startsWith("INSERT INTO reports"))).toBe(true);
    expect(client.query.mock.calls.some(([sql]) => sql.startsWith("UPDATE operational_attachments"))).toBe(false);
    expect(client.query.mock.calls.some(([sql]) => sql.includes("INSERT INTO operational_attachments"))).toBe(false);
  });

  it("reports duplicate parents and ambiguous site matches without writes", async () => {
    const duplicateClient = clientFor({ duplicate: "existing-parent" });
    const duplicate = await runLegacyContentRecovery({ client: duplicateClient, records: [{ kind: "weeklyReport", title: "report", siteId: "site-1", weekStart: "2026-06-01", weekEnd: "2026-06-07" }] });
    expect(duplicate.plan[0]).toMatchObject({ status: "duplicate", parentId: "existing-parent" });
    const ambiguousClient = clientFor({ sites: [{ id: "a", name: "Same" }, { id: "b", name: "Same" }] });
    const ambiguous = await runLegacyContentRecovery({ client: ambiguousClient, records: [{ kind: "guide", title: "trb", guideCategory: "Reset", siteName: "Same" }] });
    expect(ambiguous.plan[0]).toMatchObject({ status: "skipped", reason: "Ambiguous active site" });
  });

  it("requires an explicit actor when commit is requested", async () => {
    await expect(runLegacyContentRecovery({ client: clientFor(), records: [{ kind: "weeklyReport", title: "report", siteId: "site-1", weekStart: "2026-06-01", weekEnd: "2026-06-07" }], commit: true })).rejects.toThrow("--actor-id is required with --commit");
  });
});
