import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

const root = path.resolve(process.cwd(), "..");
const mapperPath = "frontend/pages/sites/sites-data-mappers.js";
const mapperSource = fs.readFileSync(path.join(root, mapperPath), "utf8");
const sitesSource = fs.readFileSync(path.join(root, "frontend/pages/sites/sites-data.js"), "utf8");
const modalsSource = ["frontend/shared/modals/modal-files.js", "frontend/shared/modals/fault-modals.js", "frontend/shared/modals/modal-configs.js", "frontend/shared/modals/modal-core.js", "frontend/shared/modals/modal-submit.js"].map((file) => fs.readFileSync(path.join(root, file), "utf8")).join("\n");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");

function runtime() {
  const dom = new JSDOM("<!doctype html>", { runScripts: "outside-only" });
  const context = dom.getInternalVMContext();
  vm.runInContext(fs.readFileSync(path.join(root, "js/state.js"), "utf8"), context);
  vm.runInContext("function calculateVisitDuration(start, end) { return start && end ? '1h' : ''; }", context);
  vm.runInContext(mapperSource, context, { filename: mapperPath });
  return context;
}

describe("Sites data mappers", () => {
  it("maps Chargers and Sites with natural AC/DC ordering and versioned Site images", () => {
    const context = runtime();
    const chargers = [
      context.mapBackendCharger({ id: "dc-10", site_id: "site-1", site_name: "Msheireb", name: "DC Charger 10", type: "DC", power_kw: "50.5", status: "active" }),
      context.mapBackendCharger({ id: "ac-2", site_id: "site-1", site_name: "Msheireb", name: "AC Charger 2", type: "AC", power_kw: 22, status: "maintenance" }),
      context.mapBackendCharger({ id: "ac-10", site_id: "site-1", site_name: "Msheireb", name: "AC Charger 10", type: "AC", power_kw: null, status: "active" }),
    ];
    expect(chargers[0]).toMatchObject({ capacity: "50.5 kW", status: "Active", backendStatus: "active" });
    expect(chargers[1]).toMatchObject({ capacity: "22 kW", status: "Maintenance" });
    const site = context.mapBackendSite({ id: "site-1", name: "Msheireb", status: "active", image_path: "/uploads/site.jpg", updated_at: "2026-08-18T10:00:00Z" }, chargers);
    expect(site.chargers.map(({ id }) => id)).toEqual(["ac-2", "ac-10", "dc-10"]);
    expect(site.image).toBe("/uploads/site.jpg?v=2026-08-18T10%3A00%3A00Z");
    expect(context.mapBackendSite({ id: "site-2", name: "Inactive", status: "inactive" }, [])).toMatchObject({ status: "Inactive", backendStatus: "inactive" });
    expect(context.mapBackendSite({ id: "site-3", name: "Maintenance", status: "maintenance" }, [])).toMatchObject({ status: "Under Maintenance", backendStatus: "maintenance" });
    expect(context.imagePathWithVersion("https://example.test/site.jpg", "date")).toBe("https://example.test/site.jpg");
  });

  it("maps Site Visits, attachment metadata, status conversion, and deduplication", () => {
    const context = runtime();
    const attachment = { id: "attachment-1", original_filename: "Visit.PDF", mime_type: "application/pdf", file_size_bytes: "2048", uploaded_by_name: "Engineer", created_at: "2026-08-18T12:00:00Z", preview_available: true };
    const mappedAttachment = context.mapBackendAttachment(attachment, { siteVisitId: "visit-1" });
    expect(mappedAttachment).toMatchObject({ id: "attachment-1", name: "Visit.PDF", extension: ".pdf", size: 2048, persisted: true, siteVisitId: "visit-1" });
    const visit = context.mapBackendSiteVisit({ id: "visit-1", site_id: "site-1", site_name: "Msheireb", charger_id: "charger-1", charger_name: "AC Charger 2", visit_date: "2026-08-18", status: "follow_up_required", time_in: "09:00", time_out: "10:00", attachments: [attachment, attachment] });
    expect(visit).toMatchObject({ status: "Follow-Up Required", backendStatus: "follow_up_required", duration: "1h", attachments: ["attachment-1"] });
    expect(visit.attachmentRecords).toHaveLength(1);
    expect(context.backendSiteVisitStatus("Follow-Up Required")).toBe("follow_up_required");
    expect(context.siteVisitStatusLabel("scheduled")).toBe("Scheduled");
    expect(context.siteVisitStatusLabel("completed")).toBe("Completed");
    expect(context.siteVisitStatusLabel("cancelled")).toBe("cancelled");
  });

  it("maps persisted content with and without an attachment", () => {
    const context = runtime();
    const base = { id: "document-1", title: "Manual", site_name: "Al Mana", charger_id: "charger-1", charger_name: "AC 1", document_type: "Manual", created_at: "2026-08-18T00:00:00Z" };
    const parentOnly = context.mapContentRecord({ ...base, attachments: [] }, "document");
    expect(parentOnly).toMatchObject({ id: "record-document-1", recordId: "document-1", recordPersisted: true, attachmentPersisted: false, persisted: false });
    const attached = context.mapContentRecord({ ...base, attachments: [{ id: "file-1", original_filename: "manual.pdf", mime_type: "application/pdf", file_size_bytes: 100 }] }, "document");
    expect(attached).toMatchObject({ id: "file-1", recordId: "document-1", recordPersisted: true, attachmentPersisted: true, persisted: true });
  });

  it("reconciles persisted and legacy content with unchanged identity rules", () => {
    const context = runtime();
    const backend = [{ kind: "document", name: "Manual.pdf", recordPersisted: true }];
    const legacy = [{ kind: "document", name: " manual.PDF " }, { kind: "guide", name: "guide.pdf" }];
    expect(context.reconcileLegacyContentUploads(backend, legacy)).toEqual([legacy[1]]);
  });

  it("loads before Sites and Modals while preserving externally required globals", () => {
    const sources = Array.from(index.matchAll(/<script\s+src="([^"]+)"/g), (match) => match[1].split("?")[0]);
    const mapperIndex = sources.indexOf(mapperPath);
    expect(mapperIndex).toBeGreaterThan(sources.indexOf("js/state.js"));
    expect(mapperIndex).toBeLessThan(sources.indexOf("frontend/pages/sites/sites-data.js"));
    expect(mapperIndex).toBeLessThan(sources.indexOf("frontend/shared/modals/modal-core.js"));
    const context = runtime();
    for (const name of ["mapBackendSiteVisit", "mapBackendAttachment", "deduplicateSiteVisitAttachments", "backendSiteVisitStatus"]) {
      expect(typeof context[name], name).toBe("function");
      expect(modalsSource).toContain(`${name}(`);
    }
  });

  it("keeps every moved production definition in exactly one file", () => {
    const names = ["imagePathWithVersion", "statusLabel", "mapBackendCharger", "mapBackendSite", "contentIdentityValue", "contentRecordIdentity", "reconcileLegacyContentUploads", "mapContentRecord", "mapBackendSiteVisit", "mapBackendAttachment", "extensionFromName", "deduplicateSiteVisitAttachments", "siteVisitStatusLabel", "backendSiteVisitStatus"];
    const production = `${mapperSource}\n${sitesSource}`;
    for (const name of names) {
      expect(production.match(new RegExp(`function ${name}\\s*\\(`, "g")) || [], name).toHaveLength(1);
      expect(mapperSource).toMatch(new RegExp(`function ${name}\\s*\\(`));
      expect(sitesSource).not.toMatch(new RegExp(`function ${name}\\s*\\(`));
    }
  });
});
