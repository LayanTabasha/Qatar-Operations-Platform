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
  findUserById: vi.fn(),
  countActiveAdmins: vi.fn(),
  findRoleByName: vi.fn(),
  createUser: vi.fn(),
  updateUserById: vi.fn(),
  updateUserStatusById: vi.fn(),
  updateUserPasswordById: vi.fn(),
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
const activeOperationsStaff = {
  ...activeAdmin,
  id: "22222222-2222-4222-8222-222222222222",
  email: "operations@example.com",
  role: "operations_staff",
};
const activeViewer = {
  ...activeAdmin,
  id: "33333333-3333-4333-8333-333333333333",
  email: "viewer@example.com",
  role: "viewer",
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
  usersRepositoryMocks.countActiveAdmins.mockResolvedValue(2);
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

  it("returns 401 for invalid email addresses without revealing whether the user exists", async () => {
    authRepositoryMocks.findUserWithPasswordByEmail.mockResolvedValue(null);

    const response = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "missing@example.com", password: "RandomPassword1" })
      .expect(401);

    expect(response.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("returns 401 for random credentials", async () => {
    authRepositoryMocks.findUserWithPasswordByEmail.mockResolvedValue(null);

    const response = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "random@example.com", password: "Anything12345" })
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
  it("allows admins to list users", async () => {
    authRepositoryMocks.findSafeUserById.mockResolvedValue(activeAdmin);
    usersRepositoryMocks.listUsers.mockResolvedValue([activeAdmin]);

    const response = await request(app)
      .get("/api/v1/users")
      .set("Cookie", [`qatar_ops_token=${createToken()}`])
      .expect(200);

    expect(response.body.users[0].email).toBe(activeAdmin.email);
  });

  it("rejects operations staff from listing users", async () => {
    authRepositoryMocks.findSafeUserById.mockResolvedValue(activeOperationsStaff);

    await request(app)
      .get("/api/v1/users")
      .set("Cookie", [`qatar_ops_token=${createToken(activeOperationsStaff)}`])
      .expect(403);
  });

  it("rejects viewers from listing users", async () => {
    authRepositoryMocks.findSafeUserById.mockResolvedValue(activeViewer);

    await request(app)
      .get("/api/v1/users")
      .set("Cookie", [`qatar_ops_token=${createToken(activeViewer)}`])
      .expect(403);
  });

  it("creates users as operations_staff by default", async () => {
    authRepositoryMocks.findSafeUserById.mockResolvedValue(activeAdmin);
    usersRepositoryMocks.findRoleByName.mockResolvedValue({
      id: "44444444-4444-4444-8444-444444444444",
      name: "operations_staff",
    });
    usersRepositoryMocks.createUser.mockResolvedValue({
      id: "55555555-5555-4555-8555-555555555555",
      full_name: "New User",
      email: "new@example.com",
      is_active: true,
      created_at: "2026-07-27T06:00:00.000Z",
      updated_at: "2026-07-27T06:00:00.000Z",
    });

    const response = await request(app)
      .post("/api/v1/users")
      .set("Cookie", [`qatar_ops_token=${createToken()}`])
      .send({
        full_name: "New User",
        email: "NEW@EXAMPLE.COM",
        password: "StrongPassword1",
      })
      .expect(201);

    expect(response.body.user.role).toBe("operations_staff");
    expect(usersRepositoryMocks.createUser).toHaveBeenCalledWith(expect.objectContaining({ email: "new@example.com" }));
  });

  it("allows admins to explicitly create another admin", async () => {
    authRepositoryMocks.findSafeUserById.mockResolvedValue(activeAdmin);
    usersRepositoryMocks.findRoleByName.mockResolvedValue({
      id: "44444444-4444-4444-8444-444444444444",
      name: "admin",
    });
    usersRepositoryMocks.createUser.mockResolvedValue({
      id: "66666666-6666-4666-8666-666666666666",
      full_name: "Supervisor",
      email: "supervisor@example.com",
      is_active: true,
    });

    const response = await request(app)
      .post("/api/v1/users")
      .set("Cookie", [`qatar_ops_token=${createToken()}`])
      .send({
        full_name: "Supervisor",
        email: "supervisor@example.com",
        password: "StrongPassword1",
        role: "admin",
      })
      .expect(201);

    expect(response.body.user.role).toBe("admin");
  });

  it("rejects manager as a user role", async () => {
    authRepositoryMocks.findSafeUserById.mockResolvedValue(activeAdmin);

    const response = await request(app)
      .post("/api/v1/users")
      .set("Cookie", [`qatar_ops_token=${createToken()}`])
      .send({
        full_name: "Manager User",
        email: "manager@example.com",
        password: "StrongPassword1",
        role: "manager",
      })
      .expect(400);

    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects invalid email addresses", async () => {
    authRepositoryMocks.findSafeUserById.mockResolvedValue(activeAdmin);

    await request(app)
      .post("/api/v1/users")
      .set("Cookie", [`qatar_ops_token=${createToken()}`])
      .send({ full_name: "Bad Email", email: "bad-email", password: "StrongPassword1" })
      .expect(400);
  });

  it("rejects weak passwords", async () => {
    authRepositoryMocks.findSafeUserById.mockResolvedValue(activeAdmin);

    await request(app)
      .post("/api/v1/users")
      .set("Cookie", [`qatar_ops_token=${createToken()}`])
      .send({ full_name: "Weak Password", email: "weak@example.com", password: "password" })
      .expect(400);
  });

  it("rejects operations staff from creating users", async () => {
    authRepositoryMocks.findSafeUserById.mockResolvedValue(activeOperationsStaff);

    await request(app)
      .post("/api/v1/users")
      .set("Cookie", [`qatar_ops_token=${createToken(activeOperationsStaff)}`])
      .send({ full_name: "Blocked", email: "blocked@example.com", password: "StrongPassword1" })
      .expect(403);
  });

  it("rejects viewers from creating users", async () => {
    authRepositoryMocks.findSafeUserById.mockResolvedValue(activeViewer);

    await request(app)
      .post("/api/v1/users")
      .set("Cookie", [`qatar_ops_token=${createToken(activeViewer)}`])
      .send({ full_name: "Blocked", email: "blocked@example.com", password: "StrongPassword1" })
      .expect(403);
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
        password: "StrongPassword1",
        role: "viewer",
      })
      .expect(409);

    expect(response.body.error.code).toBe("EMAIL_ALREADY_EXISTS");
  });

  it("allows admins to deactivate and reactivate another user", async () => {
    authRepositoryMocks.findSafeUserById.mockResolvedValue(activeAdmin);
    usersRepositoryMocks.findUserById.mockResolvedValue(activeViewer);
    usersRepositoryMocks.updateUserStatusById.mockResolvedValue({ ...activeViewer, is_active: false });

    await request(app)
      .patch(`/api/v1/users/${activeViewer.id}/status`)
      .set("Cookie", [`qatar_ops_token=${createToken()}`])
      .send({ is_active: false })
      .expect(200);

    expect(usersRepositoryMocks.updateUserStatusById).toHaveBeenCalledWith(activeViewer.id, false);

    usersRepositoryMocks.updateUserStatusById.mockResolvedValue({ ...activeViewer, is_active: true });

    await request(app)
      .patch(`/api/v1/users/${activeViewer.id}/status`)
      .set("Cookie", [`qatar_ops_token=${createToken()}`])
      .send({ status: "active" })
      .expect(200);
  });

  it("allows admins to reset another user's password", async () => {
    authRepositoryMocks.findSafeUserById.mockResolvedValue(activeAdmin);
    usersRepositoryMocks.findUserById.mockResolvedValue(activeViewer);
    usersRepositoryMocks.updateUserPasswordById.mockResolvedValue(activeViewer);

    const response = await request(app)
      .post(`/api/v1/users/${activeViewer.id}/reset-password`)
      .set("Cookie", [`qatar_ops_token=${createToken()}`])
      .send({ password: "NewStrongPassword1" })
      .expect(200);

    expect(response.body.user.password_hash).toBeUndefined();
    expect(usersRepositoryMocks.updateUserPasswordById).toHaveBeenCalledWith(activeViewer.id, expect.any(String));
  });

  it("prevents the current admin from deactivating themselves", async () => {
    authRepositoryMocks.findSafeUserById.mockResolvedValue(activeAdmin);
    usersRepositoryMocks.findUserById.mockResolvedValue(activeAdmin);

    const response = await request(app)
      .patch(`/api/v1/users/${activeAdmin.id}/status`)
      .set("Cookie", [`qatar_ops_token=${createToken()}`])
      .send({ is_active: false })
      .expect(400);

    expect(response.body.error.code).toBe("CANNOT_DEACTIVATE_SELF");
  });

  it("prevents the current admin from demoting themselves", async () => {
    authRepositoryMocks.findSafeUserById.mockResolvedValue(activeAdmin);
    usersRepositoryMocks.findUserById.mockResolvedValue(activeAdmin);

    const response = await request(app)
      .patch(`/api/v1/users/${activeAdmin.id}`)
      .set("Cookie", [`qatar_ops_token=${createToken()}`])
      .send({ role: "viewer" })
      .expect(400);

    expect(response.body.error.code).toBe("CANNOT_DEMOTE_SELF");
  });

  it("prevents the final active admin from being deactivated or demoted", async () => {
    authRepositoryMocks.findSafeUserById.mockResolvedValue(activeAdmin);
    usersRepositoryMocks.findUserById.mockResolvedValue({ ...activeAdmin, id: activeViewer.id });
    usersRepositoryMocks.countActiveAdmins.mockResolvedValue(1);

    await request(app)
      .patch(`/api/v1/users/${activeViewer.id}/status`)
      .set("Cookie", [`qatar_ops_token=${createToken()}`])
      .send({ is_active: false })
      .expect(400);

    await request(app)
      .patch(`/api/v1/users/${activeViewer.id}`)
      .set("Cookie", [`qatar_ops_token=${createToken()}`])
      .send({ role: "viewer" })
      .expect(400);
  });
});
