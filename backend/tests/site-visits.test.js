import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const authRepositoryMocks = vi.hoisted(() => ({
  findSafeUserById: vi.fn(),
}));

const siteVisitsRepositoryMocks = vi.hoisted(() => ({
  listSiteVisits: vi.fn(),
  findSiteVisitById: vi.fn(),
  insertSiteVisit: vi.fn(),
  updateSiteVisitById: vi.fn(),
  deleteSiteVisitById: vi.fn(),
  findLinkedFaultIds: vi.fn(),
}));

const relationshipMocks = vi.hoisted(() => ({ chargerBelongsToSite: vi.fn() }));
const attachmentRepositoryMocks = vi.hoisted(() => ({ deleteSiteVisitAttachmentRecords: vi.fn() }));
const attachmentMocks = vi.hoisted(() => ({ removeDeletedAttachmentFiles: vi.fn() }));
const transactionClient = vi.hoisted(() => ({ query: vi.fn() }));

vi.mock("../src/config/database.js", () => ({
  query: vi.fn(),
  withTransaction: vi.fn((callback) => callback(transactionClient)),
  testDatabaseConnection: vi.fn(),
  closeDatabasePool: vi.fn(),
  pool: {},
}));

vi.mock("../src/modules/auth/auth.repository.js", () => ({
  findUserWithPasswordByEmail: vi.fn(),
  findSafeUserById: authRepositoryMocks.findSafeUserById,
  updateLastLoginAt: vi.fn(),
}));

vi.mock("../src/modules/site-visits/site-visits.repository.js", () => siteVisitsRepositoryMocks);
vi.mock("../src/modules/operational-relations/operational-relations.repository.js", () => relationshipMocks);
vi.mock("../src/modules/attachments/attachments.repository.js", () => attachmentRepositoryMocks);
vi.mock("../src/modules/attachments/attachments.service.js", () => attachmentMocks);

let app;
let jwt;

const adminUser = {
  id: "11111111-1111-4111-8111-111111111111",
  full_name: "Admin User",
  email: "admin@example.com",
  role: "admin",
  is_active: true,
};
const operationsUser = { ...adminUser, role: "operations_staff" };
const hqUser = { ...adminUser, role: "hq_user" };
const viewerUser = { ...adminUser, role: "viewer" };
const siteVisitId = "77777777-7777-4777-8777-777777777777";
const siteId = "33333333-3333-4333-8333-333333333333";
const chargerId = "44444444-4444-4444-8444-444444444444";
const visitSummary = {
  id: siteVisitId,
  site_id: siteId,
  site_name: "Msheireb",
  charger_id: chargerId,
  charger_name: "DC Charger 01",
  visit_date: "2026-06-22",
  time_in: "09:30",
  time_out: "11:15",
  visited_by: "Engineer One",
  purpose: "Inspection",
  status: "completed",
  observations: "All good",
  actions_taken: "Checked charger",
  follow_up_required: false,
  report_file_path: null,
  created_by: adminUser.id,
  recorded_by_name: "Admin User",
  created_at: "2026-07-27T06:00:00.000Z",
  updated_by: adminUser.id,
  last_modified_by_name: "Admin User",
  updated_at: "2026-07-27T06:00:00.000Z",
};

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  process.env.PORT = "3000";
  process.env.DATABASE_URL = "postgresql://username:password@localhost:5432/qatar_operations";
  process.env.DATABASE_SSL = "false";
  process.env.FRONTEND_ORIGIN = "http://localhost:5500";
  process.env.LOG_LEVEL = "silent";
  process.env.TRUST_PROXY = "false";
  process.env.JWT_SECRET = "test-secret-value-that-is-long-enough-for-validation";
  process.env.JWT_EXPIRES_IN = "8h";
  process.env.AUTH_COOKIE_NAME = "qatar_ops_token";
  process.env.COOKIE_SECURE = "false";
  process.env.COOKIE_SAME_SITE = "lax";

  ({ app } = await import("../src/app.js"));
  jwt = await import("jsonwebtoken");
});

beforeEach(() => {
  vi.clearAllMocks();
  siteVisitsRepositoryMocks.listSiteVisits.mockResolvedValue([visitSummary]);
  siteVisitsRepositoryMocks.findSiteVisitById.mockResolvedValue(visitSummary);
  siteVisitsRepositoryMocks.insertSiteVisit.mockResolvedValue(visitSummary);
  siteVisitsRepositoryMocks.updateSiteVisitById.mockResolvedValue(visitSummary);
  siteVisitsRepositoryMocks.deleteSiteVisitById.mockResolvedValue(true);
  siteVisitsRepositoryMocks.findLinkedFaultIds.mockResolvedValue([]);
  relationshipMocks.chargerBelongsToSite.mockResolvedValue(true);
  attachmentRepositoryMocks.deleteSiteVisitAttachmentRecords.mockResolvedValue([]);
  attachmentMocks.removeDeletedAttachmentFiles.mockResolvedValue(undefined);
});

