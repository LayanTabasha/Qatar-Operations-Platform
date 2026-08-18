import { z } from "zod";

const optionalText = (maxLength) =>
  z
    .string()
    .trim()
    .max(maxLength)
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional();

const chargerCode = z
  .string()
  .trim()
  .min(2)
  .max(50)
  .regex(/^[A-Za-z0-9_-]+$/, "Code may contain only letters, numbers, hyphens, and underscores")
  .transform((value) => value.toUpperCase());

const chargerType = z.preprocess(
  (value) => (typeof value === "string" ? value.trim().toUpperCase() : value),
  z.enum(["AC", "DC"]),
);

const optionalDate = z.preprocess(
  (value) => (value === "" ? null : value),
  z
    .string()
    .date()
    .nullable()
    .optional(),
);

export const chargerIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const archiveReasonSchema = z
  .object({
    reason: z.string().trim().min(1).max(500).optional(),
  })
  .strict();

export const listChargersQuerySchema = z.object({
  site_id: z.string().uuid().optional(),
  status: z.enum(["active", "maintenance", "faulted"]).optional(),
  type: chargerType.optional(),
  search: z.string().trim().max(200).optional(),
  sort: z.enum(["name", "code", "created_at", "updated_at", "power_kw"]).default("name"),
  order: z.enum(["asc", "desc"]).default("asc"),
  limit: z.coerce.number().int().positive().max(100).default(100),
});

export const createChargerSchema = z
  .object({
    site_id: z.string().uuid(),
    name: z.string().trim().min(2).max(100),
    code: chargerCode,
    manufacturer: optionalText(100),
    operator: optionalText(200),
    administrator: optionalText(200),
    installation_date: optionalDate,
    model: optionalText(100),
    serial_number: optionalText(100),
    type: chargerType,
    power_kw: z.coerce.number().min(0).max(10000).default(0),
    firmware_version: optionalText(100),
    description: optionalText(2000),
    image_path: optionalText(1000),
  })
  .strict();

export const updateChargerSchema = createChargerSchema
  .partial()
  .superRefine((value, ctx) => {
    if (Object.keys(value).length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one update field is required",
      });
    }
  });

export const updateChargerStatusSchema = z
  .object({
    status: z.enum(["active", "maintenance", "faulted"]),
  })
  .strict();
