import { z } from "zod";

const optionalText = (maxLength) =>
  z
    .string()
    .trim()
    .max(maxLength)
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional();

const siteCode = z
  .string()
  .trim()
  .min(2)
  .max(50)
  .regex(/^[A-Za-z0-9_-]+$/, "Code may contain only letters, numbers, hyphens, and underscores")
  .transform((value) => value.toUpperCase());

export const siteIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const listSitesQuerySchema = z.object({
  status: z.enum(["active", "archived"]).default("active"),
  search: z.string().trim().max(200).optional(),
  sort: z.enum(["name", "created_at", "updated_at"]).default("name"),
  order: z.enum(["asc", "desc"]).default("asc"),
  limit: z.coerce.number().int().positive().max(100).default(100),
});

export const createSiteSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    code: siteCode,
    location: optionalText(200),
    address: optionalText(500),
    description: optionalText(2000),
    image_path: optionalText(1000),
  })
  .strict();

export const updateSiteSchema = createSiteSchema.partial().superRefine((value, ctx) => {
  if (Object.keys(value).length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "At least one update field is required",
    });
  }
});

export const updateSiteStatusSchema = z
  .object({
    status: z.enum(["active", "archived"]),
  })
  .strict();
