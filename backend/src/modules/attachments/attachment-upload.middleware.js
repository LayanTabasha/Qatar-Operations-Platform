import { randomUUID } from "node:crypto";
import path from "node:path";
import multer from "multer";
import { operationalStorage } from "../../config/operational-storage.js";
import { ApiError } from "../../utils/api-error.js";

export const operationalUploadRoot = operationalStorage.upload;
export const operationalPreviewRoot = operationalStorage.preview;

const mimeTypesByExtension = new Map([
  [".pdf", new Set(["application/pdf"])], [".doc", new Set(["application/msword"])],
  [".docx", new Set(["application/vnd.openxmlformats-officedocument.wordprocessingml.document"])],
  [".xls", new Set(["application/vnd.ms-excel"])],
  [".xlsx", new Set(["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"])],
  [".ppt", new Set(["application/vnd.ms-powerpoint"])],
  [".pptx", new Set(["application/vnd.openxmlformats-officedocument.presentationml.presentation"])],
  [".jpg", new Set(["image/jpeg"])], [".jpeg", new Set(["image/jpeg"])], [".png", new Set(["image/png"])],
  [".webp", new Set(["image/webp"])], [".gif", new Set(["image/gif"])], [".txt", new Set(["text/plain"])],
  [".csv", new Set(["text/csv", "application/csv", "text/plain"])],
]);

const storage = multer.diskStorage({
  destination: async (_req, _file, callback) => {
    callback(null, operationalUploadRoot);
  },
  filename: (_req, file, callback) => callback(null, `${randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
});

const upload = multer({
  storage,
  limits: { files: 1, fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const hasControlCharacter = Array.from(file.originalname).some((character) => {
      const codePoint = character.codePointAt(0);
      return codePoint <= 31 || codePoint === 127;
    });
    if (path.basename(file.originalname) !== file.originalname || hasControlCharacter || file.originalname.length > 255) {
      callback(new ApiError(400, "UNSAFE_FILENAME", "The original filename is not safe"));
      return;
    }
    if (!mimeTypesByExtension.get(extension)?.has(file.mimetype)) {
      callback(new ApiError(400, "UNSUPPORTED_FILE_TYPE", "Supported files are PDF, Office documents, images, TXT, and CSV"));
      return;
    }
    callback(null, true);
  },
});

export function operationalFileUpload(req, res, next) {
  upload.single("file")(req, res, (error) => {
    if (!error) return next();
    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      return next(new ApiError(400, "FILE_TOO_LARGE", "Files must be 25 MB or smaller"));
    }
    next(error);
  });
}
