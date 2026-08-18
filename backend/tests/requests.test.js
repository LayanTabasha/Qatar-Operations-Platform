import fs from "node:fs";
import path from "node:path";
import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({ findSafeUserById: vi.fn() }));
const repository = vi.hoisted(() => ({ listRequests: vi.fn(), findRequestById: vi.fn(), findRequestByIdIncludingDeleted: vi.fn(), insertRequest: vi.fn(), updateRequestById: vi.fn(), softDeleteRequestById: vi.fn() }));
vi.mock("../src/modules/auth/auth.repository.js", () => ({ findUserWithPasswordByEmail: vi.fn(), findSafeUserById: authMocks.findSafeUserById, updateLastLoginAt: vi.fn() }));
vi.mock("../src/modules/requests/requests.repository.js", () => repository);

let app, jwt;
const userId = "11111111-1111-4111-8111-111111111111";
const requestId = "22222222-2222-4222-8222-222222222222";
const siteId = "33333333-3333-4333-8333-333333333333";
const chargerId = "44444444-4444-4444-8444-444444444444";
const base = { id: requestId, request_reference: "REQ-2026-000001", title: "Firmware support", description: "Investigate issue", category: "firmware", priority: "high", status: "open", site_id: siteId, charger_id: chargerId, requested_by: userId, started_at: null, completed_at: null, hq_response: null, deleted_at: null };
const users = Object.fromEntries(["admin", "hq_user", "viewer", "operations_staff"].map((role) => [role, { id: userId, full_name: role, email: `${role}@example.com`, role, is_active: true }]));

beforeAll(async () => {
  Object.assign(process.env, { NODE_ENV: "test", PORT: "3000", DATABASE_URL: "postgresql://x:x@localhost/x", DATABASE_SSL: "false", FRONTEND_ORIGIN: "http://localhost:5500", LOG_LEVEL: "silent", TRUST_PROXY: "false", JWT_SECRET: "test-secret-value-that-is-long-enough-for-validation", JWT_EXPIRES_IN: "8h", AUTH_COOKIE_NAME: "qatar_ops_token", COOKIE_SECURE: "false", COOKIE_SAME_SITE: "lax" });
  ({ app } = await import("../src/app.js")); jwt = await import("jsonwebtoken");
});
beforeEach(() => {
  vi.clearAllMocks(); repository.listRequests.mockResolvedValue([base]); repository.findRequestById.mockResolvedValue(base);
  repository.findRequestByIdIncludingDeleted.mockResolvedValue(base); repository.softDeleteRequestById.mockResolvedValue({ ...base, deleted_at: new Date().toISOString(), deleted_by: userId });
  repository.insertRequest.mockResolvedValue(base); repository.updateRequestById.mockImplementation(async (_id, updates) => ({ ...base, ...updates }));
});
function cookie(role) { const user = users[role]; authMocks.findSafeUserById.mockResolvedValue(user); return [`qatar_ops_token=${jwt.default.sign({ sub: user.id, role }, process.env.JWT_SECRET)}`]; }
const createPayload = { title: base.title, description: base.description, category: "firmware", priority: "high", site_id: siteId, charger_id: chargerId, due_date: "2026-08-20" };

