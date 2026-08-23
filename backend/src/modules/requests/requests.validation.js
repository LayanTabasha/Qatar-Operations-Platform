import { z } from "zod";

const category = z.enum(["firmware", "software", "configuration", "network", "hardware", "documentation", "other"]);
const priority = z.enum(["low", "medium", "high"]);
const status = z.enum(["open", "in_progress", "completed"]);
const nullableUuid = z.string().uuid().nullable();
const optionalText = (max) => z.string().trim().max(max).transform((value) => value || null).nullable().optional();

export const requestIdParamsSchema = z.object({ id: z.string().uuid() });
export const listRequestsQuerySchema = z.object({
  status: status.optional(), priority: priority.optional(), category: category.optional(),
  site_id: z.string().uuid().optional(), charger_id: z.string().uuid().optional(),
  assigned_to: z.string().uuid().optional(), search: z.string().trim().min(1).max(200).optional(),
  overdue: z.enum(["true", "false"]).transform((value) => value === "true").optional(),
  limit: z.coerce.number().int().positive().max(500).default(100),
}).strict();

export const createRequestSchema = z.object({
  title: z.string().trim().min(2).max(500), description: z.string().trim().min(1).max(10000),
  category: category.nullable().optional(), priority, site_id: nullableUuid.optional(),
  charger_id: nullableUuid.optional(), assigned_to: nullableUuid.optional(), due_date: z.string().date().nullable().optional(),
}).strict();

export const adminUpdateRequestSchema = z.object({
  title: z.string().trim().min(2).max(500).optional(), description: z.string().trim().min(1).max(10000).optional(),
  category: category.nullable().optional(), priority: priority.optional(),
  site_id: nullableUuid.optional(), charger_id: nullableUuid.optional(), assigned_to: nullableUuid.optional(),
  due_date: z.string().date().nullable().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "At least one update field is required");

export const hqUpdateRequestSchema = z.object({ status: status.optional(), hq_response: optionalText(10000) })
  .strict().refine((value) => Object.keys(value).length > 0, "At least one update field is required");
