import { Router } from "express";
import { authenticate, authorizeRoles } from "../auth/auth.middleware.js";
import { operationalFileUpload } from "./attachment-upload.middleware.js";
import { deleteAttachmentRecord, downloadAttachmentRecord, listAttachmentRecords, previewAttachmentRecord, replaceAttachmentRecord, uploadAttachmentRecord } from "./attachments.controller.js";
import { findAttachment, operationalAttachmentParentIsActive, parentExists } from "./attachments.repository.js";
import { ApiError } from "../../utils/api-error.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { ROLE_GROUPS } from "../auth/permissions.js";

export const attachmentsRouter = Router();
attachmentsRouter.use(authenticate);
const authorizeParentRead = (req, res, next) => req.params.parentType === "requests"
  ? authorizeRoles(...ROLE_GROUPS.requestRead)(req, res, next) : authorizeRoles(...ROLE_GROUPS.authenticatedRead)(req, res, next);
const authorizeParentWrite = (req, res, next) => req.params.parentType === "requests"
  ? authorizeRoles("admin", ...ROLE_GROUPS.requestProcess)(req, res, next) : authorizeRoles(...ROLE_GROUPS.operationalManage)(req, res, next);
const requireAttachmentParent = asyncHandler(async (req, _res, next) => {
  if (!(await parentExists(req.params.parentType, req.params.parentId))) {
    throw new ApiError(404, "PARENT_NOT_FOUND", "Attachment parent record not found");
  }
  next();
});
const authorizeAttachment = (write) => asyncHandler(async (req, res, next) => {
  const attachment = await findAttachment(req.params.id);
  if (!attachment) throw new ApiError(404, "ATTACHMENT_NOT_FOUND", "Attachment not found");
  if (!(await operationalAttachmentParentIsActive(attachment))) throw new ApiError(404, "ATTACHMENT_NOT_FOUND", "Attachment not found");
  req.attachment = attachment;
  const allowed = attachment.parent_type === "requests" ? (write ? ["admin", ...ROLE_GROUPS.requestProcess] : ROLE_GROUPS.requestRead) : write ? ROLE_GROUPS.operationalManage : ROLE_GROUPS.authenticatedRead;
  return authorizeRoles(...allowed)(req, res, next);
});
attachmentsRouter.get("/parent/:parentType/:parentId", authorizeParentRead, listAttachmentRecords);
attachmentsRouter.post("/parent/:parentType/:parentId", authorizeParentWrite, requireAttachmentParent, operationalFileUpload, uploadAttachmentRecord);
attachmentsRouter.get("/:id/preview", authorizeAttachment(false), previewAttachmentRecord);
attachmentsRouter.get("/:id/download", authorizeAttachment(false), downloadAttachmentRecord);
attachmentsRouter.patch("/:id/file", authorizeAttachment(true), operationalFileUpload, replaceAttachmentRecord);
attachmentsRouter.delete("/:id", authorizeAttachment(true), deleteAttachmentRecord);
