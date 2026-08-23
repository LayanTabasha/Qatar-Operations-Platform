import multer from "multer";
import { ApiError } from "../../utils/api-error.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1,
  },
  fileFilter(_req, file, callback) {
    const isXlsxMime =
      file.mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      file.mimetype === "application/octet-stream";
    const isXlsxName = /\.xlsx$/i.test(file.originalname || "");

    if (!isXlsxMime || !isXlsxName) {
      callback(new ApiError(400, "INVALID_DTC_IMPORT_FILE", "Upload a valid .xlsx DTC catalogue file"));
      return;
    }

    callback(null, true);
  },
}).single("file");

export function dtcWorkbookUpload(req, res, next) {
  upload(req, res, (err) => {
    if (!err) {
      next();
      return;
    }

    if (err instanceof ApiError) {
      next(err);
      return;
    }

    if (err.code === "LIMIT_FILE_SIZE") {
      next(new ApiError(413, "DTC_IMPORT_TOO_LARGE", "DTC import file must be 10 MB or smaller"));
      return;
    }

    if (err.code === "LIMIT_UNEXPECTED_FILE") {
      next(new ApiError(400, "INVALID_DTC_IMPORT_FIELD", "Upload one workbook using the file field"));
      return;
    }

    next(err);
  });
}