describe("Operations Requests API", () => {
  it("allows admins to create and HQ users to read, but denies HQ create", async () => {
    await request(app).post("/api/v1/requests").set("Cookie", cookie("admin")).send(createPayload).expect(201);
    expect(repository.insertRequest).toHaveBeenCalledWith(expect.objectContaining({ due_date: "2026-08-20" }), userId, expect.any(Object));
    await request(app).get(`/api/v1/requests/${requestId}`).set("Cookie", cookie("hq_user")).expect(200);
    await request(app).post("/api/v1/requests").set("Cookie", cookie("hq_user")).send(createPayload).expect(403);
  });

  it("rejects Operations Staff from every Requests endpoint", async () => {
    await request(app).get("/api/v1/requests").set("Cookie", cookie("operations_staff")).expect(403);
    await request(app).get(`/api/v1/requests/${requestId}`).set("Cookie", cookie("operations_staff")).expect(403);
    await request(app).post("/api/v1/requests").set("Cookie", cookie("operations_staff")).send(createPayload).expect(403);
    await request(app).patch(`/api/v1/requests/${requestId}`).set("Cookie", cookie("operations_staff")).send({ hq_response: "Supporting response" }).expect(403);
  });

  it("denies viewers all Requests access", async () => {
    await request(app).get("/api/v1/requests").set("Cookie", cookie("viewer")).expect(403);
  });

  it("denies unauthenticated users", async () => { await request(app).get("/api/v1/requests").expect(401); });

  it("allows an admin to soft delete their own completed Request", async () => {
    repository.findRequestByIdIncludingDeleted.mockResolvedValue({ ...base, status: "completed" });
    await request(app).delete(`/api/v1/requests/${requestId}`).set("Cookie", cookie("admin")).expect(200);
    expect(repository.softDeleteRequestById).toHaveBeenCalledWith(requestId, userId, expect.any(Object));
  });

  it("denies deletion of another creator's Request", async () => {
    repository.findRequestByIdIncludingDeleted.mockResolvedValue({ ...base, requested_by: "55555555-5555-4555-8555-555555555555" });
    await request(app).delete(`/api/v1/requests/${requestId}`).set("Cookie", cookie("admin")).expect(403);
    expect(repository.softDeleteRequestById).not.toHaveBeenCalled();
  });

  it.each(["hq_user", "operations_staff", "viewer"])("denies %s Request deletion", async (role) => {
    await request(app).delete(`/api/v1/requests/${requestId}`).set("Cookie", cookie(role)).expect(403);
    expect(repository.softDeleteRequestById).not.toHaveBeenCalled();
  });

  it("denies unauthenticated Request deletion", async () => {
    await request(app).delete(`/api/v1/requests/${requestId}`).expect(401);
  });

  it("passes filters including overdue and defaults to newest-first repository behavior", async () => {
    await request(app).get(`/api/v1/requests?status=open&priority=high&category=firmware&site_id=${siteId}&charger_id=${chargerId}&assigned_to=${userId}&search=firmware&overdue=true`).set("Cookie", cookie("admin")).expect(200);
    expect(repository.listRequests).toHaveBeenCalledWith(expect.objectContaining({ status: "open", priority: "high", category: "firmware", overdue: true, search: "firmware" }));
  });

  it("enforces workflow timestamps and preserves response on reopen", async () => {
    await request(app).patch(`/api/v1/requests/${requestId}`).set("Cookie", cookie("hq_user")).send({ status: "in_progress" }).expect(200);
    expect(repository.updateRequestById).toHaveBeenLastCalledWith(requestId, expect.objectContaining({ status: "in_progress", started_at: expect.any(String) }), userId, expect.any(Object));
    repository.findRequestById.mockResolvedValue({ ...base, status: "in_progress", started_at: "2026-08-11T00:00:00.000Z" });
    await request(app).patch(`/api/v1/requests/${requestId}`).set("Cookie", cookie("hq_user")).send({ status: "completed", hq_response: "Applied configuration." }).expect(200);
    expect(repository.updateRequestById).toHaveBeenLastCalledWith(requestId, expect.objectContaining({ completed_at: expect.any(String), hq_response: "Applied configuration.", responded_by: userId, responded_at: expect.any(String) }), userId, expect.any(Object));
    repository.findRequestById.mockResolvedValue({ ...base, status: "completed", started_at: "2026-08-11T00:00:00.000Z", completed_at: "2026-08-11T01:00:00.000Z", hq_response: "Applied configuration." });
    await request(app).patch(`/api/v1/requests/${requestId}`).set("Cookie", cookie("hq_user")).send({ status: "in_progress" }).expect(200);
    const updates = repository.updateRequestById.mock.calls.at(-1)[1];
    expect(updates.completed_at).toBeNull(); expect(updates).not.toHaveProperty("hq_response"); expect(updates).not.toHaveProperty("started_at");
  });

  it("allows HQ to complete directly from Open with a response and no artificial start time", async () => {
    await request(app).patch(`/api/v1/requests/${requestId}`).set("Cookie", cookie("hq_user")).send({ status: "completed", hq_response: "Resolved immediately." }).expect(200);
    const updates = repository.updateRequestById.mock.calls.at(-1)[1];
    expect(updates).toEqual(expect.objectContaining({ status: "completed", completed_at: expect.any(String), hq_response: "Resolved immediately.", responded_by: userId, responded_at: expect.any(String) }));
    expect(updates).not.toHaveProperty("started_at");
  });

  it("requires an existing or submitted HQ response when a responder completes", async () => {
    await request(app).patch(`/api/v1/requests/${requestId}`).set("Cookie", cookie("hq_user")).send({ status: "completed" }).expect(400);
    expect(repository.updateRequestById).not.toHaveBeenCalled();
    repository.findRequestById.mockResolvedValue({ ...base, hq_response: "Already answered" });
    await request(app).patch(`/api/v1/requests/${requestId}`).set("Cookie", cookie("hq_user")).send({ status: "completed" }).expect(200);
  });

  it("rejects unsupported transitions and invalid status, priority, and category", async () => {
    repository.findRequestById.mockResolvedValue({ ...base, status: "in_progress" });
    await request(app).patch(`/api/v1/requests/${requestId}`).set("Cookie", cookie("hq_user")).send({ status: "open" }).expect(400);
    await request(app).patch(`/api/v1/requests/${requestId}`).set("Cookie", cookie("hq_user")).send({ status: "closed" }).expect(400);
    await request(app).post("/api/v1/requests").set("Cookie", cookie("admin")).send({ ...createPayload, priority: "critical" }).expect(400);
    await request(app).post("/api/v1/requests").set("Cookie", cookie("admin")).send({ ...createPayload, category: "billing" }).expect(400);
  });

  it("limits HQ updates to status and response", async () => {
    await request(app).patch(`/api/v1/requests/${requestId}`).set("Cookie", cookie("hq_user")).send({ title: "Changed" }).expect(400);
    await request(app).patch(`/api/v1/requests/${requestId}`).set("Cookie", cookie("hq_user")).send({ hq_response: "Working on it" }).expect(200);
  });

  it("keeps Admin processing fields read-only", async () => {
    await request(app).patch(`/api/v1/requests/${requestId}`).set("Cookie", cookie("admin")).send({ status: "in_progress" }).expect(403);
    await request(app).patch(`/api/v1/requests/${requestId}`).set("Cookie", cookie("admin")).send({ hq_response: "Not allowed" }).expect(403);
  });
});

