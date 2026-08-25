import request from "supertest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const authRepositoryMocks = vi.hoisted(() => ({
  findSafeUserById: vi.fn(),
}));

const sitesRepositoryMocks = vi.hoisted(() => ({
  listSites: vi.fn(),
  listArchivedSites: vi.fn(),
  findSiteById: vi.fn(),
  findOperationalSiteById: vi.fn(),
  archiveSiteById: vi.fn(),
  restoreSiteById: vi.fn(),
  permanentlyDeleteSiteById: vi.fn(),
  insertSite: vi.fn(),
  updateSiteById: vi.fn(),
  updateSiteImagePathById: vi.fn(),
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
const siteImageUploadRoot = path.join(os.tmpdir(), "qatar-ops-site-image-test-uploads");

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
const tinyPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=", "base64");

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
  process.env.SITE_IMAGE_UPLOAD_ROOT = siteImageUploadRoot;

  ({ app } = await import("../src/app.js"));
  jwt = await import("jsonwebtoken");
});

beforeEach(() => {
  vi.clearAllMocks();
  sitesRepositoryMocks.listSites.mockResolvedValue([siteSummary]);
  sitesRepositoryMocks.findSiteById.mockResolvedValue(siteSummary);
  sitesRepositoryMocks.findOperationalSiteById.mockResolvedValue(siteSummary);
  sitesRepositoryMocks.insertSite.mockResolvedValue(siteSummary);
  sitesRepositoryMocks.updateSiteById.mockResolvedValue(siteSummary);
  sitesRepositoryMocks.updateSiteImagePathById.mockResolvedValue({ ...siteSummary, image_path: "/uploads/site-images/test.webp" });
  sitesRepositoryMocks.updateSiteStatusById.mockResolvedValue(siteSummary);
  sitesRepositoryMocks.archiveSiteById.mockResolvedValue({ ...siteSummary, status: "archived" });
  sitesRepositoryMocks.restoreSiteById.mockResolvedValue(siteSummary);
  sitesRepositoryMocks.permanentlyDeleteSiteById.mockResolvedValue({ state: "deleted", site: { ...siteSummary, status: "archived" } });
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

  it("rejects viewers when uploading a site image", async () => {
    await request(app)
      .post(`/api/v1/sites/${siteId}/image`)
      .set("Cookie", authCookie(viewerUser))
      .expect(403);
  });

  it("requires an image when uploading a site image", async () => {
    const response = await request(app)
      .post(`/api/v1/sites/${siteId}/image`)
      .set("Cookie", authCookie(adminUser))
      .expect(400);

    expect(response.body.error.code).toBe("IMAGE_REQUIRED");
  });

  it("rejects unsupported site image types", async () => {
    const response = await request(app)
      .post(`/api/v1/sites/${siteId}/image`)
      .set("Cookie", authCookie(adminUser))
      .attach("image", Buffer.from("<svg></svg>"), {
        filename: "site.svg",
        contentType: "image/svg+xml",
      })
      .expect(400);

    expect(response.body.error.code).toBe("INVALID_IMAGE_TYPE");
  });

  it("rejects oversized site images", async () => {
    const oversizedImage = Buffer.alloc(5 * 1024 * 1024 + 1, 1);

    const response = await request(app)
      .post(`/api/v1/sites/${siteId}/image`)
      .set("Cookie", authCookie(adminUser))
      .attach("image", oversizedImage, {
        filename: "large.png",
        contentType: "image/png",
      })
      .expect(413);

    expect(response.body.error.code).toBe("IMAGE_TOO_LARGE");
  });

  it("returns 404 before upload when the site is unknown", async () => {
    sitesRepositoryMocks.findOperationalSiteById.mockResolvedValueOnce(null);

    const response = await request(app)
      .post(`/api/v1/sites/${siteId}/image`)
      .set("Cookie", authCookie(adminUser))
      .attach("image", tinyPng, {
        filename: "site.png",
        contentType: "image/png",
      })
      .expect(404);

    expect(response.body.error.code).toBe("SITE_NOT_FOUND");
    expect(sitesRepositoryMocks.updateSiteImagePathById).not.toHaveBeenCalled();
  });

  it("allows admins to upload a site image", async () => {
    const response = await request(app)
      .post(`/api/v1/sites/${siteId}/image`)
      .set("Cookie", authCookie(adminUser))
      .attach("image", tinyPng, {
        filename: "admin-site.png",
        contentType: "image/png",
      })
      .expect(200);

    expect(response.body.image_path).toMatch(/^\/uploads\/site-images\/.+\.png$/);
    expect(sitesRepositoryMocks.updateSiteImagePathById).toHaveBeenCalledWith(siteId, response.body.image_path);

    const storedFile = path.join(siteImageUploadRoot, path.basename(response.body.image_path));
    expect(fs.existsSync(storedFile)).toBe(true);
    fs.unlinkSync(storedFile);
  });

  it("allows admins to store a site image and updates the public image path", async () => {
    const response = await request(app)
      .post(`/api/v1/sites/${siteId}/image`)
      .set("Cookie", authCookie(adminUser))
      .attach("image", tinyPng, {
        filename: "unsafe original name.png",
        contentType: "image/png",
      })
      .expect(200);

    expect(response.body.image_path).toMatch(/^\/uploads\/site-images\/.+\.png$/);
    expect(response.body.image_path).not.toContain("unsafe original name");
    expect(sitesRepositoryMocks.updateSiteImagePathById).toHaveBeenCalledWith(siteId, response.body.image_path);

    const storedFile = path.join(siteImageUploadRoot, path.basename(response.body.image_path));
    expect(fs.existsSync(storedFile)).toBe(true);
    fs.unlinkSync(storedFile);
  });

  it("allows admins to create a site", async () => {
    await request(app)
      .post("/api/v1/sites")
      .set("Cookie", authCookie(adminUser))
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

  it("uses all non-archived sites as the default list status", async () => {
    await request(app).get("/api/v1/sites").set("Cookie", authCookie(viewerUser)).expect(200);

    expect(sitesRepositoryMocks.listSites).toHaveBeenCalledWith(expect.objectContaining({ status: "all" }));
  });

  it("returns active, inactive, and maintenance sites for the all sentinel", async () => {
    const operationalSites = [
      { ...siteSummary, id: "33333333-3333-4333-8333-333333333331", status: "active" },
      { ...siteSummary, id: "33333333-3333-4333-8333-333333333332", status: "inactive" },
      { ...siteSummary, id: "33333333-3333-4333-8333-333333333333", status: "maintenance" },
    ];
    sitesRepositoryMocks.listSites.mockResolvedValueOnce(operationalSites);

    const response = await request(app).get("/api/v1/sites?status=all").set("Cookie", authCookie(viewerUser)).expect(200);

    expect(response.body.sites.map(({ status }) => status)).toEqual(["active", "inactive", "maintenance"]);
    expect(response.body.sites).not.toEqual(expect.arrayContaining([expect.objectContaining({ status: "archived" })]));
    expect(sitesRepositoryMocks.listSites).toHaveBeenCalledWith(expect.objectContaining({ status: "all" }));
  });

  it("keeps archived sites out of normal list filters", async () => {
    await request(app).get("/api/v1/sites?status=archived").set("Cookie", authCookie(viewerUser)).expect(400);
  });

  it.each(["active", "inactive", "maintenance", "all"])("accepts %s as a normal site list filter", async (status) => {
    await request(app).get(`/api/v1/sites?status=${status}`).set("Cookie", authCookie(viewerUser)).expect(200);
    expect(sitesRepositoryMocks.listSites).toHaveBeenCalledWith(expect.objectContaining({ status }));
  });

  it("rejects invalid normal site list filters", async () => {
    await request(app).get("/api/v1/sites?status=unknown").set("Cookie", authCookie(viewerUser)).expect(400);
    expect(sitesRepositoryMocks.listSites).not.toHaveBeenCalled();
  });

  it("returns validation error for invalid UUIDs", async () => {
    await request(app).get("/api/v1/sites/not-a-uuid").set("Cookie", authCookie(viewerUser)).expect(400);
  });

  it("normalizes lowercase site codes to uppercase", async () => {
    await request(app)
      .post("/api/v1/sites")
      .set("Cookie", authCookie(adminUser))
      .send({ name: "Code Site", code: "abc_123" })
      .expect(201);

    expect(sitesRepositoryMocks.insertSite).toHaveBeenCalledWith(expect.objectContaining({ code: "ABC_123" }));
  });

  it("returns 409 for duplicate site codes", async () => {
    sitesRepositoryMocks.insertSite.mockRejectedValue({ code: "23505" });

    const response = await request(app)
      .post("/api/v1/sites")
      .set("Cookie", authCookie(adminUser))
      .send({ name: "Duplicate Site", code: "DUPLICATE" })
      .expect(409);

    expect(response.body.error.code).toBe("SITE_CODE_ALREADY_EXISTS");
  });

  it("returns 404 when a site is not found", async () => {
    sitesRepositoryMocks.findOperationalSiteById.mockResolvedValue(null);

    await request(app).get(`/api/v1/sites/${siteId}`).set("Cookie", authCookie(viewerUser)).expect(404);
  });

  it("requires an administrator to list archived sites", async () => {
    sitesRepositoryMocks.listArchivedSites.mockResolvedValue([{ ...siteSummary, status: "archived" }]);
    await request(app).get("/api/v1/archive/sites").set("Cookie", authCookie(viewerUser)).expect(403);
    const response = await request(app).get("/api/v1/archive/sites").set("Cookie", authCookie(adminUser)).expect(200);
    expect(response.body.sites[0].status).toBe("archived");
  });

  it("rejects empty PATCH bodies", async () => {
    await request(app).patch(`/api/v1/sites/${siteId}`).set("Cookie", authCookie(adminUser)).send({}).expect(400);
  });

  it("does not permit archiving through the general status endpoint", async () => {
    await request(app)
      .patch(`/api/v1/sites/${siteId}/status`)
      .set("Cookie", authCookie(adminUser))
      .send({ status: "active" })
      .expect(200);

    await request(app)
      .patch(`/api/v1/sites/${siteId}/status`)
      .set("Cookie", authCookie(adminUser))
      .send({ status: "archived" })
      .expect(400);
  });

  it.each(["active", "inactive", "maintenance"])("allows admins to set normal site status to %s", async (status) => {
    sitesRepositoryMocks.updateSiteStatusById.mockResolvedValue({ ...siteSummary, status });
    const response = await request(app)
      .patch(`/api/v1/sites/${siteId}/status`)
      .set("Cookie", authCookie(adminUser))
      .send({ status })
      .expect(200);
    expect(sitesRepositoryMocks.updateSiteStatusById).toHaveBeenCalledWith(siteId, status);
    expect(response.body.site.status).toBe(status);
  });

  it.each(["all", "archived", "faulted", "under_maintenance", "unknown"])("rejects unsupported normal site status %s", async (status) => {
    await request(app)
      .patch(`/api/v1/sites/${siteId}/status`)
      .set("Cookie", authCookie(adminUser))
      .send({ status })
      .expect(400);
  });

  it.each([operatorUser, { ...operatorUser, role: "hq_user" }, viewerUser])("rejects non-admin site mutations for $role", async (user) => {
    await request(app).post("/api/v1/sites").set("Cookie", authCookie(user)).send({ name: "Blocked", code: "BLOCKED" }).expect(403);
    await request(app).patch(`/api/v1/sites/${siteId}`).set("Cookie", authCookie(user)).send({ name: "Blocked" }).expect(403);
    await request(app).delete(`/api/v1/sites/${siteId}/permanent`).set("Cookie", authCookie(user)).expect(403);
  });

  it("does not expose a DELETE route", async () => {
    await request(app).delete(`/api/v1/sites/${siteId}`).set("Cookie", authCookie(adminUser)).expect(404);
  });

  it("allows only admins to archive and restore sites", async () => {
    await request(app).patch(`/api/v1/sites/${siteId}/archive`).set("Cookie", authCookie(operatorUser)).expect(403);
    await request(app).patch(`/api/v1/sites/${siteId}/archive`).set("Cookie", authCookie(adminUser)).send({ reason: "Contract ended" }).expect(200);
    expect(sitesRepositoryMocks.archiveSiteById).toHaveBeenCalledWith(siteId, adminUser.id, "Contract ended", expect.any(Object));

    sitesRepositoryMocks.findSiteById.mockResolvedValue({ ...siteSummary, status: "archived" });
    await request(app).patch(`/api/v1/sites/${siteId}/restore`).set("Cookie", authCookie(adminUser)).expect(200);
    expect(sitesRepositoryMocks.restoreSiteById).toHaveBeenCalledWith(siteId, adminUser.id, expect.any(Object));
  });

  it("blocks site deletion with safe dependency counts", async () => {
    sitesRepositoryMocks.permanentlyDeleteSiteById.mockResolvedValue({ state: "dependencies", dependencies: { chargers: 1, faults: 2 } });
    const response = await request(app).delete(`/api/v1/sites/${siteId}/permanent`).set("Cookie", authCookie(adminUser)).expect(409);
    expect(response.body.error.details.dependencies).toEqual({ chargers: 1, faults: 2 });
  });

  it("permanently deletes only an empty archived site", async () => {
    await request(app).delete(`/api/v1/sites/${siteId}/permanent`).set("Cookie", authCookie(adminUser)).expect(204);
    expect(sitesRepositoryMocks.permanentlyDeleteSiteById).toHaveBeenCalledWith(siteId, adminUser.id, expect.any(Object));
  });
});
