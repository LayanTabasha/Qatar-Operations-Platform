import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { convertOfficeToPdf, detectLibreOffice } from "../src/modules/attachments/office-preview.js";

const roots = [];
async function fixture(extension) {
  const root = await mkdtemp(path.join(os.tmpdir(), "qatar-ops-preview-"));
  roots.push(root);
  const previewRoot = path.join(root, "previews");
  const sourcePath = path.join(root, `source${extension}`);
  await mkdir(previewRoot);
  await writeFile(sourcePath, "office source");
  return { root, previewRoot, sourcePath, storedFilename: `safe-id${extension}` };
}

afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

describe("LibreOffice detection", () => {
  it("uses the configured binary without exposing failed command details", async () => {
    const exec = vi.fn().mockResolvedValue({ stdout: "LibreOffice" });
    await expect(detectLibreOffice({ exec, configuredBinary: "/opt/libreoffice/program/soffice" })).resolves.toBe("/opt/libreoffice/program/soffice");
    expect(exec).toHaveBeenCalledWith("/opt/libreoffice/program/soffice", ["--version"], { timeout: 5000 });
  });

  it("returns a safe error when LibreOffice is unavailable", async () => {
    await expect(detectLibreOffice({ exec: vi.fn().mockRejectedValue(new Error("secret command details")), configuredBinary: "missing" }))
      .rejects.toMatchObject({ code: "OFFICE_PREVIEW_UNAVAILABLE", message: "Office preview requires LibreOffice on the server" });
  });
});

describe("Office PDF conversion", () => {
  it.each([".docx", ".xlsx", ".pptx"])("converts %s inside isolated preview storage", async (extension) => {
    const data = await fixture(extension);
    const exec = vi.fn(async (_command, args) => {
      const outdir = args[args.indexOf("--outdir") + 1];
      await writeFile(path.join(outdir, "safe-id.pdf"), "%PDF-valid");
    });
    const result = await convertOfficeToPdf({ command: "libreoffice", ...data, attachmentId: "attachment-id", exec });
    expect(result).toBe(path.join(data.previewRoot, "attachment-id.pdf"));
    await expect(readFile(result, "utf8")).resolves.toBe("%PDF-valid");
    expect((await readdir(data.previewRoot)).filter((name) => name.startsWith(".office-preview-"))).toEqual([]);
    expect(exec.mock.calls[0][1]).toContain("--safe-mode");
  });

  it("maps a timeout to a safe timeout error and cleans temporary files", async () => {
    const data = await fixture(".docx");
    await expect(convertOfficeToPdf({ command: "libreoffice", ...data, attachmentId: "id", exec: vi.fn().mockRejectedValue({ killed: true }) }))
      .rejects.toMatchObject({ code: "OFFICE_CONVERSION_TIMEOUT" });
    expect(await readdir(data.previewRoot)).toEqual([]);
  });

  it.each(["empty", "invalid"])("rejects %s generated PDF output", async (kind) => {
    const data = await fixture(".xlsx");
    const exec = vi.fn(async (_command, args) => {
      const outdir = args[args.indexOf("--outdir") + 1];
      await writeFile(path.join(outdir, "safe-id.pdf"), kind === "empty" ? "" : "not a pdf");
    });
    await expect(convertOfficeToPdf({ command: "libreoffice", ...data, attachmentId: "id", exec }))
      .rejects.toMatchObject({ code: "OFFICE_CONVERSION_FAILED" });
    expect(await readdir(data.previewRoot)).toEqual([]);
  });
});
