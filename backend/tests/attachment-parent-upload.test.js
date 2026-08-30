import { beforeEach, describe, expect, it, vi } from "vitest";

const repository = vi.hoisted(() => ({
  parentExists: vi.fn(),
  insertAttachment: vi.fn(),
  deleteAttachmentRecord: vi.fn(),
  findAttachment: vi.fn(),
  listAttachments: vi.fn(),
  replaceAttachmentFile: vi.fn(),
  setAttachmentPreview: vi.fn(),
}));
const files = vi.hoisted(() => ({
  access: vi.fn(),
  readFile: vi.fn(),
  stat: vi.fn(),
  unlink: vi.fn(),
}));

vi.mock("node:fs/promises", () => files);
vi.mock("../src/modules/attachments/attachments.repository.js", () => repository);
vi.mock("../src/modules/attachments/attachment-upload.middleware.js", () => ({
  operationalUploadRoot: "/managed/uploads",
  operationalPreviewRoot: "/managed/previews",
}));
vi.mock("../src/modules/attachments/office-preview.js", () => ({
  convertOfficeToPdf: vi.fn(),
  detectLibreOffice: vi.fn(),
}));

const { addAttachment } = await import("../src/modules/attachments/attachments.service.js");
const contentParentTypes = ["documents", "weekly-reports", "troubleshooting"];
const file = {
  path: "/managed/uploads/pending.txt",
  originalname: "evidence.txt",
  filename: "pending.txt",
  mimetype: "text/plain",
  size: 8,
};
const stored = {
  id: "attachment-1",
  original_filename: file.originalname,
  mime_type: file.mimetype,
  file_extension: ".txt",
  file_size_bytes: file.size,
  uploaded_by_name: "Operations User",
  created_at: "2026-08-30T00:00:00.000Z",
  updated_at: "2026-08-30T00:00:00.000Z",
  parent_record_id: "parent-1",
};

describe("content attachment parent validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    files.readFile.mockResolvedValue(Buffer.from("evidence"));
    files.unlink.mockResolvedValue(undefined);
    repository.insertAttachment.mockImplementation(async (parentType) => ({ ...stored, parent_type: parentType }));
  });

  it.each(contentParentTypes)("allows upload for an existing %s parent", async (parentType) => {
    repository.parentExists.mockResolvedValue(true);
    await expect(addAttachment(parentType, "parent-1", { ...file }, "user-1", {})).resolves.toMatchObject({ parent_type: parentType });
    expect(repository.insertAttachment).toHaveBeenCalledOnce();
  });

  it.each(contentParentTypes)("rejects upload for a missing %s parent without metadata or retained file", async (parentType) => {
    repository.parentExists.mockResolvedValue(false);
    await expect(addAttachment(parentType, "missing-parent", { ...file }, "user-1", {})).rejects.toMatchObject({
      statusCode: 404,
      code: "PARENT_NOT_FOUND",
      message: "Attachment parent record not found",
    });
    expect(repository.insertAttachment).not.toHaveBeenCalled();
    expect(files.readFile).not.toHaveBeenCalled();
    expect(files.unlink).toHaveBeenCalledWith(file.path);
  });
});
