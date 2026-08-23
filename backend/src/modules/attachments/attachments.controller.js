import path from "node:path";
import { asyncHandler } from "../../utils/async-handler.js";
import { addAttachment, getAttachmentDownload, getAttachmentPreview, getAttachments, removeAttachment, replaceAttachment } from "./attachments.service.js";
import { attachmentIdParamsSchema, attachmentParentParamsSchema } from "./attachments.validation.js";

export const listAttachmentRecords = asyncHandler(async (req, res) => {
  const { parentType, parentId } = attachmentParentParamsSchema.parse(req.params);
  res.json({ success: true, attachments: await getAttachments(parentType, parentId) });
});
export const uploadAttachmentRecord = asyncHandler(async (req, res) => {
  const { parentType, parentId } = attachmentParentParamsSchema.parse(req.params);
  res.status(201).json({ success: true, attachment: await addAttachment(parentType, parentId, req.file, req.user.id, { ipAddress: req.ip, requestId: req.id }) });
});
export const replaceAttachmentRecord = asyncHandler(async (req, res) => {
  const { id } = attachmentIdParamsSchema.parse(req.params);
  res.json({ success: true, attachment: await replaceAttachment(id, req.file, req.user.id) });
});
export const deleteAttachmentRecord = asyncHandler(async (req, res) => {
  const { id } = attachmentIdParamsSchema.parse(req.params);
  await removeAttachment(id); res.status(204).end();
});
export const previewAttachmentRecord = asyncHandler(async (req, res) => {
  const { id } = attachmentIdParamsSchema.parse(req.params);
  const result = await getAttachmentPreview(id);
  const previewName = result.mimeType === "application/pdf" && result.attachment.mime_type !== "application/pdf" ? `${result.attachment.original_filename}.pdf` : result.attachment.original_filename;
  res.type(result.mimeType); res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(previewName)}`);
  res.sendFile(path.resolve(result.filePath));
});
export const downloadAttachmentRecord = asyncHandler(async (req, res) => {
  const { id } = attachmentIdParamsSchema.parse(req.params);
  const result = await getAttachmentDownload(id);
  res.download(path.resolve(result.filePath), result.attachment.original_filename);
});
