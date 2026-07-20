import bcrypt from "bcryptjs";
import express from "express";
import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const authRepositoryMocks = vi.hoisted(() => ({
  findUserWithPasswordByEmail: vi.fn(),
  findSafeUserById: vi.fn(),
  updateLastLoginAt: vi.fn(),
}));

const usersRepositoryMocks = vi.hoisted(() => ({
  listUsers: vi.fn(),
  findRoleByName: vi.fn(),
  createUser: vi.fn(),
}));

vi.mock("../src/modules/auth/auth.repository.js", () => authRepositoryMocks);
vi.mock("../src/modules/users/users.repository.js", () => usersRepositoryMocks);

let app;
let jwt;
let authenticate;
let authorizeRoles;
let errorHandler;

const activeAdmin = {
  id: "11111111-1111-4111-8111-111111111111",
  full_name: "Admin User",
  email: "admin@example.com",
  role: "admin",
  is_active: true,
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
  ({ authenticate, authorizeRoles } = await import("../src/modules/auth/auth.middleware.js"));
  ({ errorHandler } = await import("../src/middleware/error-handler.js"));
});

beforeEach(() => {
  vi.clearAllMocks();
  usersRepositoryMocks.listUsers.mockResolvedValue([]);
});

function createToken(user = activeAdmin) {
  return jwt.default.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: "8h",
  });
}

describe("authentication routes", () => {
  it("sets an HTTP-only cookie after successful login", async () => {
    const password_hash = await bcrypt.hash("CorrectPassword1!", 12);
    authRepositoryMocks.findUserWithPasswordByEmail.mockResolvedValue({ ...activeAdmin, password_hash });

    const response = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "admin@example.com", password: "CorrectPassword1!" })
      .expect(200);

    expect(response.headers["set-cookie"][0]).toContain("qatar_ops_token=");
    expect(response.headers["set-cookie"][0]).toContain("HttpOnly");
    expect(response.body.user).toEqual(activeAdmin);
    expect(response.body.user.password_hash).toBeUndefined();
  });

  it("returns 401 for incorrect credentials", async () => {
    const password_hash = await bcrypt.hash("CorrectPassword1!", 12);
    authRepositoryMocks.findUserWithPasswordByEmail.mockResolvedValue({ ...activeAdmin, password_hash });

    const response = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "admin@example.com", password: "WrongPassword1!" })
      .expect(401);

    expect(response.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("returns 401 for inactive users", async () => {
    const password_hash = await bcrypt.hash("CorrectPassword1!", 12);
    authRepositoryMocks.findUserWithPasswordByEmail.mockResolvedValue({
      ...activeAdmin,
      is_active: false,
      password_hash,
    });

    await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "admin@example.com", password: "CorrectPassword1!" })
      .expect(401);
  });

  it("clears the authentication cookie on logout", async () => {
    const response = await request(app).post("/api/v1/auth/logout").expect(200);

    expect(response.headers["set-cookie"][0]).toContain("qatar_ops_token=");
    expect(response.headers["set-cookie"][0]).toContain("Expires=Thu, 01 Jan 1970");
  });

  it("rejects unauthenticated auth/me requests", async () => {
    await request(app).get("/api/v1/auth/me").expect(401);
  });

  it("accepts a valid authenticated user", async () => {
    authRepositoryMocks.findSafeUserById.mockResolvedValue(activeAdmin);

    const response = await request(app)
      .get("/api/v1/auth/me")
      .set("Cookie", [`qatar_ops_token=${createToken()}`])
      .expect(200);

    expect(response.body.user).toEqual(activeAdmin);
    expect(response.body.user.password_hash).toBeUndefined();
  });
});

describe("authorization middleware", () => {
  function testAppForRole(user, allowedRoles) {
    const localApp = express();
    localApp.use((req, _res, next) => {
      req.user = user;
      next();
    });
    localApp.get("/protected", authorizeRoles(...allowedRoles), (_req, res) => {
      res.json({ success: true });
    });
    localApp.use(errorHandler);
    return localApp;
  }

  it("rejects a viewer from an admin-only route", async () => {
    const localApp = testAppForRole({ ...activeAdmin, role: "viewer" }, ["admin"]);

    await request(localApp).get("/protected").expect(403);
  });

  it("allows an admin on an admin-only route", async () => {
    const localApp = testAppForRole(activeAdmin, ["admin"]);

    await request(localApp).get("/protected").expect(200);
  });

  it("authenticates a valid mocked user before protected handlers run", async () => {
    authRepositoryMocks.findSafeUserById.mockResolvedValue(activeAdmin);

    const localApp = express();
    localApp.use((req, _res, next) => {
      req.cookies = { qatar_ops_token: createToken() };
      next();
    });
    localApp.get("/protected", authenticate, (req, res) => {
      res.json({ success: true, user: req.user });
    });
    localApp.use(errorHandler);

    const response = await request(localApp).get("/protected").expect(200);

    expect(response.body.user).toEqual(activeAdmin);
  });
});

describe("user management routes", () => {
  it("rejects manager as a user role", async () => {
    authRepositoryMocks.findSafeUserById.mockResolvedValue(activeAdmin);

    const response = await request(app)
      .post("/api/v1/users")
      .set("Cookie", [`qatar_ops_token=${createToken()}`])
      .send({
        full_name: "Manager User",
        email: "manager@example.com",
        password: "StrongPassword1!",
        role: "manager",
      })
      .expect(400);

    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("never returns password_hash when listing users", async () => {
    authRepositoryMocks.findSafeUserById.mockResolvedValue(activeAdmin);
    usersRepositoryMocks.listUsers.mockResolvedValue([activeAdmin]);

    const response = await request(app)
      .get("/api/v1/users")
      .set("Cookie", [`qatar_ops_token=${createToken()}`])
      .expect(200);

    expect(response.body.users[0].password_hash).toBeUndefined();
  });

  it("returns 409 for duplicate user email addresses", async () => {
    authRepositoryMocks.findSafeUserById.mockResolvedValue(activeAdmin);
    usersRepositoryMocks.findRoleByName.mockResolvedValue({
      id: "22222222-2222-4222-8222-222222222222",
      name: "viewer",
    });
    usersRepositoryMocks.createUser.mockRejectedValue({ code: "23505" });

    const response = await request(app)
      .post("/api/v1/users")
      .set("Cookie", [`qatar_ops_token=${createToken()}`])
      .send({
        full_name: "Viewer User",
        email: "viewer@example.com",
        password: "StrongPassword1!",
        role: "viewer",
      })
      .expect(409);

    expect(response.body.error.code).toBe("EMAIL_ALREADY_EXISTS");
  });
});
