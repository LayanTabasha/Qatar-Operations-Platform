import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { z } from "zod";
import { pool, query } from "../config/database.js";
import { logger } from "../config/logger.js";

dotenv.config();

const adminEnvSchema = z.object({
  ADMIN_NAME: z.string().trim().min(2),
  ADMIN_EMAIL: z.string().email(),
  ADMIN_PASSWORD: z
    .string()
    .min(12)
    .regex(/[a-z]/, "Password must contain a lowercase letter")
    .regex(/[A-Z]/, "Password must contain an uppercase letter")
    .regex(/[0-9]/, "Password must contain a number")
    .regex(/[^A-Za-z0-9]/, "Password must contain a symbol"),
});

async function createAdmin() {
  const parsed = adminEnvSchema.safeParse(process.env);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");

    throw new Error(`Invalid admin environment configuration: ${details}`);
  }

  const roleResult = await query("SELECT id FROM roles WHERE name = $1 LIMIT 1", ["admin"]);
  const adminRole = roleResult.rows[0];

  if (!adminRole) {
    throw new Error("Admin role not found. Run migrations and seeds before creating an admin.");
  }

  const passwordHash = await bcrypt.hash(parsed.data.ADMIN_PASSWORD, 12);

  try {
    const result = await query(
      `
        INSERT INTO users (full_name, email, password_hash, role_id)
        VALUES ($1, $2, $3, $4)
        RETURNING id, full_name, email
      `,
      [parsed.data.ADMIN_NAME, parsed.data.ADMIN_EMAIL, passwordHash, adminRole.id],
    );

    logger.info({ userId: result.rows[0].id, email: result.rows[0].email }, "Admin user created");
  } catch (err) {
    if (err.code === "23505") {
      throw new Error("A user with this email already exists.");
    }

    throw err;
  }
}

createAdmin()
  .then(async () => {
    await pool.end();
  })
  .catch(async (err) => {
    logger.error({ err }, "Create admin failed");
    await pool.end();
    process.exit(1);
  });
