import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { initializeOperationalStorage } from "../src/config/operational-storage.js";
import { checkStorage, getPlatformHealth } from "../src/modules/health/health.service.js";

const temporaryRoots = [];

async function temporaryRoot() {
  const root = await import("node:fs/promises").then(({ mkdtemp }) => mkdtemp(path.join(os.tmpdir(), "qatar-ops-storage-")));
  temporaryRoots.push(root);
  return root;
}

afterEach(async () => {
  const { rm } = await import("node:fs/promises");
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("operational storage initialization", () => {
  it("preserves the upload directory and creates a missing preview directory", async () => {
    const root = await temporaryRoot();
    const upload = path.join(root, "operational-files");
    const preview = path.join(root, "previews");
    await mkdir(upload);
    await writeFile(path.join(upload, "existing.pdf"), "%PDF-existing");

    await initializeOperationalStorage({ directories: [
      { key: "upload", path: upload },
      { key: "preview", path: preview },
    ] });

    await expect(readFile(path.join(upload, "existing.pdf"), "utf8")).resolves.toBe("%PDF-existing");
    await expect(access(preview)).resolves.toBeUndefined();
  });

  it("fails safely when required storage cannot be initialized", async () => {
    const underlying = Object.assign(new Error("sensitive path details"), { code: "EACCES" });
    await expect(initializeOperationalStorage({
      directories: [{ key: "preview", path: "/not-exposed" }],
      mkdirFn: vi.fn().mockRejectedValue(underlying),
    })).rejects.toMatchObject({ code: "STORAGE_INITIALIZATION_FAILED", message: "Operational preview storage could not be initialized" });
  });
});

describe("operational storage health", () => {
  it("reports initialized storage as healthy", async () => {
    const root = await temporaryRoot();
    const directories = [
      { key: "upload", name: "Operational attachments", path: path.join(root, "uploads") },
      { key: "preview", name: "Attachment previews", path: path.join(root, "previews") },
    ];
    await initializeOperationalStorage({ directories });
    await expect(checkStorage(directories)).resolves.toMatchObject({ status: "healthy", message: "File storage is operational" });
  });

  it("makes a preview-only failure degraded, not unavailable", async () => {
    const storageCheck = vi.fn().mockResolvedValue({ status: "degraded", message: "File previews are unavailable", directories: [] });
    const queryFn = vi.fn().mockResolvedValue({ rows: [{ filename: "018.sql", applied_at: new Date() }] });
    await expect(getPlatformHealth({ storageCheck, queryFn })).resolves.toMatchObject({
      status: "degraded",
      components: { storage: { status: "degraded" } },
    });
  });

  it("makes an upload storage failure unavailable", async () => {
    const directories = [
      { key: "upload", name: "Operational attachments", path: "/upload" },
      { key: "preview", name: "Attachment previews", path: "/preview" },
    ];
    const storage = await checkStorage(directories, vi.fn(async (target) => {
      if (target === "/upload") throw new Error("denied");
    }));
    expect(storage).toMatchObject({ status: "unavailable", message: "File uploads are unavailable" });
  });
});
