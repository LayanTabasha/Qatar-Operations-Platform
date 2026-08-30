import { beforeEach, describe, expect, it, vi } from "vitest";

const client = vi.hoisted(() => ({ query: vi.fn() }));
const transaction = vi.hoisted(() => ({ rolledBack: false, committed: false }));
const repositories = vi.hoisted(() => ({
  insertSiteVisit: vi.fn(), findSiteVisitById: vi.fn(), updateSiteVisitById: vi.fn(),
  listSiteVisits: vi.fn(), deleteSiteVisitById: vi.fn(), findLinkedFaultIds: vi.fn(),
}));
const links = vi.hoisted(() => ({ syncFaultLinks: vi.fn(), recalculateFaultStatuses: vi.fn() }));
const attachments = vi.hoisted(() => ({ deleteSiteVisitAttachmentRecords: vi.fn(), removeDeletedAttachmentFiles: vi.fn() }));
const log = vi.hoisted(() => ({ error: vi.fn() }));

vi.mock("../src/config/database.js", () => ({
  withTransaction: vi.fn(async (callback) => {
    try {
      const result = await callback(client);
      transaction.committed = true;
      return result;
    } catch (error) {
      transaction.rolledBack = true;
      throw error;
    }
  }),
}));
vi.mock("../src/modules/site-visits/site-visits.repository.js", () => repositories);
vi.mock("../src/modules/site-visits/fault-site-visits.repository.js", () => links);
vi.mock("../src/modules/operational-relations/operational-relations.repository.js", () => ({ chargerBelongsToSite: vi.fn().mockResolvedValue(true) }));
vi.mock("../src/modules/attachments/attachments.repository.js", () => ({ deleteSiteVisitAttachmentRecords: attachments.deleteSiteVisitAttachmentRecords }));
vi.mock("../src/modules/attachments/attachments.service.js", () => ({ removeDeletedAttachmentFiles: attachments.removeDeletedAttachmentFiles }));
vi.mock("../src/config/logger.js", () => ({ logger: log }));

const { createSiteVisit, deleteSiteVisit } = await import("../src/modules/site-visits/site-visits.service.js");

describe("atomic Site Visit lifecycle writes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    transaction.rolledBack = false;
    transaction.committed = false;
    repositories.insertSiteVisit.mockResolvedValue({ id: "visit-1", site_id: "site-1" });
    repositories.findSiteVisitById.mockResolvedValue({ id: "visit-1", site_id: "site-1" });
    repositories.findLinkedFaultIds.mockResolvedValue(["fault-1"]);
    repositories.deleteSiteVisitById.mockResolvedValue(true);
    attachments.deleteSiteVisitAttachmentRecords.mockResolvedValue([{ storage_path: "/tmp/report.pdf", preview_path: null }]);
    attachments.removeDeletedAttachmentFiles.mockResolvedValue(undefined);
  });

  it("rolls back the Site Visit write when Fault link synchronization fails", async () => {
    links.syncFaultLinks.mockRejectedValue(new Error("link synchronization failed"));
    await expect(createSiteVisit({
      site_id: "site-1", charger_id: null, visit_date: "2026-08-30", time_in: "09:00",
      time_out: "10:00", visited_by: "Engineer", purpose: "Inspection", status: "completed",
      related_faults: [{ fault_id: "fault-1", status_after_visit: "monitoring" }],
    }, "user-1")).rejects.toThrow("link synchronization failed");

    expect(repositories.insertSiteVisit).toHaveBeenCalledWith(expect.any(Object), client);
    expect(links.syncFaultLinks).toHaveBeenCalledWith(client, "visit-1", "site-1", expect.any(Array), "user-1");
    expect(transaction.rolledBack).toBe(true);
    expect(transaction.committed).toBe(false);
  });

  it("rolls back attachment metadata and skips physical cleanup when Site Visit deletion fails", async () => {
    repositories.deleteSiteVisitById.mockRejectedValue(new Error("delete failed"));
    await expect(deleteSiteVisit("visit-1", "user-1")).rejects.toThrow("delete failed");
    expect(attachments.deleteSiteVisitAttachmentRecords).toHaveBeenCalledWith("visit-1", client);
    expect(transaction.rolledBack).toBe(true);
    expect(transaction.committed).toBe(false);
    expect(attachments.removeDeletedAttachmentFiles).not.toHaveBeenCalled();
    expect(links.recalculateFaultStatuses).not.toHaveBeenCalled();
  });

  it("commits attachment and Site Visit deletion with Fault recalculation before file cleanup", async () => {
    attachments.removeDeletedAttachmentFiles.mockImplementation(async () => {
      expect(transaction.committed).toBe(true);
    });
    await deleteSiteVisit("visit-1", "user-1");
    expect(repositories.findLinkedFaultIds).toHaveBeenCalledWith("visit-1", client);
    expect(attachments.deleteSiteVisitAttachmentRecords).toHaveBeenCalledWith("visit-1", client);
    expect(repositories.deleteSiteVisitById).toHaveBeenCalledWith("visit-1", "user-1", expect.any(Object), {}, client);
    expect(links.recalculateFaultStatuses).toHaveBeenCalledWith(client, ["fault-1"], "user-1");
    expect(transaction.committed).toBe(true);
    expect(attachments.removeDeletedAttachmentFiles).toHaveBeenCalledOnce();
  });

  it("keeps committed deletion and logs when post-commit file cleanup fails", async () => {
    const cleanupError = new Error("filesystem unavailable");
    attachments.removeDeletedAttachmentFiles.mockRejectedValue(cleanupError);
    await expect(deleteSiteVisit("visit-1", "user-1")).resolves.toBeUndefined();
    expect(transaction.committed).toBe(true);
    expect(transaction.rolledBack).toBe(false);
    expect(log.error).toHaveBeenCalledWith(
      expect.objectContaining({ err: cleanupError, siteVisitId: "visit-1", attachmentCount: 1 }),
      "Site Visit deleted but attachment file cleanup failed",
    );
  });

  it("deletes a Site Visit without attachments", async () => {
    attachments.deleteSiteVisitAttachmentRecords.mockResolvedValue([]);
    await expect(deleteSiteVisit("visit-1", "user-1")).resolves.toBeUndefined();
    expect(transaction.committed).toBe(true);
    expect(attachments.removeDeletedAttachmentFiles).toHaveBeenCalledWith([]);
  });
});
