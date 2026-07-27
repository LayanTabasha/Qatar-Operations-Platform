import { beforeAll, describe, expect, it, vi } from "vitest";

let seedAdmin;

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

  ({ seedAdmin } = await import("../src/db/create-admin.js"));
});

function adminEnv(overrides = {}) {
  return {
    ADMIN_NAME: "Zeeda Energy Admin",
    ADMIN_EMAIL: "admin@zeedaenergy.com",
    ADMIN_PASSWORD: "StrongPassword1",
    ...overrides,
  };
}

describe("admin seed command", () => {
  it("creates an administrator when one does not exist", async () => {
    const dbQuery = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: "role-admin-id" }] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "admin-user-id",
            full_name: "Zeeda Energy Admin",
            email: "admin@zeedaenergy.com",
          },
        ],
      });
    const hashPassword = vi.fn().mockResolvedValue("bcrypt-hash");

    const result = await seedAdmin({
      envSource: adminEnv(),
      dbQuery,
      hashPassword,
    });

    expect(result.status).toBe("created");
    expect(hashPassword).toHaveBeenCalledWith("StrongPassword1", 12);
    expect(dbQuery).toHaveBeenLastCalledWith(expect.stringContaining("INSERT INTO users"), [
      "Zeeda Energy Admin",
      "admin@zeedaenergy.com",
      "bcrypt-hash",
      "role-admin-id",
    ]);
    expect(result.user).not.toHaveProperty("password_hash");
  });

  it("reports an existing administrator without creating a duplicate", async () => {
    const dbQuery = vi.fn().mockResolvedValueOnce({
      rows: [
        {
          id: "admin-user-id",
          email: "admin@zeedaenergy.com",
          role: "admin",
        },
      ],
    });

    const result = await seedAdmin({
      envSource: adminEnv(),
      dbQuery,
      hashPassword: vi.fn(),
    });

    expect(result.status).toBe("existing");
    expect(dbQuery).toHaveBeenCalledTimes(1);
    expect(result.user).toEqual({
      id: "admin-user-id",
      email: "admin@zeedaenergy.com",
      role: "admin",
    });
  });

  it("rejects an existing non-admin account using the admin email", async () => {
    const dbQuery = vi.fn().mockResolvedValueOnce({
      rows: [
        {
          id: "operations-staff-user-id",
          email: "admin@zeedaenergy.com",
          role: "operations_staff",
        },
      ],
    });

    await expect(
      seedAdmin({
        envSource: adminEnv(),
        dbQuery,
        hashPassword: vi.fn(),
      }),
    ).rejects.toThrow("not an administrator");
  });

  it("allows administrator passwords without symbols", async () => {
    const dbQuery = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: "role-admin-id" }] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "admin-user-id",
            full_name: "Zeeda Energy Admin",
            email: "admin@zeedaenergy.com",
          },
        ],
      });
    const hashPassword = vi.fn().mockResolvedValue("bcrypt-hash");

    const result = await seedAdmin({
      envSource: adminEnv({ ADMIN_PASSWORD: "QatarOps2026" }),
      dbQuery,
      hashPassword,
    });

    expect(result.status).toBe("created");
    expect(hashPassword).toHaveBeenCalledWith("QatarOps2026", 12);
  });

  it("validates the remaining administrator password strength requirements", async () => {
    await expect(
      seedAdmin({
        envSource: adminEnv({ ADMIN_PASSWORD: "qatarops2026" }),
        dbQuery: vi.fn(),
        hashPassword: vi.fn(),
      }),
    ).rejects.toThrow("Password must contain an uppercase letter");
  });
});
