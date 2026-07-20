import { z } from "zod";

export const createUserSchema = z.object({
  full_name: z.string().trim().min(2),
  email: z.string().email(),
  password: z
    .string()
    .min(12)
    .regex(/[a-z]/, "Password must contain a lowercase letter")
    .regex(/[A-Z]/, "Password must contain an uppercase letter")
    .regex(/[0-9]/, "Password must contain a number")
    .regex(/[^A-Za-z0-9]/, "Password must contain a symbol"),
  role: z.enum(["admin", "operator", "viewer"]),
});
