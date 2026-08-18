import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

const root = path.resolve(process.cwd(), "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const index = read("index.html");
const siteVisits = read("frontend/pages/sites/site-visits.js");
const faults = read("frontend/pages/sites/faults.js");
const sitesPage = read("js/sites-page.js");
const modals = read("js/modals.js");

function featureRuntime(canManage = true) {
  const filters = {
    "Site Visits": { search: "", charger: "", date: "", status: "" },
    Faults: { search: "", charger: "", date: "", status: "", faultCode: "" },
  };
  const context = vm.createContext({
    state: { currentSiteName: "Al Mana", currentChargerId: "charger-1", visits: [], faults: [] },
    moduleFilters: (name) => filters[name],
    normalizedFilterText: (value) => String(value || "").trim().toLowerCase(),
    includesFilterText: (values, search) => !search || values.some((value) => String(value || "").toLowerCase().includes(search.toLowerCase())),
    canManageOperations: () => canManage,
    deduplicateSiteVisitAttachments: (files) => [...new Map(files.map((file) => [file.id, file])).values()],
    valueOrPlaceholder: (value) => value || "—",
    formatMediumDate: (value) => value,
    formatDate: (value) => value,
    safeDetailValue: (value) => String(value || ""),
    normalizedFaultSeverity: (value) => value,
    FAULT_STATUS_OPTIONS: ["Open", "In Progress", "Resolved"],
    getValidUploads: () => context.uploads,
    uploads: [],
  });
  vm.runInContext(siteVisits, context, { filename: "site-visits.js" });
  vm.runInContext(faults, context, { filename: "faults.js" });
  return { context, filters };
}

describe("extracted Sites Visit and Fault renderers", () => {
  it("loads both components between Sites list and the Sites orchestrator", () => {
    const listIndex = index.indexOf("frontend/pages/sites/sites-list.js");
    const visitsIndex = index.indexOf("frontend/pages/sites/site-visits.js");
    const faultsIndex = index.indexOf("frontend/pages/sites/faults.js");
    const sitesIndex = index.indexOf("js/sites-page.js");
    const modalsIndex = index.indexOf("js/modals.js");
    expect(listIndex).toBeLessThan(visitsIndex);
    expect(visitsIndex).toBeLessThan(faultsIndex);
    expect(faultsIndex).toBeLessThan(sitesIndex);
    expect(sitesIndex).toBeLessThan(modalsIndex);
  });

  it("keeps Site and Charger context plus independent Visit/Fault filters", () => {
    const { context, filters } = featureRuntime();
    context.state.visits = [
      { id: "v1", siteName: "Al Mana", chargerId: "charger-1", status: "Completed", purpose: "Inspection", visitDate: "2026-08-18" },
      { id: "v2", siteName: "Al Mana", chargerId: "charger-2", status: "Planned", purpose: "Maintenance", visitDate: "2026-08-17" },
    ];
    context.state.faults = [
      { id: "f1", faultId: "FLT-1", faultCode: "E101", siteName: "Al Mana", chargerId: "charger-1", status: "Open", reportedAt: "2026-08-18" },
      { id: "f2", faultId: "FLT-2", faultCode: "E202", siteName: "Al Mana", chargerId: "charger-2", status: "Resolved", reportedAt: "2026-08-17" },
    ];
    filters["Site Visits"].search = "inspection";
    filters.Faults.status = "open";
    expect(vm.runInContext("filteredVisitRecords().map((record) => record.id)", context)).toEqual(["v1"]);
    expect(vm.runInContext("filteredFaultRecords().map((record) => record.id)", context)).toEqual(["f1"]);
    filters.Faults.faultCode = "e202";
    expect(vm.runInContext("filteredFaultRecords()", context)).toHaveLength(0);
  });

  it("preserves attachment, photo, permission, and data-action contracts", () => {
    const manager = featureRuntime(true).context;
    const viewer = featureRuntime(false).context;
    const attachment = { id: "123e4567-e89b-12d3-a456-426614174000", name: "Visit.pdf", type: "application/pdf" };
    manager.uploads = [{ id: "photo-1", faultId: "FLT-1", module: "fault", name: "Fault.jpg", dataUrl: "data:image/jpeg;base64,x" }];
    expect(vm.runInContext(`siteVisitRemoveControl(${JSON.stringify(attachment)})`, manager)).toContain("data-site-visit-report-remove");
    expect(vm.runInContext(`siteVisitRemoveControl(${JSON.stringify(attachment)})`, viewer)).toContain("disabled");
    expect(vm.runInContext('faultPhotosMarkup({ faultId: "FLT-1" })', manager)).toContain('data-file-preview="photo-1"');
    expect(siteVisits).toContain('data-visit-detail="${visit.id}"');
    expect(siteVisits).toContain('data-operational-delete="${visit.id}"');
    expect(faults).toContain('data-fault-detail="${fault.id}"');
    expect(faults).toContain('data-fault-status="${fault.id}"');
    expect(faults).toContain('data-operational-delete="${fault.id}"');
  });

  it("keeps external globals and exactly one production definition", () => {
    expect(modals).toContain("siteVisitRemoveControl(");
    expect(modals).toContain("faultPhotosMarkup(");
    const production = [siteVisits, faults, sitesPage].join("\n");
    for (const name of [
      "hasBackendAttachmentId", "canRemoveSiteVisitAttachment", "siteVisitRemoveControl", "baseVisitRecords",
      "filteredVisitRecords", "visitRecordRows", "visitAttachmentsMarkup", "baseFaultRecords",
      "filteredFaultRecords", "faultRecordRows", "faultPhotosMarkup",
    ]) {
      expect(production.match(new RegExp(`function ${name}\\(`, "g")) || [], name).toHaveLength(1);
    }
    expect(sitesPage).toContain("async function removeSiteVisitReportAttachment");
    expect(sitesPage).toContain("function openOperationalDeleteConfirmation");
  });
});
