import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";

const authRepositoryMocks = vi.hoisted(() => ({
  findSafeUserById: vi.fn(),
}));

const chargersRepositoryMocks = vi.hoisted(() => ({
  listChargers: vi.fn(),
  findChargerById: vi.fn(),
  insertCharger: vi.fn(),
  archiveChargerById: vi.fn(),
  restoreChargerById: vi.fn(),
  softDeleteArchivedChargerById: vi.fn(),
  updateChargerById: vi.fn(),
  updateChargerStatusById: vi.fn(),
}));

const sitesRepositoryMocks = vi.hoisted(() => ({
  findSiteById: vi.fn(),
}));

vi.mock("../src/modules/auth/auth.repository.js", () => ({
  findUserWithPasswordByEmail: vi.fn(),
  findSafeUserById: authRepositoryMocks.findSafeUserById,
  updateLastLoginAt: vi.fn(),
}));

vi.mock("../src/modules/chargers/chargers.repository.js", () => chargersRepositoryMocks);
vi.mock("../src/modules/sites/sites.repository.js", () => sitesRepositoryMocks);

let app;
let jwt;

const chargerId = "44444444-4444-4444-8444-444444444444";
const siteId = "33333333-3333-4333-8333-333333333333";
const adminUser = {
  id: "11111111-1111-4111-8111-111111111111",
  full_name: "Admin User",
  email: "admin@example.com",
  role: "admin",
  is_active: true,
};
const operatorUser = { ...adminUser, role: "operations_staff" };
const viewerUser = { ...adminUser, role: "viewer" };
const chargerSummary = {
  id: chargerId,
  site_id: siteId,
  site_name: "Msheireb",
  name: "DC Charger 01",
  code: "DC_01",
  manufacturer: "Example Manufacturer",
  model: "Model X",
  serial_number: "SN-001",
  type: "DC",
  power_kw: "120.00",
  firmware_version: null,
  description: null,
  image_path: null,
  status: "active",
  previous_status: null,
  archived_at: null,
  archived_by_name: null,
  restored_at: null,
  restored_by_name: null,
  deleted_at: null,
  deleted_by_name: null,
  open_fault_count: 0,
  last_site_visit: null,
  created_at: "2026-07-20T09:00:00.000Z",
  updated_at: "2026-07-20T09:00:00.000Z",
};
const activeSite = {
  id: siteId,
  name: "Msheireb",
  code: "MSHEIREB",
  status: "active",
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
  chargersRepositoryMocks.listChargers.mockResolvedValue([chargerSummary]);
  chargersRepositoryMocks.findChargerById.mockResolvedValue(chargerSummary);
  chargersRepositoryMocks.insertCharger.mockResolvedValue(chargerSummary);
  chargersRepositoryMocks.archiveChargerById.mockResolvedValue({ ...chargerSummary, status: "archived", previous_status: "active" });
  chargersRepositoryMocks.restoreChargerById.mockResolvedValue({ ...chargerSummary, status: "active" });
  chargersRepositoryMocks.softDeleteArchivedChargerById.mockResolvedValue({ ...chargerSummary, status: "archived", deleted_at: "2026-07-27T09:00:00.000Z" });
  chargersRepositoryMocks.updateChargerById.mockResolvedValue(chargerSummary);
  chargersRepositoryMocks.updateChargerStatusById.mockResolvedValue(chargerSummary);
  sitesRepositoryMocks.findSiteById.mockResolvedValue(activeSite);
});

function authCookie(user) {
  const token = jwt.default.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: "8h",
  });

  authRepositoryMocks.findSafeUserById.mockResolvedValue(user);
  return [`qatar_ops_token=${token}`];
}

function validChargerBody(overrides = {}) {
  return {
    site_id: siteId,
    name: "DC Charger 01",
    code: "dc_01",
    manufacturer: "Example Manufacturer",
    model: "Model X",
    serial_number: "SN-001",
    type: "DC",
    power_kw: 120,
    firmware_version: "1.0.0",
    description: "Main charger",
    image_path: "chargers/dc-01.webp",
    ...overrides,
  };
}

