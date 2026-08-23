import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

const databaseMocks = vi.hoisted(() => ({
  query: vi.fn(),
  testDatabaseConnection: vi.fn(),
  closeDatabasePool: vi.fn(),
  pool: { end: vi.fn() },
}));
const authRepositoryMocks = vi.hoisted(() => ({
  findSafeUserById: vi.fn(),
  findUserWithPasswordByEmail: vi.fn(),
  updateLastLoginAt: vi.fn(),
}));

vi.mock("../src/config/database.js", () => databaseMocks);
vi.mock("../src/modules/auth/auth.repository.js", () => authRepositoryMocks);

let app;
let jwt;

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
  process.env.OPERATIONAL_UPLOAD_ROOT = "/tmp";
  process.env.OPERATIONAL_PREVIEW_ROOT = "/tmp";

  ({ app } = await import("../src/app.js"));
  jwt = await import("jsonwebtoken");
});

beforeEach(() => {
  vi.clearAllMocks();
  databaseMocks.query.mockImplementation(async (sql) => sql.includes("schema_migrations")
    ? { rows: [{ filename: "018_persist_content_records.sql", applied_at: new Date("2026-08-05T00:00:00Z") }] }
    : { rows: [{ "?column?": 1 }] });
});

function authCookie(role = "admin") {
  const user = { id: "11111111-1111-4111-8111-111111111111", email: `${role}@example.com`, role, is_active: true };
  authRepositoryMocks.findSafeUserById.mockResolvedValue(user);
  const token = jwt.default.sign({ sub: user.id, role }, process.env.JWT_SECRET, { expiresIn: "8h" });
  return `qatar_ops_token=${token}`;
}

describe("health routes", () => {
  it("returns the API health status", async () => {
    const response = await request(app).get("/api/v1/health").expect(200);

    expect(response.body).toEqual({
      success: true,
      status: "ok",
      service: "Qatar Operations API",
    });
  });

  it("returns the public API health status at /api/health", async () => {
    const response = await request(app).get("/api/health").expect(200);

    expect(response.body).toEqual({
      success: true,
      status: "ok",
      service: "Qatar Operations API",
    });
  });

  it("returns Helmet security headers on the health endpoint", async () => {
    const response = await request(app).get("/api/v1/health").expect(200);

    expect(response.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("returns a consistent 404 error for unknown routes", async () => {
    const response = await request(app).get("/api/v1/missing-route").expect(404);

    expect(response.body.success).toBe(false);
    expect(response.body.error).toMatchObject({
      code: "NOT_FOUND",
      message: "Route not found",
    });
    expect(response.body.error.requestId).toEqual(expect.any(String));
  });

  it("requires authentication for detailed platform health", async () => {
    await request(app).get("/api/v1/health/platform").expect(401);
  });

  it.each(["operations_staff", "viewer"])("returns 403 for %s platform health requests", async (role) => {
    await request(app).get("/api/v1/health/platform").set("Cookie", authCookie(role)).expect(403);
  });

  it("returns a safe structured response to administrators", async () => {
    const response = await request(app).get("/api/v1/health/platform").set("Cookie", authCookie()).expect(200);
    expect(response.body).toMatchObject({
      success: true,
      status: "healthy",
      components: { backend: { status: "healthy" }, database: { status: "healthy" }, storage: { status: "healthy" } },
      application: { version: "0.1.0", uptimeSeconds: expect.any(Number) },
      migrations: { latest: "018_persist_content_records.sql" },
    });
    expect(response.body.serverTimestamp).toEqual(expect.any(String));
    expect(response.body.lastHealthCheck).toEqual(expect.any(String));
    expect(JSON.stringify(response.body)).not.toMatch(/DATABASE_URL|JWT_SECRET|password|qatar_ops_token|\/tmp|username/i);
  });
});
