import { z } from "zod";

const nullableText = (max) => z.string().trim().max(max).transform((value) => value || null).nullable().optional();
const fields = {
  site_id: z.string().uuid().nullable().optional(),
  contact_name: z.string().trim().min(1).max(200),
  organization: nullableText(300),
  job_title: nullableText(200),
  email: z.string().trim().email().max(320).transform((value) => value || null).nullable().optional(),
  phone: nullableText(100),
  contact_type: nullableText(100),
  notes: nullableText(5000),
  active: z.boolean().optional(),
};

export const contactIdParamsSchema = z.object({ id: z.string().uuid() });
export const listContactsQuerySchema = z.object({
  site_id: z.string().uuid().optional(), search: z.string().trim().min(1).max(200).optional(),
  limit: z.coerce.number().int().positive().max(500).default(100),
}).strict();
export const createContactSchema = z.object(fields).strict();
export const updateContactSchema = z.object(fields).partial().strict()
  .refine((value) => Object.keys(value).length > 0, "At least one update field is required");