describe("chargers routes", () => {
  it("returns 401 for unauthenticated charger requests", async () => {
    await request(app).get("/api/v1/chargers").expect(401);
  });

  it("allows viewers to list chargers", async () => {
    const response = await request(app).get("/api/v1/chargers").set("Cookie", authCookie(viewerUser)).expect(200);

    expect(response.body.chargers[0]).toMatchObject({
      open_fault_count: 0,
      last_site_visit: null,
    });
  });

  it("allows viewers to view one charger", async () => {
    const response = await request(app)
      .get(`/api/v1/chargers/${chargerId}`)
      .set("Cookie", authCookie(viewerUser))
      .expect(200);

    expect(response.body.charger.id).toBe(chargerId);
  });

  it("rejects viewers when creating a charger", async () => {
    await request(app)
      .post("/api/v1/chargers")
      .set("Cookie", authCookie(viewerUser))
      .send(validChargerBody())
      .expect(403);
  });

  it("rejects viewers when editing a charger", async () => {
    await request(app)
      .patch(`/api/v1/chargers/${chargerId}`)
      .set("Cookie", authCookie(viewerUser))
      .send({ name: "Updated Charger" })
      .expect(403);
  });

  it("rejects viewers when changing charger status", async () => {
    await request(app)
      .patch(`/api/v1/chargers/${chargerId}/status`)
      .set("Cookie", authCookie(viewerUser))
      .send({ status: "archived" })
      .expect(403);
  });

  it("allows operators to create a charger and normalizes the code", async () => {
    await request(app)
      .post("/api/v1/chargers")
      .set("Cookie", authCookie(operatorUser))
      .send(validChargerBody())
      .expect(201);

    expect(chargersRepositoryMocks.insertCharger).toHaveBeenCalledWith(expect.objectContaining({ code: "DC_01" }));
  });

  it("allows admins to update a charger", async () => {
    await request(app)
      .patch(`/api/v1/chargers/${chargerId}`)
      .set("Cookie", authCookie(adminUser))
      .send({ name: "Updated Charger" })
      .expect(200);
  });

  it("accepts supported query filters", async () => {
    await request(app)
      .get(`/api/v1/chargers?site_id=${siteId}&status=maintenance&type=AC&search=model&sort=updated_at&order=desc`)
      .set("Cookie", authCookie(viewerUser))
      .expect(200);

    expect(chargersRepositoryMocks.listChargers).toHaveBeenCalledWith(
      expect.objectContaining({
        site_id: siteId,
        status: "maintenance",
        type: "AC",
        search: "model",
        sort: "updated_at",
        order: "desc",
      }),
    );
  });

  it("lists active chargers by default", async () => {
    await request(app).get("/api/v1/chargers").set("Cookie", authCookie(viewerUser)).expect(200);

    expect(chargersRepositoryMocks.listChargers.mock.calls[0][0].status).toBeUndefined();
  });

  it("repository defaults to active non-deleted chargers when no status filter is provided", () => {
    const repository = fs.readFileSync(path.resolve("src/modules/chargers/chargers.repository.js"), "utf8");

    expect(repository).toContain("chargers.deleted_at IS NULL");
    expect(repository).toContain("chargers.status = 'active'");
  });

  it("accepts archived, maintenance, and faulted filters", async () => {
    await request(app).get("/api/v1/chargers?status=archived").set("Cookie", authCookie(viewerUser)).expect(200);
    await request(app).get("/api/v1/chargers?status=maintenance").set("Cookie", authCookie(viewerUser)).expect(200);
    await request(app).get("/api/v1/chargers?status=faulted").set("Cookie", authCookie(viewerUser)).expect(200);
  });

  it("accepts AC and DC filters", async () => {
    await request(app).get("/api/v1/chargers?type=AC").set("Cookie", authCookie(viewerUser)).expect(200);
    await request(app).get("/api/v1/chargers?type=DC").set("Cookie", authCookie(viewerUser)).expect(200);
  });

  it("rejects inactive as a charger status", async () => {
    await request(app).get("/api/v1/chargers?status=inactive").set("Cookie", authCookie(viewerUser)).expect(400);
  });

  it("rejects invalid charger types", async () => {
    await request(app).get("/api/v1/chargers?type=FAST").set("Cookie", authCookie(viewerUser)).expect(400);
  });

  it("returns validation error for invalid UUIDs", async () => {
    await request(app).get("/api/v1/chargers/not-a-uuid").set("Cookie", authCookie(viewerUser)).expect(400);
  });

  it("rejects invalid site_id filters", async () => {
    await request(app).get("/api/v1/chargers?site_id=bad-site-id").set("Cookie", authCookie(viewerUser)).expect(400);
  });

  it("normalizes lowercase charger types to uppercase", async () => {
    await request(app)
      .post("/api/v1/chargers")
      .set("Cookie", authCookie(operatorUser))
      .send(validChargerBody({ type: "ac" }))
      .expect(201);

    expect(chargersRepositoryMocks.insertCharger).toHaveBeenCalledWith(expect.objectContaining({ type: "AC" }));
  });

  it("returns 409 for duplicate charger codes", async () => {
    chargersRepositoryMocks.insertCharger.mockRejectedValue({ code: "23505" });

    const response = await request(app)
      .post("/api/v1/chargers")
      .set("Cookie", authCookie(operatorUser))
      .send(validChargerBody({ code: "duplicate" }))
      .expect(409);

    expect(response.body.error.code).toBe("CHARGER_CODE_ALREADY_EXISTS");
  });

  it("returns 404 when a charger is not found", async () => {
    chargersRepositoryMocks.findChargerById.mockResolvedValue(null);

    await request(app).get(`/api/v1/chargers/${chargerId}`).set("Cookie", authCookie(viewerUser)).expect(404);
  });

  it("returns 404 when the parent site is missing", async () => {
    sitesRepositoryMocks.findSiteById.mockResolvedValue(null);

    const response = await request(app)
      .post("/api/v1/chargers")
      .set("Cookie", authCookie(operatorUser))
      .send(validChargerBody())
      .expect(404);

    expect(response.body.error.code).toBe("SITE_NOT_FOUND");
  });

  it("prevents creation under an archived parent site", async () => {
    sitesRepositoryMocks.findSiteById.mockResolvedValue({ ...activeSite, status: "archived" });

    const response = await request(app)
      .post("/api/v1/chargers")
      .set("Cookie", authCookie(operatorUser))
      .send(validChargerBody())
      .expect(409);

    expect(response.body.error.code).toBe("ARCHIVED_SITE_CONFLICT");
  });

  it("rejects empty PATCH bodies", async () => {
    await request(app).patch(`/api/v1/chargers/${chargerId}`).set("Cookie", authCookie(operatorUser)).send({}).expect(400);
  });

  it("does not allow normal PATCH to change status", async () => {
    await request(app)
      .patch(`/api/v1/chargers/${chargerId}`)
      .set("Cookie", authCookie(operatorUser))
      .send({ status: "archived" })
      .expect(400);
  });

  it("accepts only current statuses in the status endpoint", async () => {
    await request(app)
      .patch(`/api/v1/chargers/${chargerId}/status`)
      .set("Cookie", authCookie(operatorUser))
      .send({ status: "faulted" })
      .expect(200);

    await request(app)
      .patch(`/api/v1/chargers/${chargerId}/status`)
      .set("Cookie", authCookie(operatorUser))
      .send({ status: "inactive" })
      .expect(400);
  });

  it("does not restore a charger when the parent site is archived", async () => {
    sitesRepositoryMocks.findSiteById.mockResolvedValue({ ...activeSite, status: "archived" });

    const response = await request(app)
      .patch(`/api/v1/chargers/${chargerId}/status`)
      .set("Cookie", authCookie(operatorUser))
      .send({ status: "active" })
      .expect(409);

    expect(response.body.error.code).toBe("ARCHIVED_SITE_CONFLICT");
  });

  it("archives a charger with audit information", async () => {
    await request(app).patch(`/api/v1/chargers/${chargerId}/archive`).set("Cookie", authCookie(operatorUser)).expect(200);

    expect(chargersRepositoryMocks.archiveChargerById).toHaveBeenCalledWith(chargerId, operatorUser.id, "active");
  });

  it("restores an archived charger to active", async () => {
    chargersRepositoryMocks.findChargerById.mockResolvedValue({ ...chargerSummary, status: "archived", previous_status: "active" });

    await request(app).patch(`/api/v1/chargers/${chargerId}/restore`).set("Cookie", authCookie(operatorUser)).expect(200);

    expect(chargersRepositoryMocks.restoreChargerById).toHaveBeenCalledWith(chargerId, operatorUser.id);
  });

  it("rejects permanent delete for operations staff and viewers", async () => {
    chargersRepositoryMocks.findChargerById.mockResolvedValue({ ...chargerSummary, status: "archived" });

    await request(app).delete(`/api/v1/chargers/${chargerId}`).set("Cookie", authCookie(operatorUser)).expect(403);
    await request(app).delete(`/api/v1/chargers/${chargerId}`).set("Cookie", authCookie(viewerUser)).expect(403);
  });

  it("soft-deletes archived chargers for admins only", async () => {
    chargersRepositoryMocks.findChargerById.mockResolvedValue({ ...chargerSummary, status: "archived" });

    await request(app).delete(`/api/v1/chargers/${chargerId}`).set("Cookie", authCookie(adminUser)).expect(200);

    expect(chargersRepositoryMocks.softDeleteArchivedChargerById).toHaveBeenCalledWith(chargerId, adminUser.id);
  });

  it("does not permanently delete active chargers", async () => {
    const response = await request(app).delete(`/api/v1/chargers/${chargerId}`).set("Cookie", authCookie(adminUser)).expect(409);

    expect(response.body.error.code).toBe("CHARGER_NOT_ARCHIVED");
  });
});
