import { beforeAll, describe, expect, it, vi } from "vitest";

let runRoleSeed;

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

  ({ runRoleSeed } = await import("../src/db/seed-roles.js"));
});

describe("roles seed command", () => {
  it("applies the repeat-safe roles seed SQL", async () => {
    const dbQuery = vi.fn().mockResolvedValue({ rows: [] });

    const result = await runRoleSeed({ dbQuery });

    expect(result).toEqual({ status: "applied" });
    expect(dbQuery).toHaveBeenCalledTimes(1);
    expect(dbQuery.mock.calls[0][0].toLowerCase()).toContain("on conflict (name) do update");
    expect(dbQuery.mock.calls[0][0]).toContain("'admin'");
    expect(dbQuery.mock.calls[0][0]).toContain("'operations_staff'");
    expect(dbQuery.mock.calls[0][0]).toContain("'viewer'");
  });
});
