import { execFile } from "node:child_process";
import { mkdtemp, readFile, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { ApiError } from "../../utils/api-error.js";

const execFileAsync = promisify(execFile);

export async function detectLibreOffice({ exec = execFileAsync, configuredBinary = process.env.LIBREOFFICE_BIN?.trim() } = {}) {
  const commands = configuredBinary ? [configuredBinary] : ["libreoffice", "soffice"];
  for (const command of commands) {
    try {
      await exec(command, ["--version"], { timeout: 5000 });
      return command;
    } catch { /* try the next standard binary */ }
  }
  throw new ApiError(503, "OFFICE_PREVIEW_UNAVAILABLE", "Office preview requires LibreOffice on the server");
}

export async function convertOfficeToPdf({ command, sourcePath, storedFilename, attachmentId, previewRoot, exec = execFileAsync } = {}) {
  const conversionDir = await mkdtemp(path.join(previewRoot, ".office-preview-"));
  const finalPath = path.join(previewRoot, `${attachmentId}.pdf`);
  try {
    const profilePath = path.join(conversionDir, "profile");
    await exec(command, [`-env:UserInstallation=${pathToFileURL(profilePath).href}`, "--headless", "--safe-mode", "--nologo", "--nodefault", "--nolockcheck", "--norestore", "--convert-to", "pdf", "--outdir", conversionDir, sourcePath], { timeout: 120000 });
    const generatedPath = path.join(conversionDir, `${path.parse(storedFilename).name}.pdf`);
    let generatedInfo;
    try { generatedInfo = await stat(generatedPath); } catch { throw new ApiError(422, "OFFICE_CONVERSION_FAILED", "LibreOffice did not produce a preview PDF"); }
    const signature = await readFile(generatedPath).then((content) => content.subarray(0, 5).toString());
    if (!generatedInfo.isFile() || generatedInfo.size < 5 || signature !== "%PDF-") {
      throw new ApiError(422, "OFFICE_CONVERSION_FAILED", "LibreOffice produced an invalid preview PDF");
    }
    await rename(generatedPath, finalPath);
    return finalPath;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error?.killed || error?.code === "ETIMEDOUT") throw new ApiError(504, "OFFICE_CONVERSION_TIMEOUT", "Office preview conversion timed out");
    throw new ApiError(422, "OFFICE_CONVERSION_FAILED", "The Office file could not be converted for preview");
  } finally {
    await rm(conversionDir, { recursive: true, force: true });
  }
}
