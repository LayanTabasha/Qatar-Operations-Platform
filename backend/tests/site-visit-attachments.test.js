import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migration = fs.readFileSync(path.join(root, "src/db/migrations/016_persist_site_visit_attachments.sql"), "utf8");
const expandedMigration = fs.readFileSync(path.join(root, "src/db/migrations/017_expand_operational_attachments.sql"), "utf8");
const attachmentService = fs.readFileSync(path.join(root, "src/modules/attachments/attachments.service.js"), "utf8");
const officePreview = fs.readFileSync(path.join(root, "src/modules/attachments/office-preview.js"), "utf8");
const attachmentRoutes = fs.readFileSync(path.join(root, "src/modules/attachments/attachments.routes.js"), "utf8");
const frontendPreview = fs.readFileSync(path.resolve(root, "../js/file-preview.js"), "utf8");
const sitesPage = fs.readFileSync(path.resolve(root, "../js/sites-page.js"), "utf8");
const modals = fs.readFileSync(path.resolve(root, "../js/modals.js"), "utf8");
const dedupeSource = sitesPage.slice(
  sitesPage.indexOf("function deduplicateSiteVisitAttachments"),
  sitesPage.indexOf("function siteVisitStatusLabel"),
);
const deduplicateSiteVisitAttachments = Function(`${dedupeSource}; return deduplicateSiteVisitAttachments;`)();

describe("persistent Site Visit reports", () => {
  it("uses one durable attachment per visit with a real foreign key", () => {
    expect(migration).toContain("CREATE TABLE operational_attachments");
    expect(migration).toContain("site_visit_id uuid NOT NULL UNIQUE REFERENCES site_visits(id) ON DELETE CASCADE");
    expect(migration).toContain("file_size_bytes bigint NOT NULL");
  });

  it("persists document, fault, and troubleshooting uploads in the shared attachment store", () => {
    expect(expandedMigration).toContain("parent_type text");
    expect(expandedMigration).toContain("'documents', 'faults', 'weekly-reports', 'troubleshooting'");
    expect(expandedMigration).toContain("ALTER COLUMN site_visit_id DROP NOT NULL");
  });

  it("uses authenticated read and write endpoints", () => {
    expect(attachmentRoutes).toContain("attachmentsRouter.use(authenticate)");
    expect(attachmentRoutes).toContain("ROLE_GROUPS.authenticatedRead");
    expect(attachmentRoutes).toContain("ROLE_GROUPS.operationalManage");
  });

  it("validates content and caches LibreOffice previews", () => {
    expect(attachmentService).toContain("validateFileContent");
    expect(attachmentService).toContain("EMPTY_FILE");
    expect(officePreview).toContain("--headless");
    expect(attachmentService).toContain("previewInfo.mtimeMs >= sourceInfo.mtimeMs");
    expect(officePreview).toContain("OFFICE_PREVIEW_UNAVAILABLE");
    expect(officePreview).toContain("mkdtemp");
    expect(officePreview).toContain("OFFICE_CONVERSION_TIMEOUT");
    expect(officePreview).toContain("await rm(conversionDir, { recursive: true, force: true })");
  });

  it("uses backend preview and original-download URLs in one shared frontend viewer", () => {
    expect(frontendPreview).toContain("window.QatarOpsApi.Attachments.preview(file.id, file.previewUrl)");
    expect(frontendPreview).toContain("file.downloadUrl");
    expect(frontendPreview).toContain("sandbox");
    expect(frontendPreview).toContain("Office preview is temporarily unavailable. You can still download the original file.");
  });

  it("renders report metadata and actions in the Site Visits UI", () => {
    expect(sitesPage).toContain("Report / Attachment");
    expect(sitesPage).toContain("visitAttachmentsMarkup(visit)");
    expect(sitesPage).toContain("No report attached");
    expect(modals).toContain("Remove Report");
    expect(modals).toContain("siteVisitRemoveControl");
    expect(sitesPage).toContain("data-site-visit-report-remove");
    expect(sitesPage).toContain("canRemoveSiteVisitAttachment");
    expect(modals).toContain("Saving without a new file preserves the current file");
  });

  it("uses backend visit attachments as the authoritative deduplicated source", () => {
    expect(sitesPage).toContain("function deduplicateSiteVisitAttachments");
    expect(sitesPage).toContain("visit.attachmentRecords || []");
    expect(sitesPage).toContain('file.module !== "siteVisit"');
    expect(sitesPage).not.toContain('getValidUploads().filter((file) => file.siteVisitId === visit.id');
    const records = [
      { id: "attachment-1", name: "Site Visit Summary.pdf", size: 1200, siteVisitId: "visit-1" },
      { id: "attachment-1", name: "Site Visit Summary.pdf", size: 1200, siteVisitId: "visit-1" },
      { name: "Site Visit Summary.pdf", size: 1200, siteVisitId: "visit-1" },
    ];
    expect(deduplicateSiteVisitAttachments(records, "visit-1")).toEqual([records[0]]);
  });

  it("removes a report without removing its Site Visit", () => {
    expect(sitesPage).toContain("async function removeSiteVisitReportAttachment");
    expect(sitesPage).toContain("await window.QatarOpsApi.Attachments.remove(attachmentId)");
    expect(sitesPage).toContain("No report attached");
    expect(sitesPage).toContain("data-site-visit-report-remove");
  });
});
