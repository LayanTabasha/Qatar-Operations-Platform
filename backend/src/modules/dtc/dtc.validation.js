import { z } from "zod";

const optionalText = (maxLength) =>
  z
    .string()
    .trim()
    .max(maxLength)
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional();

export const dtcIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const listDtcQuerySchema = z.object({
  code: z.string().trim().max(100).optional(),
  query: z.string().trim().max(200).optional(),
  charger_model: z.string().trim().max(100).optional(),
  category: z.string().trim().max(100).optional(),
  severity: z.string().trim().max(100).optional(),
  status: z.enum(["active", "inactive", "all"]).default("active"),
  sort: z.enum(["dtc_code", "fault_title", "category", "charger_model", "updated_at"]).default("dtc_code"),
  order: z.enum(["asc", "desc"]).default("asc"),
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const createDtcSchema = z
  .object({
    dtc_code: z.string().trim().min(1).max(100),
    ftb_code: optionalText(100),
    fault_title: z.string().trim().min(2).max(500),
    description: optionalText(5000),
    possible_causes: optionalText(5000),
    recommended_actions: optionalText(5000),
    severity: optionalText(100),
    category: optionalText(100),
    charger_model: optionalText(100),
    component: optionalText(100),
    source_version: optionalText(100),
    source_sheet: optionalText(100),
    manufacturer_data: z.record(z.unknown()).default({}).optional(),
    is_active: z.boolean().default(true).optional(),
  })
  .strict();

export const updateDtcSchema = createDtcSchema.partial().superRefine((value, ctx) => {
  if (Object.keys(value).length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "At least one update field is required",
    });
  }
});

export const updateDtcStatusSchema = z
  .object({
    is_active: z.boolean(),
  })
  .strict();
