import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z
    .string()
    .url()
    .refine((value) => value.startsWith("postgresql://") || value.startsWith("postgres://"), {
      message: "Must start with postgresql:// or postgres://",
    }),
  DATABASE_SSL: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  FRONTEND_ORIGIN: z.string().url(),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  TRUST_PROXY: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  JWT_SECRET: z.string().min(32, "Must be at least 32 characters long"),
  JWT_EXPIRES_IN: z.string().default("8h"),
  AUTH_COOKIE_NAME: z.string().min(1).default("qatar_ops_token"),
  COOKIE_SECURE: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  COOKIE_SAME_SITE: z.enum(["lax", "strict", "none"]).default("lax"),
});

const productionEnvSchema = envSchema.superRefine((value, ctx) => {
  if (value.NODE_ENV !== "production") return;

  if (!value.COOKIE_SECURE) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["COOKIE_SECURE"],
      message: "Must be true in production so auth cookies are sent only over HTTPS",
    });
  }

  if (!value.TRUST_PROXY) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["TRUST_PROXY"],
      message: "Must be true in production when Express runs behind Nginx",
    });
  }
});

const parsedEnv = productionEnvSchema.safeParse(process.env);

if (!parsedEnv.success) {
  const details = parsedEnv.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");

  throw new Error(`Invalid backend environment configuration: ${details}`);
}

export const env = parsedEnv.data;