function authCookie(user) {
  const token = jwt.default.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: "8h",
  });

  authRepositoryMocks.findSafeUserById.mockResolvedValue(user);
  return [`qatar_ops_token=${token}`];
}

describe("site visit routes", () => {
  it("lists site visits with selected visit date and times", async () => {
    const response = await request(app).get("/api/v1/site-visits").set("Cookie", authCookie(viewerUser)).expect(200);

    expect(response.body.site_visits[0]).toMatchObject({
      visit_date: "2026-06-22",
      time_in: "09:30",
      time_out: "11:15",
      status: "completed",
      recorded_by_name: "Admin User",
      last_modified_by_name: "Admin User",
    });
  });

  it("allows operations staff to create a site visit with visit date and times", async () => {
    const response = await request(app)
      .post("/api/v1/site-visits")
      .set("Cookie", authCookie(operationsUser))
      .send({
        site_id: siteId,
        charger_id: chargerId,
        visit_date: "2026-06-22",
        time_in: "09:30",
        time_out: "11:15",
        visited_by: "Engineer One",
        purpose: "Inspection",
        status: "completed",
      })
      .expect(201);

    expect(response.body.site_visit.visit_date).toBe("2026-06-22");
    expect(response.body.site_visit.time_in).toBe("09:30");
    expect(response.body.site_visit.time_out).toBe("11:15");
    expect(siteVisitsRepositoryMocks.insertSiteVisit).toHaveBeenCalledWith(
      expect.objectContaining({
        visit_date: "2026-06-22",
        time_in: "09:30",
        time_out: "11:15",
        status: "completed",
        created_by: operationsUser.id,
        updated_by: operationsUser.id,
      }),
      transactionClient,
    );
  });

  it("allows HQ users to create, edit, and delete site visits", async () => {
    const input = { site_id: siteId, visit_date: "2026-06-22", time_in: "09:30", time_out: "11:15", visited_by: "HQ", purpose: "Inspection", status: "completed" };
    await request(app).post("/api/v1/site-visits").set("Cookie", authCookie(hqUser)).send(input).expect(201);
    await request(app).patch(`/api/v1/site-visits/${siteVisitId}`).set("Cookie", authCookie(hqUser)).send({ purpose: "Updated" }).expect(200);
    await request(app).delete(`/api/v1/site-visits/${siteVisitId}`).set("Cookie", authCookie(hqUser)).expect(204);
  });

  it("allows scheduled visits without time out", async () => {
    await request(app)
      .post("/api/v1/site-visits")
      .set("Cookie", authCookie(operationsUser))
      .send({
        site_id: siteId,
        visit_date: "2026-06-22",
        time_in: "09:30",
        visited_by: "Engineer One",
        purpose: "Inspection",
        status: "scheduled",
      })
      .expect(201);

    const insertedVisit = siteVisitsRepositoryMocks.insertSiteVisit.mock.calls[0][0];
    expect(insertedVisit).toMatchObject({ status: "scheduled", time_in: "09:30" });
    expect(insertedVisit.time_out).toBeUndefined();
  });

  it("requires time out for completed visits", async () => {
    const response = await request(app)
      .post("/api/v1/site-visits")
      .set("Cookie", authCookie(operationsUser))
      .send({
        site_id: siteId,
        visit_date: "2026-06-22",
        time_in: "09:30",
        visited_by: "Engineer One",
        purpose: "Inspection",
        status: "completed",
      })
      .expect(400);

    expect(response.body.error.message).toContain("Time Out is required when a Site Visit is completed.");
  });

  it("rejects changing a scheduled visit to completed without Time Out", async () => {
    siteVisitsRepositoryMocks.findSiteVisitById.mockResolvedValue({ ...visitSummary, status: "scheduled", time_out: null });
    const response = await request(app).patch(`/api/v1/site-visits/${siteVisitId}`).set("Cookie", authCookie(operationsUser))
      .send({ status: "completed" }).expect(400);
    expect(response.body.error).toMatchObject({
      code: "SITE_VISIT_TIME_OUT_REQUIRED",
      message: "Time Out is required when a Site Visit is completed.",
    });
    expect(siteVisitsRepositoryMocks.updateSiteVisitById).not.toHaveBeenCalled();
  });

  it("allows changing a scheduled visit to completed with Time Out", async () => {
    siteVisitsRepositoryMocks.findSiteVisitById.mockResolvedValue({ ...visitSummary, status: "scheduled", time_out: null });
    await request(app).patch(`/api/v1/site-visits/${siteVisitId}`).set("Cookie", authCookie(operationsUser))
      .send({ status: "completed", time_out: "11:15" }).expect(200);
    expect(siteVisitsRepositoryMocks.updateSiteVisitById).toHaveBeenCalledWith(
      siteVisitId,
      expect.objectContaining({ status: "completed", time_out: "11:15" }),
      expect.any(Object),
      transactionClient,
    );
  });

  it("allows unrelated updates to a completed visit with an existing Time Out", async () => {
    await request(app).patch(`/api/v1/site-visits/${siteVisitId}`).set("Cookie", authCookie(operationsUser))
      .send({ observations: "Updated notes" }).expect(200);
    expect(siteVisitsRepositoryMocks.updateSiteVisitById).toHaveBeenCalled();
  });

  it("rejects clearing Time Out from a completed visit", async () => {
    const response = await request(app).patch(`/api/v1/site-visits/${siteVisitId}`).set("Cookie", authCookie(operationsUser))
      .send({ time_out: null }).expect(400);
    expect(response.body.error.message).toBe("Time Out is required when a Site Visit is completed.");
    expect(siteVisitsRepositoryMocks.updateSiteVisitById).not.toHaveBeenCalled();
  });

  it("allows a non-completed visit to retain a null Time Out", async () => {
    siteVisitsRepositoryMocks.findSiteVisitById.mockResolvedValue({ ...visitSummary, status: "scheduled", time_out: null });
    await request(app).patch(`/api/v1/site-visits/${siteVisitId}`).set("Cookie", authCookie(operationsUser))
      .send({ observations: "Visit rescheduled" }).expect(200);
    expect(siteVisitsRepositoryMocks.updateSiteVisitById).toHaveBeenCalled();
  });

  it.each(["scheduled", "completed", "follow_up_required"])("accepts the %s lifecycle status", async (status) => {
    await request(app).patch(`/api/v1/site-visits/${siteVisitId}`).set("Cookie", authCookie(operationsUser)).send({ status }).expect(200);
    expect(siteVisitsRepositoryMocks.updateSiteVisitById).toHaveBeenCalledWith(siteVisitId, expect.objectContaining({ status }), expect.any(Object), transactionClient);
  });

  it.each(["ongoing", "cancelled"])("rejects the removed %s lifecycle status", async (status) => {
    await request(app).patch(`/api/v1/site-visits/${siteVisitId}`).set("Cookie", authCookie(operationsUser)).send({ status }).expect(400);
    expect(siteVisitsRepositoryMocks.updateSiteVisitById).not.toHaveBeenCalled();
  });

  it("allows operations staff to update visit date and times", async () => {
    await request(app)
      .patch(`/api/v1/site-visits/${siteVisitId}`)
      .set("Cookie", authCookie(operationsUser))
      .send({
        visit_date: "2026-06-23",
        time_in: "10:00",
        time_out: "12:00",
        status: "completed",
      })
      .expect(200);

    expect(siteVisitsRepositoryMocks.updateSiteVisitById).toHaveBeenCalledWith(
      siteVisitId,
      expect.objectContaining({
        visit_date: "2026-06-23",
        time_in: "10:00",
        time_out: "12:00",
        status: "completed",
        updated_by: operationsUser.id,
      }),
      expect.any(Object),
      transactionClient,
    );
  });

  it("rejects viewers when creating or editing site visits", async () => {
    await request(app)
      .post("/api/v1/site-visits")
      .set("Cookie", authCookie(viewerUser))
      .send({
        site_id: siteId,
        visit_date: "2026-06-22",
        visited_by: "Viewer",
        purpose: "Inspection",
      })
      .expect(403);

    await request(app)
      .patch(`/api/v1/site-visits/${siteVisitId}`)
      .set("Cookie", authCookie(viewerUser))
      .send({ time_in: "10:00" })
      .expect(403);
  });

  it("rejects a charger that does not belong to the selected site", async () => {
    relationshipMocks.chargerBelongsToSite.mockResolvedValue(false);
    await request(app).patch(`/api/v1/site-visits/${siteVisitId}`).set("Cookie", authCookie(operationsUser))
      .send({ site_id: siteId, charger_id: chargerId }).expect(400);
    expect(siteVisitsRepositoryMocks.updateSiteVisitById).not.toHaveBeenCalled();
  });

  it("allows admin and operations deletion with attachment cleanup, but denies viewers", async () => {
    const attachments = [{ storage_path: "/managed/uploads/report.pdf", preview_path: null }];
    attachmentRepositoryMocks.deleteSiteVisitAttachmentRecords.mockResolvedValue(attachments);
    await request(app).delete(`/api/v1/site-visits/${siteVisitId}`).set("Cookie", authCookie(operationsUser)).expect(204);
    expect(attachmentRepositoryMocks.deleteSiteVisitAttachmentRecords).toHaveBeenCalledWith(siteVisitId, transactionClient);
    expect(attachmentMocks.removeDeletedAttachmentFiles).toHaveBeenCalledWith(attachments);
    expect(siteVisitsRepositoryMocks.deleteSiteVisitById).toHaveBeenCalledWith(siteVisitId, operationsUser.id, visitSummary, expect.any(Object), transactionClient);
    await request(app).delete(`/api/v1/site-visits/${siteVisitId}`).set("Cookie", authCookie(viewerUser)).expect(403);
  });

  it("rejects time out earlier than time in", async () => {
    await request(app)
      .post("/api/v1/site-visits")
      .set("Cookie", authCookie(operationsUser))
      .send({
        site_id: siteId,
        visit_date: "2026-06-22",
        time_in: "12:00",
        time_out: "10:00",
        visited_by: "Engineer One",
        purpose: "Inspection",
      })
      .expect(400);
  });
});