describe("Operations Requests migration", () => {
  const sql = fs.readFileSync(path.resolve("src/db/migrations/022_create_operations_requests.sql"), "utf8").toLowerCase();
  it("creates the schema, safe reference sequence, indexes, role, and attachment parent", () => {
    expect(sql).toContain("create sequence request_reference_seq"); expect(sql).not.toContain("max(");
    for (const field of ["request_reference", "hq_response", "responded_by", "responded_at", "started_at", "completed_at", "due_date"]) expect(sql).toContain(field);
    for (const index of ["status", "priority", "site_id", "charger_id", "assigned_to", "created_at", "due_date"]) expect(sql).toContain(`idx_requests_${index}`);
    expect(sql).toContain("'hq_user'"); expect(sql).toContain("'requests'"); expect(sql).toContain("requests_set_updated_at");
  });
  it("derives overdue and records every required activity action", () => {
    const repositorySource = fs.readFileSync(path.resolve("src/modules/requests/requests.repository.js"), "utf8");
    expect(repositorySource).toContain("due_date < CURRENT_DATE");
    expect(repositorySource).toContain("JOIN roles uploader_role ON uploader_role.id = uploader.role_id");
    expect(repositorySource).toContain("'uploaded_by_role', uploader_role.name");
    expect(repositorySource).not.toContain("uploader.role,");
    for (const action of ["request_created", "request_updated", "request_status_changed", "request_assigned", "request_response_updated", "request_deleted"]) expect(repositorySource).toContain(action);
    expect(repositorySource).toContain('filters = ["requests.deleted_at IS NULL"]');
    expect(repositorySource).toContain("SET deleted_at=now(), deleted_by=$2");
    expect(repositorySource).not.toContain("DELETE FROM requests");
    expect(fs.readFileSync(path.resolve("src/modules/attachments/attachments.repository.js"), "utf8")).toContain("request_attachment_uploaded");
  });
  it("reuses shared attachment formats while scoping HQ access to Requests", () => {
    const validation = fs.readFileSync(path.resolve("src/modules/attachments/attachments.validation.js"), "utf8");
    const routes = fs.readFileSync(path.resolve("src/modules/attachments/attachments.routes.js"), "utf8");
    const upload = fs.readFileSync(path.resolve("src/modules/attachments/attachment-upload.middleware.js"), "utf8");
    expect(validation).toContain('"requests"'); expect(routes).toContain('req.params.parentType === "requests"');
    expect(routes).toContain("ROLE_GROUPS.requestRead");
    expect(routes).toContain("ROLE_GROUPS.requestProcess");
    for (const extension of [".pdf", ".docx", ".xlsx", ".pptx", ".png", ".txt"]) expect(upload).toContain(`"${extension}"`);
  });
  it("adds only soft-delete metadata and keeps deleted Request attachments inaccessible", () => {
    const softDeleteSql = fs.readFileSync(path.resolve("src/db/migrations/023_soft_delete_operations_requests.sql"), "utf8").toLowerCase();
    expect(softDeleteSql).toContain("deleted_at timestamptz");
    expect(softDeleteSql).toContain("deleted_by uuid references users");
    const attachmentRepository = fs.readFileSync(path.resolve("src/modules/attachments/attachments.repository.js"), "utf8");
    const attachmentRoutes = fs.readFileSync(path.resolve("src/modules/attachments/attachments.routes.js"), "utf8");
    expect(attachmentRepository).toContain('parentType === "requests" ? " AND deleted_at IS NULL"');
    expect(attachmentRoutes).toContain("operationalAttachmentParentIsActive");
  });
});
