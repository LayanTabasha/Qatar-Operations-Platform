import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ findSafeUserById: vi.fn() }));
const repository = vi.hoisted(() => ({ listContacts: vi.fn(), findContactById: vi.fn(), insertContact: vi.fn(), updateContactById: vi.fn(), deactivateContactById: vi.fn() }));
vi.mock("../src/modules/auth/auth.repository.js", () => ({ findUserWithPasswordByEmail: vi.fn(), findSafeUserById: auth.findSafeUserById, updateLastLoginAt: vi.fn() }));
vi.mock("../src/modules/contacts/contacts.repository.js", () => repository);

let app, jwt;
const userId = "11111111-1111-4111-8111-111111111111";
const contactId = "22222222-2222-4222-8222-222222222222";
const siteId = "33333333-3333-4333-8333-333333333333";
const base = { id: contactId, contact_name: "Site Engineer", site_id: siteId, site_name: "Msheireb", active: true };

beforeAll(async () => {
  Object.assign(process.env, { NODE_ENV: "test", PORT: "3000", DATABASE_URL: "postgresql://x:x@localhost/x", DATABASE_SSL: "false", FRONTEND_ORIGIN: "http://localhost:5500", LOG_LEVEL: "silent", TRUST_PROXY: "false", JWT_SECRET: "test-secret-value-that-is-long-enough-for-validation", JWT_EXPIRES_IN: "8h", AUTH_COOKIE_NAME: "qatar_ops_token", COOKIE_SECURE: "false", COOKIE_SAME_SITE: "lax" });
  ({ app } = await import("../src/app.js")); jwt = await import("jsonwebtoken");
});
beforeEach(() => {
  vi.clearAllMocks(); repository.listContacts.mockResolvedValue([base]); repository.findContactById.mockResolvedValue(base);
  repository.insertContact.mockImplementation(async (input) => ({ ...base, ...input }));
  repository.updateContactById.mockImplementation(async (_id, input) => ({ ...base, ...input })); repository.deactivateContactById.mockResolvedValue({ id: contactId });
});
function cookie(role = "admin") { auth.findSafeUserById.mockResolvedValue({ id: userId, full_name: role, email: `${role}@example.com`, role, is_active: true }); return [`qatar_ops_token=${jwt.default.sign({ sub: userId, role }, process.env.JWT_SECRET)}`]; }

describe("Contacts optional Site API", () => {
  it.each([["HQ Admin", null], ["External Operator", null], ["Site Technician", siteId]])("creates a %s contact with the selected nullable site", async (job_title, site_id) => {
    await request(app).post("/api/v1/contacts").set("Cookie", cookie()).send({ contact_name: "Contact", job_title, site_id }).expect(201);
    expect(repository.insertContact).toHaveBeenCalledWith(expect.objectContaining({ job_title, site_id }), userId);
  });

  it("supports Site to unassigned, unassigned to Site, and Site-to-Site edits without stale IDs", async () => {
    const otherSiteId = "44444444-4444-4444-8444-444444444444";
    for (const site_id of [null, siteId, otherSiteId]) {
      await request(app).patch(`/api/v1/contacts/${contactId}`).set("Cookie", cookie()).send({ site_id }).expect(200);
      expect(repository.updateContactById).toHaveBeenLastCalledWith(contactId, { site_id });
    }
  });

  it("keeps Role independent from Site assignment", async () => {
    await request(app).patch(`/api/v1/contacts/${contactId}`).set("Cookie", cookie()).send({ job_title: "HQ Admin", site_id: siteId }).expect(200);
    expect(repository.updateContactById).toHaveBeenCalledWith(contactId, { job_title: "HQ Admin", site_id: siteId });
  });

  it("accepts omitted Site, rejects invalid UUIDs, and rejects obsolete Scope input", async () => {
    await request(app).post("/api/v1/contacts").set("Cookie", cookie()).send({ contact_name: "No Site" }).expect(201);
    await request(app).post("/api/v1/contacts").set("Cookie", cookie()).send({ contact_name: "Bad", site_id: "not-a-uuid" }).expect(400);
    await request(app).post("/api/v1/contacts").set("Cookie", cookie()).send({ contact_name: "Bad", site_id: null, scope: "external" }).expect(400);
    expect(repository.insertContact).toHaveBeenCalledTimes(1);
  });

  it("preserves search and Site filters", async () => {
    await request(app).get(`/api/v1/contacts?search=engineer&site_id=${siteId}`).set("Cookie", cookie("viewer")).expect(200);
    expect(repository.listContacts).toHaveBeenCalledWith(expect.objectContaining({ search: "engineer", site_id: siteId }));
  });

  it.each(["admin", "hq_user", "operations_staff", "viewer"])("allows %s to list and view Contacts", async (role) => {
    await request(app).get("/api/v1/contacts").set("Cookie", cookie(role)).expect(200);
    await request(app).get(`/api/v1/contacts/${contactId}`).set("Cookie", cookie(role)).expect(200);
  });

  it("allows Admin to create, edit, and delete Contacts", async () => {
    await request(app).post("/api/v1/contacts").set("Cookie", cookie("admin")).send({ contact_name: "Admin Contact", site_id: null }).expect(201);
    await request(app).patch(`/api/v1/contacts/${contactId}`).set("Cookie", cookie("admin")).send({ contact_name: "Updated Contact" }).expect(200);
    await request(app).delete(`/api/v1/contacts/${contactId}`).set("Cookie", cookie("admin")).expect(200);
  });

  it.each(["hq_user", "operations_staff", "viewer"])("rejects direct Contact writes by %s", async (role) => {
    await request(app).post("/api/v1/contacts").set("Cookie", cookie(role)).send({ contact_name: "Denied", site_id: null }).expect(403);
    await request(app).patch(`/api/v1/contacts/${contactId}`).set("Cookie", cookie(role)).send({ contact_name: "Denied" }).expect(403);
    await request(app).delete(`/api/v1/contacts/${contactId}`).set("Cookie", cookie(role)).expect(403);
    expect(repository.insertContact).not.toHaveBeenCalled();
    expect(repository.updateContactById).not.toHaveBeenCalled();
    expect(repository.deactivateContactById).not.toHaveBeenCalled();
  });
});
