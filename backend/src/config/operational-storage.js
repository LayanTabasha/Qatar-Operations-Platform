import { constants } from "node:fs";
import { access, mkdir } from "node:fs/promises";
import path from "node:path";

export const operationalStorage = Object.freeze({
  upload: path.resolve(process.env.OPERATIONAL_UPLOAD_ROOT || "/var/www/qatar-operations/uploads/operational-files"),
  preview: path.resolve(process.env.OPERATIONAL_PREVIEW_ROOT || "/var/www/qatar-operations/uploads/previews"),
});

export const requiredOperationalStorage = Object.freeze([
  { key: "upload", name: "Operational attachments", path: operationalStorage.upload },
  { key: "preview", name: "Attachment previews", path: operationalStorage.preview },
]);

export async function initializeOperationalStorage({ directories = requiredOperationalStorage, mkdirFn = mkdir, accessFn = access } = {}) {
  for (const directory of directories) {
    try {
      await mkdirFn(directory.path, { recursive: true });
      await accessFn(directory.path, constants.R_OK | constants.W_OK);
    } catch (error) {
      const safeError = new Error(`Operational ${directory.key} storage could not be initialized`);
      safeError.code = "STORAGE_INITIALIZATION_FAILED";
      safeError.cause = error;
      throw safeError;
    }
  }
}
