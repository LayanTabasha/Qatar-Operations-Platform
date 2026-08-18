import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(process.cwd(), "..");

function readRootFile(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("frontend site visit workflow", () => {
  it("reads the actual Visit Date, Time In, and Time Out form fields", () => {
    const modalsSource = readRootFile("js/modals.js");
    const saveWorkflowStart = modalsSource.indexOf("async function simulateUpdate");
    const siteVisitStart = modalsSource.indexOf('if (type === "siteVisit")', saveWorkflowStart);
    const uploadStart = modalsSource.indexOf('if (["siteVisit"', siteVisitStart);
    const siteVisitSaveBlock = modalsSource.slice(siteVisitStart, uploadStart);

    expect(siteVisitSaveBlock).toContain('document.getElementById("visit-date")?.value');
    expect(siteVisitSaveBlock).toContain('document.getElementById("time-in")?.value');
    expect(siteVisitSaveBlock).toContain('document.getElementById("time-out")?.value');
    expect(siteVisitSaveBlock).not.toContain('document.getElementById("date")?.value');
  });

  it("sends visit_date, time_in, and time_out to the Site Visits API", () => {
    const modalsSource = readRootFile("js/modals.js");

    expect(modalsSource).toContain("visit_date: visitDate");
    expect(modalsSource).toContain("time_in: timeIn || null");
    expect(modalsSource).toContain("time_out: timeOut || null");
    expect(modalsSource).toContain("status: backendSiteVisitStatus");
    expect(modalsSource).toContain("await window.QatarOpsApi.SiteVisits.create(payload)");
    expect(modalsSource).toContain("await window.QatarOpsApi.SiteVisits.update(existing.id, payload)");
  });

  it("renders visitDate, timeIn, and timeOut from persisted records", () => {
    const sitesPageSource = readRootFile("frontend/pages/sites/site-visits.js");
    const mapperSource = readRootFile("frontend/pages/sites/sites-data-mappers.js");

    expect(mapperSource).toContain("visitDate: visit.visit_date");
    expect(mapperSource).toContain("timeIn: visit.time_in || \"\"");
    expect(mapperSource).toContain("timeOut: visit.time_out || \"\"");
    expect(mapperSource).toContain("recordedOn: visit.created_at");
    expect(mapperSource).toContain("recordedBy: visit.recorded_by_name");
    expect(sitesPageSource).toContain("formatMediumDate(visit.visitDate)");
  });

  it("provides role-aware edit/delete actions and exact confirmation", () => {
    const siteVisits = readRootFile("frontend/pages/sites/site-visits.js");
    const modals = readRootFile("js/modals.js");
    const api = readRootFile("js/api-client.js");
    expect(siteVisits).toContain('data-delete-type="siteVisit"');
    expect(siteVisits).toContain("canManageOperations()");
    expect(modals).toContain('setFieldValue("site", visit.siteName);\n      refreshChargerSelect();');
    expect(modals).toContain('operational-delete-confirmation")?.value.trim() !== "DELETE"');
    expect(modals).toContain("window.QatarOpsApi.SiteVisits.remove(form.dataset.recordId)");
    expect(api).toContain('remove(id) { return apiRequest(`/site-visits/${id}`, { method: "DELETE" })');
  });
});
