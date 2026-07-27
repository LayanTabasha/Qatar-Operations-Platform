import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { ApiError } from "../../utils/api-error.js";

const siteImageUploadRoot = process.env.SITE_IMAGE_UPLOAD_ROOT || "/var/www/qatar-operations/uploads/site-images";
const publicSiteImagePath = "/uploads/site-images";
const allowedImageTypes = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
]);

function ensureUploadDirectory() {
  fs.mkdirSync(siteImageUploadRoot, { recursive: true });
}

const storage = multer.diskStorage({
  destination(_req, _file, callback) {
    try {
      ensureUploadDirectory();
      callback(null, siteImageUploadRoot);
    } catch (err) {
      callback(err);
    }
  },
  filename(_req, file, callback) {
    const extension = allowedImageTypes.get(file.mimetype);
    const filename = `${Date.now()}-${crypto.randomUUID()}${extension}`;
    callback(null, filename);
  },
});

const multerUpload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
  fileFilter(_req, file, callback) {
    if (!allowedImageTypes.has(file.mimetype)) {
      callback(new ApiError(400, "INVALID_IMAGE_TYPE", "Site image must be JPEG, PNG, or WebP"));
      return;
    }

    callback(null, true);
  },
}).single("image");

export function siteImageUpload(req, res, next) {
  multerUpload(req, res, (err) => {
    if (!err) {
      next();
      return;
    }

    if (err instanceof ApiError) {
      next(err);
      return;
    }

    if (err.code === "LIMIT_FILE_SIZE") {
      next(new ApiError(400, "IMAGE_TOO_LARGE", "Site image must be 5 MB or smaller"));
      return;
    }

    if (err.code === "LIMIT_UNEXPECTED_FILE") {
      next(new ApiError(400, "INVALID_IMAGE_FIELD", "Upload one image using the image field"));
      return;
    }

    next(err);
  });
}

export function publicPathForSiteImage(file) {
  return `${publicSiteImagePath}/${path.basename(file.filename)}`;
}

export { siteImageUploadRoot };
