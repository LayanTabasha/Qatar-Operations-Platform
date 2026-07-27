import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import { pool, query } from "../config/database.js";
import { logger } from "../config/logger.js";

dotenv.config();

const createUserCliSchema = z.object({
  name: z.string().trim().min(2),
  email: z.string().trim().toLowerCase().email(),
  password: z
    .string()
    .min(12)
    .regex(/[a-z]/, "Password must contain a lowercase letter")
    .regex(/[A-Z]/, "Password must contain an uppercase letter")
    .regex(/[0-9]/, "Password must contain a number"),
  role: z.enum(["admin", "operations_staff", "viewer"]).default("operations_staff"),
});

function argsToObject(args) {
  return args.reduce((result, arg) => {
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (match) result[match[1]] = match[2];
    return result;
  }, {});
}

function parseInput(envSource = process.env, args = process.argv.slice(2)) {
  const cli = argsToObject(args);
  const parsed = createUserCliSchema.safeParse({
    name: cli.name || envSource.USER_NAME,
    email: cli.email || envSource.USER_EMAIL,
    password: cli.password || envSource.USER_PASSWORD,
    role: cli.role || envSource.USER_ROLE || "operations_staff",
  });

  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
    throw new Error(`Invalid user input: ${details}`);
  }

  return parsed.data;
}

async function findRoleId(role) {
  const result = await query("SELECT id FROM roles WHERE name = $1 LIMIT 1", [role]);
  if (!result.rows[0]) throw new Error(`Role not found: ${role}. Run npm run migrate and npm run seed:roles first.`);
  return result.rows[0].id;
}

export async function createUserFromCliInput({ envSource = process.env, args = process.argv.slice(2), hashPassword = bcrypt.hash } = {}) {
  const input = parseInput(envSource, args);
  const existing = await query("SELECT id, email FROM users WHERE lower(email::text) = lower($1) LIMIT 1", [input.email]);

  if (existing.rows[0]) {
    logger.info({ userId: existing.rows[0].id, email: existing.rows[0].email }, "User already exists");
    return { status: "existing", user: { id: existing.rows[0].id, email: existing.rows[0].email } };
  }

  const roleId = await findRoleId(input.role);
  const passwordHash = await hashPassword(input.password, 12);
  const result = await query(
    `
      INSERT INTO users (full_name, email, password_hash, role_id)
      VALUES ($1, $2, $3, $4)
      RETURNING id, full_name, email
    `,
    [input.name, input.email, passwordHash, roleId],
  );

  const user = result.rows[0];
  logger.info({ userId: user.id, email: user.email, role: input.role }, "User created");
  return { status: "created", user: { ...user, role: input.role } };
}

async function runCli() {
  try {
    await createUserFromCliInput();
  } finally {
    await pool.end();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().catch((err) => {
    logger.error({ err }, "Create user failed");
    process.exit(1);
  });
}
