import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";

const authRepositoryMocks = vi.hoisted(() => ({
  findSafeUserById: vi.fn(),
}));

const chargersRepositoryMocks = vi.hoisted(() => ({
  listChargers: vi.fn(),
  listArchivedChargers: vi.fn(),
  findChargerById: vi.fn(),
  findAnyChargerById: vi.fn(),
  insertCharger: vi.fn(),
  archiveChargerById: vi.fn(),
  restoreChargerById: vi.fn(),
  permanentlyDeleteChargerById: vi.fn(),
  updateChargerById: vi.fn(),
  updateChargerStatusById: vi.fn(),
}));

const sitesRepositoryMocks = vi.hoisted(() => ({
  findSiteById: vi.fn(),
  findOperationalSiteById: vi.fn(),
  listArchivedSites: vi.fn(),
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
  operator: "Qatar Charge Operations",
  administrator: "Platform Administration",
  installation_date: "2026-07-15",
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
  chargersRepositoryMocks.findAnyChargerById.mockResolvedValue(chargerSummary);
  chargersRepositoryMocks.insertCharger.mockResolvedValue(chargerSummary);
  chargersRepositoryMocks.archiveChargerById.mockResolvedValue({ ...chargerSummary, status: "archived", previous_status: "active" });
  chargersRepositoryMocks.restoreChargerById.mockResolvedValue({ ...chargerSummary, status: "active" });
  chargersRepositoryMocks.permanentlyDeleteChargerById.mockResolvedValue({ state: "deleted", charger: { ...chargerSummary, status: "archived" } });
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
    operator: "Qatar Charge Operations",
    administrator: "Platform Administration",
    installation_date: "2026-07-15",
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

  it("requires an administrator to list archived chargers", async () => {
    chargersRepositoryMocks.listArchivedChargers.mockResolvedValue([{ ...chargerSummary, status: "archived" }]);
    await request(app).get("/api/v1/archive/chargers").set("Cookie", authCookie(operatorUser)).expect(403);
    const response = await request(app).get("/api/v1/archive/chargers").set("Cookie", authCookie(adminUser)).expect(200);
    expect(response.body.chargers[0].status).toBe("archived");
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

  it("allows admins to create a charger and normalizes the code", async () => {
    await request(app)
      .post("/api/v1/chargers")
      .set("Cookie", authCookie(adminUser))
      .send(validChargerBody())
      .expect(201);

    expect(chargersRepositoryMocks.insertCharger).toHaveBeenCalledWith(expect.objectContaining({
      code: "DC_01",
      operator: "Qatar Charge Operations",
      administrator: "Platform Administration",
      installation_date: "2026-07-15",
    }));
  });

  it("returns the persisted charger fields in list responses", async () => {
    const response = await request(app).get("/api/v1/chargers").set("Cookie", authCookie(viewerUser)).expect(200);

    expect(response.body.chargers[0]).toMatchObject({
      operator: "Qatar Charge Operations",
      administrator: "Platform Administration",
      installation_date: "2026-07-15",
    });
  });

  it("allows admins to update a charger", async () => {
    await request(app)
      .patch(`/api/v1/chargers/${chargerId}`)
      .set("Cookie", authCookie(adminUser))
      .send({ name: "Updated Charger" })
      .expect(200);
  });

  it("updates charger persistence fields without requiring unrelated fields", async () => {
    await request(app)
      .patch(`/api/v1/chargers/${chargerId}`)
      .set("Cookie", authCookie(adminUser))
      .send({ operator: "New Operator", administrator: "New Administrator", installation_date: "2026-08-01" })
      .expect(200);

    expect(chargersRepositoryMocks.updateChargerById).toHaveBeenCalledWith(chargerId, {
      operator: "New Operator",
      administrator: "New Administrator",
      installation_date: "2026-08-01",
    });
  });

  it("preserves charger persistence fields when a PATCH omits them", async () => {
    await request(app)
      .patch(`/api/v1/chargers/${chargerId}`)
      .set("Cookie", authCookie(adminUser))
      .send({ name: "Updated Charger" })
      .expect(200);

    expect(chargersRepositoryMocks.updateChargerById).toHaveBeenCalledWith(chargerId, { name: "Updated Charger" });
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

  it("repository selects and inserts the three persisted charger fields", () => {
    const repository = fs.readFileSync(path.resolve("src/modules/chargers/chargers.repository.js"), "utf8");

    ["chargers.operator", "chargers.administrator", "chargers.installation_date"].forEach((field) => {
      expect(repository).toContain(field);
    });
    expect(repository).toMatch(/INSERT INTO chargers \([\s\S]*operator,[\s\S]*administrator,[\s\S]*installation_date/);
    expect(repository).toContain("charger.operator ?? null");
    expect(repository).toContain("charger.administrator ?? null");
    expect(repository).toContain("charger.installation_date ?? null");
  });

  it("keeps archived chargers out of normal filters", async () => {
    await request(app).get("/api/v1/chargers?status=archived").set("Cookie", authCookie(viewerUser)).expect(400);
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
      .set("Cookie", authCookie(adminUser))
      .send(validChargerBody({ type: "ac" }))
      .expect(201);

    expect(chargersRepositoryMocks.insertCharger).toHaveBeenCalledWith(expect.objectContaining({ type: "AC" }));
  });

  it("returns 409 for duplicate charger codes", async () => {
    chargersRepositoryMocks.insertCharger.mockRejectedValue({ code: "23505" });

    const response = await request(app)
      .post("/api/v1/chargers")
      .set("Cookie", authCookie(adminUser))
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
      .set("Cookie", authCookie(adminUser))
      .send(validChargerBody())
      .expect(404);

    expect(response.body.error.code).toBe("SITE_NOT_FOUND");
  });

  it("prevents creation under an archived parent site", async () => {
    sitesRepositoryMocks.findSiteById.mockResolvedValue({ ...activeSite, status: "archived" });

    const response = await request(app)
      .post("/api/v1/chargers")
      .set("Cookie", authCookie(adminUser))
      .send(validChargerBody())
      .expect(409);

    expect(response.body.error.code).toBe("ARCHIVED_SITE_CONFLICT");
  });

  it("rejects empty PATCH bodies", async () => {
    await request(app).patch(`/api/v1/chargers/${chargerId}`).set("Cookie", authCookie(adminUser)).send({}).expect(400);
  });

  it("does not allow normal PATCH to change status", async () => {
    await request(app)
      .patch(`/api/v1/chargers/${chargerId}`)
      .set("Cookie", authCookie(adminUser))
      .send({ status: "archived" })
      .expect(400);
  });

  it("accepts only current statuses in the status endpoint", async () => {
    await request(app)
      .patch(`/api/v1/chargers/${chargerId}/status`)
      .set("Cookie", authCookie(adminUser))
      .send({ status: "faulted" })
      .expect(200);

    await request(app)
      .patch(`/api/v1/chargers/${chargerId}/status`)
      .set("Cookie", authCookie(adminUser))
      .send({ status: "inactive" })
      .expect(400);
  });

  it.each([operatorUser, { ...operatorUser, role: "hq_user" }, viewerUser])("rejects non-admin charger mutations for $role", async (user) => {
    await request(app).post("/api/v1/chargers").set("Cookie", authCookie(user)).send(validChargerBody()).expect(403);
    await request(app).patch(`/api/v1/chargers/${chargerId}`).set("Cookie", authCookie(user)).send({ name: "Blocked" }).expect(403);
    await request(app).delete(`/api/v1/chargers/${chargerId}/permanent`).set("Cookie", authCookie(user)).expect(403);
  });

  it("does not restore a charger when the parent site is archived", async () => {
    chargersRepositoryMocks.findAnyChargerById.mockResolvedValue({ ...chargerSummary, status: "archived", previous_status: "active" });
    sitesRepositoryMocks.findSiteById.mockResolvedValue({ ...activeSite, status: "archived" });

    const response = await request(app)
      .patch(`/api/v1/chargers/${chargerId}/restore`)
      .set("Cookie", authCookie(adminUser))
      .expect(409);

    expect(response.body.error.code).toBe("ARCHIVED_SITE_CONFLICT");
  });

  it("allows only admins to archive a charger with audit information", async () => {
    await request(app).patch(`/api/v1/chargers/${chargerId}/archive`).set("Cookie", authCookie(operatorUser)).expect(403);
    await request(app).patch(`/api/v1/chargers/${chargerId}/archive`).set("Cookie", authCookie(adminUser)).send({ reason: "Retired" }).expect(200);

    expect(chargersRepositoryMocks.archiveChargerById).toHaveBeenCalledWith(chargerId, adminUser.id, "active", "Retired", expect.any(Object));
  });

  it("restores an archived charger to active", async () => {
    chargersRepositoryMocks.findAnyChargerById.mockResolvedValue({ ...chargerSummary, status: "archived", previous_status: "active" });

    await request(app).patch(`/api/v1/chargers/${chargerId}/restore`).set("Cookie", authCookie(operatorUser)).expect(403);
    await request(app).patch(`/api/v1/chargers/${chargerId}/restore`).set("Cookie", authCookie(adminUser)).expect(200);

    expect(chargersRepositoryMocks.restoreChargerById).toHaveBeenCalledWith(chargerId, adminUser.id, expect.any(Object));
  });

  it("rejects permanent delete for operations staff and viewers", async () => {
    chargersRepositoryMocks.findChargerById.mockResolvedValue({ ...chargerSummary, status: "archived" });

    await request(app).delete(`/api/v1/chargers/${chargerId}/permanent`).set("Cookie", authCookie(operatorUser)).expect(403);
    await request(app).delete(`/api/v1/chargers/${chargerId}/permanent`).set("Cookie", authCookie(viewerUser)).expect(403);
  });

  it("permanently deletes an empty archived charger for admins only", async () => {
    await request(app).delete(`/api/v1/chargers/${chargerId}/permanent`).set("Cookie", authCookie(adminUser)).expect(204);

    expect(chargersRepositoryMocks.permanentlyDeleteChargerById).toHaveBeenCalledWith(chargerId, adminUser.id, expect.any(Object));
  });

  it("does not permanently delete active chargers", async () => {
    chargersRepositoryMocks.permanentlyDeleteChargerById.mockResolvedValue({ state: "not_archived" });
    const response = await request(app).delete(`/api/v1/chargers/${chargerId}/permanent`).set("Cookie", authCookie(adminUser)).expect(409);

    expect(response.body.error.code).toBe("CHARGER_NOT_ARCHIVED");
  });

  it("returns safe dependency counts when permanent delete is blocked", async () => {
    chargersRepositoryMocks.permanentlyDeleteChargerById.mockResolvedValue({ state: "dependencies", dependencies: { faults: 2, documents: 1 } });
    const response = await request(app).delete(`/api/v1/chargers/${chargerId}/permanent`).set("Cookie", authCookie(adminUser)).expect(409);
    expect(response.body.error.details.dependencies).toEqual({ faults: 2, documents: 1 });
  });
});
