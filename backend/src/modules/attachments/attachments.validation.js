import { z } from "zod";

export const attachmentIdParamsSchema = z.object({ id: z.string().uuid() });
export const attachmentParentParamsSchema = z.object({
  parentType: z.enum(["site-visits", "documents", "faults", "weekly-reports", "troubleshooting", "requests"]),
  parentId: z.string().trim().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/),
});
