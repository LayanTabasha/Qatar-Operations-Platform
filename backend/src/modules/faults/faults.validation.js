import { z } from "zod";

const optionalText = (max) => z.string().trim().max(max).transform((value) => value || null).nullable().optional();
const status = z.enum(["open", "in_progress", "resolved"]);
const severity = z.enum(["low", "medium", "high", "critical", "not_classified"]);
const priority = z.enum(["low", "medium", "high", "critical"]);

export const faultIdParamsSchema = z.object({ id: z.string().uuid() });

export const listFaultsQuerySchema = z.object({
  site_id: z.string().uuid().optional(),
  charger_id: z.string().uuid().optional(),
  status: status.optional(),
  severity: severity.optional(),
  date_from: z.string().date().optional(),
  date_to: z.string().date().optional(),
  limit: z.coerce.number().int().positive().max(500).default(100),
});

const fields = z.object({
  site_id: z.string().uuid(), charger_id: z.string().uuid(), fault_catalogue_id: z.string().uuid().nullable().optional(),
  fault_code: optionalText(200), ftb_code: optionalText(200), component: optionalText(500),
  fault_type: z.string().trim().min(1).max(200), title: z.string().trim().min(2).max(500), description: optionalText(5000),
  catalogue_snapshot: z.record(z.unknown()).optional(), technician_observation: optionalText(5000),
  category: optionalText(200), technical_category: optionalText(200), possible_causes: optionalText(5000), recommended_actions: optionalText(5000),
  severity: severity.default("medium"), priority: priority.default("medium"), status: status.default("open"),
  charger_status: optionalText(100), reported_by_name: optionalText(300), comments: optionalText(5000),
  reported_at: z.string().datetime({ offset: true }), resolved_at: z.string().datetime({ offset: true }).nullable().optional(),
  confirmed_cause: optionalText(5000), resolution_action_taken: optionalText(5000), resolution_notes: optionalText(5000),
  requires_site_visit: z.boolean().default(false), assigned_to: z.string().uuid().nullable().optional(),
});

export const createFaultSchema = fields.strict().superRefine((value, ctx) => {
  if (value.resolved_at && value.resolved_at < value.reported_at) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["resolved_at"], message: "Resolved time cannot precede reported time" });
  if (value.status === "resolved" && !value.confirmed_cause) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["confirmed_cause"], message: "Confirmed Cause is required when resolving a fault" });
  if (value.status === "resolved" && !value.resolution_action_taken) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["resolution_action_taken"], message: "Resolution / Action Taken is required when resolving a fault" });
});

export const updateFaultSchema = fields.partial().strict().superRefine((value, ctx) => {
  if (!Object.keys(value).length) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "At least one update field is required" });
});
