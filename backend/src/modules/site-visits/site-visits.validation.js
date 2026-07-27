import { z } from "zod";

const optionalText = (maxLength) =>
  z
    .string()
    .trim()
    .max(maxLength)
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional();

const timeField = z
  .string()
  .regex(/^\d{2}:\d{2}$/, "Time must use HH:mm format")
  .nullable()
  .optional();
const requiredTimeField = z.string().regex(/^\d{2}:\d{2}$/, "Time must use HH:mm format");
const siteVisitStatus = z.enum(["scheduled", "ongoing", "completed", "cancelled", "follow_up_required"]);

export const siteVisitIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const listSiteVisitsQuerySchema = z.object({
  site_id: z.string().uuid().optional(),
  charger_id: z.string().uuid().optional(),
  limit: z.coerce.number().int().positive().max(100).default(100),
});

const siteVisitFieldsSchema = z.object({
  site_id: z.string().uuid(),
  charger_id: z.string().uuid().nullable().optional(),
  visit_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Visit date must use YYYY-MM-DD format"),
  time_in: requiredTimeField,
  time_out: timeField,
  visited_by: z.string().trim().min(2).max(200),
  purpose: z.string().trim().min(1).max(1000),
  status: siteVisitStatus.default("completed"),
  observations: optionalText(2000),
  actions_taken: optionalText(2000),
  follow_up_required: z.boolean().default(false),
  report_file_path: optionalText(1000),
});

export const createSiteVisitSchema = siteVisitFieldsSchema
  .strict()
  .refine((value) => !value.time_in || !value.time_out || value.time_out >= value.time_in, {
    message: "Time Out cannot be earlier than Time In",
    path: ["time_out"],
  })
  .refine((value) => value.status === "ongoing" || value.time_out, {
    message: "Time Out is required unless the visit is ongoing",
    path: ["time_out"],
  });

export const updateSiteVisitSchema = siteVisitFieldsSchema.partial().strict().superRefine((value, ctx) => {
  if (Object.keys(value).length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "At least one update field is required",
    });
  }

  if (value.time_in && value.time_out && value.time_out < value.time_in) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["time_out"],
      message: "Time Out cannot be earlier than Time In",
    });
  }

  if (value.status && value.status !== "ongoing" && value.time_out === null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["time_out"],
      message: "Time Out is required unless the visit is ongoing",
    });
  }
});
