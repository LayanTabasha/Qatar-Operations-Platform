import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const authRepositoryMocks = vi.hoisted(() => ({
  findSafeUserById: vi.fn(),
}));

const sitesRepositoryMocks = vi.hoisted(() => ({
  listSites: vi.fn(),
  findSiteById: vi.fn(),
  insertSite: vi.fn(),
  updateSiteById: vi.fn(),
  updateSiteStatusById: vi.fn(),
}));

vi.mock("../src/modules/auth/auth.repository.js", () => ({
  findUserWithPasswordByEmail: vi.fn(),
  findSafeUserById: authRepositoryMocks.findSafeUserById,
  updateLastLoginAt: vi.fn(),
}));

vi.mock("../src/modules/sites/sites.repository.js", () => sitesRepositoryMocks);

let app;
let jwt;

const siteId = "33333333-3333-4333-8333-333333333333";
const adminUser = {
  id: "11111111-1111-4111-8111-111111111111",
  full_name: "Admin User",
  email: "admin@example.com",
  role: "admin",
  is_active: true,
};
const operatorUser = { ...adminUser, role: "operator" };
const viewerUser = { ...adminUser, role: "viewer" };
const siteSummary = {
  id: siteId,
  name: "Msheireb",
  code: "MSHEIREB",
  location: "Doha, Qatar",
  address: null,
  description: null,
  image_path: null,
  status: "active",
  charger_count: 0,
  open_fault_count: 0,
  last_site_visit: null,
  created_at: "2026-07-20T09:00:00.000Z",
  updated_at: "2026-07-20T09:00:00.000Z",
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
  sitesRepositoryMocks.listSites.mockResolvedValue([siteSummary]);
  sitesRepositoryMocks.findSiteById.mockResolvedValue(siteSummary);
  sitesRepositoryMocks.insertSite.mockResolvedValue(siteSummary);
  sitesRepositoryMocks.updateSiteById.mockResolvedValue(siteSummary);
  sitesRepositoryMocks.updateSiteStatusById.mockResolvedValue(siteSummary);
});

function authCookie(user) {
  const token = jwt.default.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: "8h",
  });

  authRepositoryMocks.findSafeUserById.mockResolvedValue(user);
  return [`qatar_ops_token=${token}`];
}

describe("sites routes", () => {
  it("returns 401 for unauthenticated site requests", async () => {
    await request(app).get("/api/v1/sites").expect(401);
  });

  it("allows viewers to list sites", async () => {
    const response = await request(app).get("/api/v1/sites").set("Cookie", authCookie(viewerUser)).expect(200);

    expect(response.body.sites[0]).toMatchObject({
      charger_count: 0,
      open_fault_count: 0,
      last_site_visit: null,
    });
  });

  it("allows viewers to view one site", async () => {
    const response = await request(app).get(`/api/v1/sites/${siteId}`).set("Cookie", authCookie(viewerUser)).expect(200);

    expect(response.body.site.id).toBe(siteId);
  });

  it("rejects viewers when creating a site", async () => {
    await request(app)
      .post("/api/v1/sites")
      .set("Cookie", authCookie(viewerUser))
      .send({ name: "New Site", code: "NEW_SITE" })
      .expect(403);
  });

  it("rejects viewers when editing a site", async () => {
    await request(app)
      .patch(`/api/v1/sites/${siteId}`)
      .set("Cookie", authCookie(viewerUser))
      .send({ name: "Updated Site" })
      .expect(403);
  });

  it("rejects viewers when archiving a site", async () => {
    await request(app)
      .patch(`/api/v1/sites/${siteId}/status`)
      .set("Cookie", authCookie(viewerUser))
      .send({ status: "archived" })
      .expect(403);
  });

  it("allows operators to create a site", async () => {
    await request(app)
      .post("/api/v1/sites")
      .set("Cookie", authCookie(operatorUser))
      .send({ name: "New Site", code: "new_site" })
      .expect(201);

    expect(sitesRepositoryMocks.insertSite).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "NEW_SITE",
      }),
    );
  });

  it("allows admins to update a site", async () => {
    await request(app)
      .patch(`/api/v1/sites/${siteId}`)
      .set("Cookie", authCookie(adminUser))
      .send({ name: "Updated Site" })
      .expect(200);
  });

  it("uses active as the default list status", async () => {
    await request(app).get("/api/v1/sites").set("Cookie", authCookie(viewerUser)).expect(200);

    expect(sitesRepositoryMocks.listSites).toHaveBeenCalledWith(expect.objectContaining({ status: "active" }));
  });

  it("accepts archived as a status filter", async () => {
    await request(app).get("/api/v1/sites?status=archived").set("Cookie", authCookie(viewerUser)).expect(200);

    expect(sitesRepositoryMocks.listSites).toHaveBeenCalledWith(expect.objectContaining({ status: "archived" }));
  });

  it("rejects inactive as a status filter", async () => {
    await request(app).get("/api/v1/sites?status=inactive").set("Cookie", authCookie(viewerUser)).expect(400);
  });

  it("returns validation error for invalid UUIDs", async () => {
    await request(app).get("/api/v1/sites/not-a-uuid").set("Cookie", authCookie(viewerUser)).expect(400);
  });

  it("normalizes lowercase site codes to uppercase", async () => {
    await request(app)
      .post("/api/v1/sites")
      .set("Cookie", authCookie(operatorUser))
      .send({ name: "Code Site", code: "abc_123" })
      .expect(201);

    expect(sitesRepositoryMocks.insertSite).toHaveBeenCalledWith(expect.objectContaining({ code: "ABC_123" }));
  });

  it("returns 409 for duplicate site codes", async () => {
    sitesRepositoryMocks.insertSite.mockRejectedValue({ code: "23505" });

    const response = await request(app)
      .post("/api/v1/sites")
      .set("Cookie", authCookie(operatorUser))
      .send({ name: "Duplicate Site", code: "DUPLICATE" })
      .expect(409);

    expect(response.body.error.code).toBe("SITE_CODE_ALREADY_EXISTS");
  });

  it("returns 404 when a site is not found", async () => {
    sitesRepositoryMocks.findSiteById.mockResolvedValue(null);

    await request(app).get(`/api/v1/sites/${siteId}`).set("Cookie", authCookie(viewerUser)).expect(404);
  });

  it("rejects empty PATCH bodies", async () => {
    await request(app).patch(`/api/v1/sites/${siteId}`).set("Cookie", authCookie(operatorUser)).send({}).expect(400);
  });

  it("accepts only active or archived in the status endpoint", async () => {
    await request(app)
      .patch(`/api/v1/sites/${siteId}/status`)
      .set("Cookie", authCookie(operatorUser))
      .send({ status: "active" })
      .expect(200);

    await request(app)
      .patch(`/api/v1/sites/${siteId}/status`)
      .set("Cookie", authCookie(operatorUser))
      .send({ status: "inactive" })
      .expect(400);
  });

  it("does not expose a DELETE route", async () => {
    await request(app).delete(`/api/v1/sites/${siteId}`).set("Cookie", authCookie(adminUser)).expect(404);
  });
});
