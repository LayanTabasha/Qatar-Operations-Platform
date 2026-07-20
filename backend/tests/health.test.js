import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";

let app;

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
});

describe("health routes", () => {
  it("returns the API health status", async () => {
    const response = await request(app).get("/api/v1/health").expect(200);

    expect(response.body).toEqual({
      success: true,
      status: "ok",
      service: "qatar-operations-api",
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
});
