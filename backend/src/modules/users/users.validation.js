import { z } from "zod";

export const userRoleSchema = z.enum(["admin", "operations_staff", "viewer"]);

export const userIdParamsSchema = z.object({
  id: z.string().uuid(),
});

const passwordSchema = z
  .string()
  .min(12)
  .regex(/[a-z]/, "Password must contain a lowercase letter")
  .regex(/[A-Z]/, "Password must contain an uppercase letter")
  .regex(/[0-9]/, "Password must contain a number");

export const createUserSchema = z.object({
  full_name: z.string().trim().min(2),
  email: z.string().trim().toLowerCase().email(),
  password: passwordSchema,
  role: userRoleSchema.default("operations_staff"),
});

export const updateUserSchema = z
  .object({
    full_name: z.string().trim().min(2).optional(),
    role: userRoleSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one user field is required",
  });

export const updateUserStatusSchema = z.object({
  is_active: z.boolean().optional(),
  status: z.enum(["active", "inactive"]).optional(),
}).refine((value) => value.is_active !== undefined || value.status !== undefined, {
  message: "Account status is required",
});

export const resetPasswordSchema = z.object({
  password: passwordSchema,
});
