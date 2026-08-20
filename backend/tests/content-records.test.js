import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const routes=fs.readFileSync(path.join(root,"src/modules/content-records/content-records.routes.js"),"utf8");
const apiRoutes=fs.readFileSync(path.join(root,"src/routes/index.js"),"utf8");
const frontend=fs.readFileSync(path.resolve(root,"../frontend/pages/sites/operational-records.js"),"utf8");
const modals=fs.readFileSync(path.resolve(root,"../js/modals.js"),"utf8");
const app=fs.readFileSync(path.resolve(root,"../app.js"),"utf8");
const repository=fs.readFileSync(path.join(root,"src/modules/content-records/content-records.repository.js"),"utf8");

describe("persistent content record management",()=>{
  it("mounts one CRUD route for each requested module",()=>{
    expect(apiRoutes).toContain('apiRouter.use("/documents", contentRecordsRouter("documents"))');
    expect(apiRoutes).toContain('apiRouter.use("/weekly-reports", contentRecordsRouter("weekly-reports"))');
    expect(apiRoutes).toContain('apiRouter.use("/troubleshooting", contentRecordsRouter("troubleshooting"))');
    expect(routes).toContain('router.get("/:id"');
    expect(routes).toContain('router.patch("/:id"');
    expect(routes).toContain('router.delete("/:id"');
  });
  it("uses current authorization and cleans files after an atomic record deletion",()=>{
    expect(routes).toContain("authorizeRoles(...ROLE_GROUPS.operationalManage)");
    expect(routes).toContain("await removeDeletedAttachmentFiles(deleted.attachments)");
    expect(repository).toContain("DELETE FROM operational_attachments");
    expect(repository).toContain("RETURNING storage_path,preview_path");
    expect(routes).toContain("req.user.id");
  });
  it("validates document and troubleshooting charger reassignment against the selected site",()=>{
    expect(routes).toContain("chargerBelongsToSite");
    expect(routes).toContain("INVALID_CONTENT_RELATIONSHIP");
    expect(routes).toContain('type === "weekly-reports"');
  });
  it("renders role-aware View, Download, Edit, and Delete controls",()=>{
    expect(frontend).toContain('data-content-view');
    expect(frontend).toContain('data-content-edit');
    expect(frontend).toContain('data-content-delete');
    expect(frontend).toContain("file.attachmentPersisted === true && file.persisted === true");
    expect(frontend).toContain("Boolean(file.recordId) && file.recordPersisted === true");
    expect(frontend).toContain('canManageOperations() ?');
    expect(frontend).not.toContain('disabled title="Your account is read-only"');
    expect(app).toContain("openContentRecordDetail");
  });
  it("populates existing values, preserves metadata-only attachments, and safely replaces files",()=>{
    expect(modals).toContain('state.currentContentRecordId');
    expect(modals).toContain('setFieldValue("document-title", record.title)');
    expect(modals).toContain("window.QatarOpsApi.Attachments.replace(existingFile.id");
    expect(modals).toContain("Saving without a new file preserves the current file");
    expect(modals).toContain("The existing attachment remains active");
  });
  it("uses explicit contextual delete confirmation and refreshes from the backend",()=>{
    expect(frontend).toContain("Type DELETE to confirm");
    expect(frontend).toContain('detailRow("Record title"');
    expect(frontend).toContain('detailRow("Record type"');
    expect(frontend).toContain('detailRow("Related site"');
    expect(frontend).toContain('detailRow("Attachment removed"');
    expect(modals).toContain('window.QatarOpsApi.ContentRecords.remove(form.dataset.contentType, form.dataset.recordId)');
    expect(modals).toContain("await loadOperationalData()");
  });
  it("writes update and delete events through the existing audit log",()=>{
    for (const action of ["document_updated","document_deleted","weekly_report_updated","weekly_report_deleted","troubleshooting_updated","troubleshooting_deleted"]) {
      expect(repository).toContain(action.split("_").slice(-1)[0]);
    }
    expect(repository).toContain("insertActivityLog(client");
    expect(repository).toContain("site_name");
    expect(repository).toContain("charger_name");
  });
});
