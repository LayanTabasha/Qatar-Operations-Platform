import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import { pool, query } from "../config/database.js";
import { logger } from "../config/logger.js";

dotenv.config();

export const adminEnvSchema = z.object({
  ADMIN_NAME: z.string().trim().min(2).default("Administrator"),
  ADMIN_EMAIL: z.string().email(),
  ADMIN_PASSWORD: z
    .string()
    .min(12)
    .regex(/[a-z]/, "Password must contain a lowercase letter")
    .regex(/[A-Z]/, "Password must contain an uppercase letter")
    .regex(/[0-9]/, "Password must contain a number"),
});

function parseAdminEnv(envSource) {
  const parsed = adminEnvSchema.safeParse(envSource);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");

    throw new Error(`Invalid admin environment configuration: ${details}`);
  }

  return parsed.data;
}

async function findAdminRoleId(dbQuery) {
  const roleResult = await dbQuery("SELECT id FROM roles WHERE name = $1 LIMIT 1", ["admin"]);
  const adminRole = roleResult.rows[0];

  if (!adminRole) {
    throw new Error("Admin role not found. Run migrations and seeds before creating an admin.");
  }

  return adminRole.id;
}

async function findExistingUserByEmail(dbQuery, email) {
  const result = await dbQuery(
    `
      SELECT users.id, users.email, roles.name AS role
      FROM users
      JOIN roles ON roles.id = users.role_id
      WHERE lower(users.email::text) = lower($1)
      LIMIT 1
    `,
    [email],
  );

  return result.rows[0] || null;
}

export async function seedAdmin({ envSource = process.env, dbQuery = query, hashPassword = bcrypt.hash } = {}) {
  const admin = parseAdminEnv(envSource);
  const existingUser = await findExistingUserByEmail(dbQuery, admin.ADMIN_EMAIL);

  if (existingUser) {
    if (existingUser.role !== "admin") {
      throw new Error("A user with this email already exists but is not an administrator.");
    }

    logger.info({ userId: existingUser.id, email: existingUser.email }, "Admin user already exists");
    return {
      status: "existing",
      user: {
        id: existingUser.id,
        email: existingUser.email,
        role: existingUser.role,
      },
    };
  }

  const adminRoleId = await findAdminRoleId(dbQuery);
  const passwordHash = await hashPassword(admin.ADMIN_PASSWORD, 12);
  const result = await dbQuery(
    `
      INSERT INTO users (full_name, email, password_hash, role_id)
      VALUES ($1, $2, $3, $4)
      RETURNING id, full_name, email
    `,
    [admin.ADMIN_NAME, admin.ADMIN_EMAIL, passwordHash, adminRoleId],
  );

  const createdUser = result.rows[0];
  logger.info({ userId: createdUser.id, email: createdUser.email }, "Admin user created");

  return {
    status: "created",
    user: {
      id: createdUser.id,
      full_name: createdUser.full_name,
      email: createdUser.email,
      role: "admin",
    },
  };
}

async function runCli() {
  try {
    await seedAdmin();
  } finally {
    await pool.end();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().catch((err) => {
    logger.error({ err }, "Create admin failed");
    process.exit(1);
  });
}
