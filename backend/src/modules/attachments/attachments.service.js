import { access, readFile, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { ApiError } from "../../utils/api-error.js";
import { operationalPreviewRoot, operationalUploadRoot } from "./attachment-upload.middleware.js";
import { deleteAttachmentRecord, findAttachment, insertAttachment, listAttachments, parentExists, replaceAttachmentFile, setAttachmentPreview } from "./attachments.repository.js";
import { convertOfficeToPdf, detectLibreOffice } from "./office-preview.js";

const officeExtensions = new Set([".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx"]);
const directPreviewExtensions = new Set([".pdf", ".jpg", ".jpeg", ".png", ".webp", ".gif", ".txt", ".csv"]);
const zipOfficeExtensions = new Set([".docx", ".xlsx", ".pptx"]);
const oleOfficeExtensions = new Set([".doc", ".xls", ".ppt"]);

function publicAttachment(record) {
  return {
    id: record.id,
    original_filename: record.original_filename,
    mime_type: record.mime_type,
    file_extension: record.file_extension,
    file_size_bytes: Number(record.file_size_bytes),
    uploaded_by_name: record.uploaded_by_name,
    created_at: record.created_at,
    updated_at: record.updated_at,
    parent_type: record.parent_type,
    parent_record_id: record.parent_record_id,
    preview_available: true,
    preview_url: `/api/v1/attachments/${record.id}/preview`,
    download_url: `/api/v1/attachments/${record.id}/download`,
  };
}

export function assertManagedPath(filePath, root) {
  const resolved = path.resolve(filePath || "");
  const relative = path.relative(root, resolved);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) throw new ApiError(500, "INVALID_STORAGE_PATH", "Stored file path is invalid");
  return resolved;
}

async function safeUnlink(filePath, root) {
  if (!filePath) return;
  try { await unlink(assertManagedPath(filePath, root)); } catch (error) { if (error.code !== "ENOENT") throw error; }
}

async function validateFileContent(file) {
  const extension = path.extname(file.originalname).toLowerCase();
  const buffer = await readFile(file.path);
  if (!buffer.length) throw new ApiError(400, "EMPTY_FILE", "Empty files cannot be uploaded");
  const starts = (...bytes) => bytes.every((byte, index) => buffer[index] === byte);
  const valid = extension === ".pdf" ? buffer.subarray(0, 5).toString() === "%PDF-"
    : [".jpg", ".jpeg"].includes(extension) ? starts(0xff, 0xd8, 0xff)
      : extension === ".png" ? starts(0x89, 0x50, 0x4e, 0x47)
        : extension === ".gif" ? ["GIF87a", "GIF89a"].includes(buffer.subarray(0, 6).toString())
          : extension === ".webp" ? buffer.subarray(0, 4).toString() === "RIFF" && buffer.subarray(8, 12).toString() === "WEBP"
            : zipOfficeExtensions.has(extension) ? starts(0x50, 0x4b)
              : oleOfficeExtensions.has(extension) ? starts(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1)
                : [".txt", ".csv"].includes(extension) ? !buffer.includes(0) : false;
  if (!valid) throw new ApiError(400, "FILE_CONTENT_MISMATCH", "File content does not match its extension");
}

export async function getAttachments(parentType, parentId) {
  if (!(await parentExists(parentType, parentId))) throw new ApiError(404, "PARENT_NOT_FOUND", "Attachment parent record not found");
  return (await listAttachments(parentType, parentId)).map(publicAttachment);
}

export async function addAttachment(parentType, parentId, file, userId, audit) {
  if (!file) throw new ApiError(400, "FILE_REQUIRED", "Choose a file before uploading");
  if (parentType === "faults" && !file.mimetype.startsWith("image/")) throw new ApiError(400, "FAULT_PHOTO_REQUIRED", "Fault evidence must be an image");
  if (!(await parentExists(parentType, parentId))) {
    await safeUnlink(file.path, operationalUploadRoot);
    throw new ApiError(404, "PARENT_NOT_FOUND", "Attachment parent record not found");
  }
  try {
    await validateFileContent(file);
    file.extension = path.extname(file.originalname).toLowerCase();
    return publicAttachment(await insertAttachment(parentType, parentId, file, userId, audit));
  } catch (error) {
    await safeUnlink(file.path, operationalUploadRoot);
    if (error.code === "23505") throw new ApiError(409, "SITE_VISIT_REPORT_EXISTS", "This visit already has a report; replace the existing report instead");
    throw error;
  }
}

