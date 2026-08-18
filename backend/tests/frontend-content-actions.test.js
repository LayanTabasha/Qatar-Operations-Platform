import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mapperSource = fs.readFileSync(path.resolve(root, "../frontend/pages/sites/sites-data-mappers.js"), "utf8");
const sitesSource = fs.readFileSync(path.resolve(root, "../js/sites-page.js"), "utf8");
const stateSource = fs.readFileSync(path.resolve(root, "../js/state.js"), "utf8");
const appSource = fs.readFileSync(path.resolve(root, "../app.js"), "utf8");

function renderer(role, roleSource = "state") {
  const state = {
    currentUserRoleKey: roleSource === "state" ? role : "",
    currentUserRole: "",
    authUser: roleSource === "authUser" ? { role } : null,
  };
  const context = vm.createContext({
    normalizeUploadRecord: (record) => ({
      ...record,
      module: record.module || ({ document: "chargerDocument", weeklyReport: "weeklyReport", guide: "troubleshooting" })[record.kind],
    }),
    normalizedRoleKey: (value) => String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_").replace(/^administrator$/, "admin"),
    state,
    canManageOperations: () => [state.currentUserRoleKey, state.currentUserRole, state.authUser?.roleKey, state.authUser?.role]
      .some((value) => ["admin", "administrator", "hq_user", "operations_staff"].includes(String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_"))),
  });
  vm.runInContext(mapperSource, context);
  vm.runInContext(sitesSource, context);
  return {
    map: vm.runInContext("mapContentRecord", context),
    actions: vm.runInContext("fileActionButtons", context),
  };
}

const moduleCases = [
  { kind: "document", type: "documents", label: "document", fields: { document_type: "Manual", document_date: "2026-08-05" } },
  { kind: "weeklyReport", type: "weekly-reports", label: "weekly report", fields: { period_start: "2026-08-03", period_end: "2026-08-09" } },
  { kind: "guide", type: "troubleshooting", label: "troubleshooting guide", fields: { issue_category: "Reset Procedure" } },
];

function backendRecord(item, withAttachment) {
  return {
    id: `${item.kind}-parent-id`, title: `${item.label} title`, site_name: "Test Site", charger_id: "charger-id", created_at: "2026-08-05T00:00:00Z",
    ...item.fields,
    attachments: withAttachment ? [{
      id: `${item.kind}-attachment-id`, original_filename: `${item.kind}.pdf`, mime_type: "application/pdf",
      file_size_bytes: 100, file_extension: ".pdf", created_at: "2026-08-05T00:00:00Z",
    }] : [],
  };
}

describe("rendered persistent content actions", () => {
  for (const item of moduleCases) {
    for (const withAttachment of [true, false]) {
      it(`renders ${item.label} ${withAttachment ? "with" : "without"} an attachment`, () => {
        const { map, actions } = renderer("admin");
        const mapped = map(backendRecord(item, withAttachment), item.kind);
        const html = actions(mapped, item.label);
        expect(mapped.recordId).toBe(`${item.kind}-parent-id`);
        expect(mapped.recordPersisted).toBe(true);
        expect(mapped.attachmentPersisted).toBe(withAttachment);
        expect(mapped.kind).toBe(item.kind);
        expect(mapped.module).toBe(({ document: "chargerDocument", weeklyReport: "weeklyReport", guide: "troubleshooting" })[item.kind]);
        expect(mapped.siteName).toBe("Test Site");
        expect(mapped.chargerId).toBe("charger-id");
        expect(mapped.title).toBe(`${item.label} title`);
        expect(html).toContain(`data-content-view="${item.kind}-parent-id"`);
        expect(html).toContain(`data-content-edit="${item.kind}-parent-id"`);
        expect(html).toContain(`data-content-delete="${item.kind}-parent-id"`);
        expect(html).toContain(`data-content-type="${item.type}"`);
        expect(html.includes("data-file-download=")).toBe(withAttachment);
      });
    }
  }

  it.each(["admin", "hq_user", "operations_staff"])("shows management actions for %s", (role) => {
    const { map, actions } = renderer(role);
    const mapped = map(backendRecord(moduleCases[0], true), "document");
    const html = actions(mapped, "document");
    for (const action of ["View", "Download", "Edit", "Delete"]) expect(html).toContain(`aria-label="${action} document"`);
  });

  it.each(["Administrator", "Operations Staff"])("uses the authenticated user role at render time for %s", (role) => {
    const { map, actions } = renderer(role, "authUser");
    const mapped = map(backendRecord(moduleCases[0], false), "document");
    expect(actions(mapped, "document")).toContain(`data-content-edit="document-parent-id"`);
    expect(actions(mapped, "document")).toContain(`data-content-delete="document-parent-id"`);
  });

  it("hides management actions from viewers without regressing View or Download", () => {
    const { map, actions } = renderer("viewer");
    const mapped = map(backendRecord(moduleCases[0], true), "document");
    const html = actions(mapped, "document");
    expect(html).toContain('aria-label="View document"');
    expect(html).toContain('aria-label="Download document"');
    expect(html).not.toContain('aria-label="Edit document"');
    expect(html).not.toContain('aria-label="Delete document"');
  });

  it("uses browser-local management actions when an early record has no backend parent", () => {
    const { actions } = renderer("admin");
    const html = actions({ id: "legacy-local", kind: "document", recordPersisted: false, persisted: false }, "document");
    expect(html).not.toContain("data-content-edit");
    expect(html).toContain('data-legacy-content-edit="legacy-local"');
    expect(html).toContain('data-legacy-content-delete="legacy-local"');
  });

  it("normalizes the live Administrator role and delegates dynamic action events", () => {
    expect(stateSource).toContain('["admin", "administrator"].includes(normalized)');
    expect(stateSource).toContain('["admin", "hq_user", "operations_staff"].includes(role)');
    expect(sitesSource).toContain("canManageOperations()");
    expect(appSource).toContain('event.target.closest("[data-content-edit]")');
    expect(appSource).toContain('event.target.closest("[data-content-delete]")');
    expect(appSource).toContain("state.currentContentRecordId = contentEditButton.dataset.contentEdit");
  });
});