export async function replaceAttachment(id, file, userId) {
  if (!file) throw new ApiError(400, "FILE_REQUIRED", "Choose a replacement file");
  const current = await findAttachment(id);
  if (!current) { await safeUnlink(file.path, operationalUploadRoot); throw new ApiError(404, "ATTACHMENT_NOT_FOUND", "Attachment not found"); }
  try { await validateFileContent(file); } catch (error) { await safeUnlink(file.path, operationalUploadRoot); throw error; }
  file.extension = path.extname(file.originalname).toLowerCase();
  let updated;
  try { updated = await replaceAttachmentFile(id, file, userId); } catch (error) { await safeUnlink(file.path, operationalUploadRoot); throw error; }
  await safeUnlink(current.storage_path, operationalUploadRoot);
  await safeUnlink(current.preview_path, operationalPreviewRoot);
  return publicAttachment(updated);
}

export async function removeAttachment(id) {
  const removed = await deleteAttachmentRecord(id);
  if (!removed) throw new ApiError(404, "ATTACHMENT_NOT_FOUND", "Attachment not found");
  await safeUnlink(removed.storage_path, operationalUploadRoot);
  await safeUnlink(removed.preview_path, operationalPreviewRoot);
}

// Used after a content-record transaction has committed. operational_attachments
// enforces unique storage paths, so a returned path is owned exclusively by the
// deleted row. Missing files are intentionally harmless.
export async function removeDeletedAttachmentFiles(attachments = []) {
  const errors = [];
  for (const attachment of attachments) {
    try { await safeUnlink(attachment.storage_path, operationalUploadRoot); } catch (error) { errors.push(error); }
    try { await safeUnlink(attachment.preview_path, operationalPreviewRoot); } catch (error) { errors.push(error); }
  }
  if (errors.length) throw new AggregateError(errors, "One or more deleted attachment files could not be removed");
}

export async function getAttachmentDownload(id) {
  const attachment = await findAttachment(id);
  if (!attachment) throw new ApiError(404, "ATTACHMENT_NOT_FOUND", "Attachment not found");
  const filePath = assertManagedPath(attachment.storage_path, operationalUploadRoot);
  try { await access(filePath); } catch { throw new ApiError(404, "FILE_MISSING", "The original file is missing from server storage"); }
  return { attachment, filePath };
}

export async function getAttachmentPreview(id) {
  const { attachment, filePath } = await getAttachmentDownload(id);
  if (!officeExtensions.has(attachment.file_extension)) {
    if (!directPreviewExtensions.has(attachment.file_extension)) {
      throw new ApiError(415, "PREVIEW_UNAVAILABLE", "Preview unavailable; download the original file instead");
    }
    return { attachment, filePath, mimeType: attachment.mime_type };
  }
  if (attachment.preview_path) {
    const cachedPath = assertManagedPath(attachment.preview_path, operationalPreviewRoot);
    try {
      const [sourceInfo, previewInfo] = await Promise.all([stat(filePath), stat(cachedPath)]);
      if (previewInfo.mtimeMs >= sourceInfo.mtimeMs) return { attachment, filePath: cachedPath, mimeType: "application/pdf" };
    } catch { /* regenerate */ }
  }
  const command = await detectLibreOffice();
  const finalPath = await convertOfficeToPdf({ command, sourcePath: filePath, storedFilename: attachment.stored_filename, attachmentId: attachment.id, previewRoot: operationalPreviewRoot });
  await setAttachmentPreview(id, finalPath);
  return { attachment, filePath: finalPath, mimeType: "application/pdf" };
}
