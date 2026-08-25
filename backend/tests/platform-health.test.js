import { describe, expect, it, vi } from "vitest";
import { checkCorePlatform, checkStorage, getPlatformHealth } from "../src/modules/health/health.service.js";

const healthyStorage = async () => ({ status: "healthy", message: "Available", directories: [] });
const healthyCore = async () => ({ status: "healthy", message: "Available" });

describe("platform health checks", () => {
  it("reports database success", async () => {
    const result = await getPlatformHealth({ queryFn: vi.fn().mockResolvedValue({ rows: [] }), storageCheck: healthyStorage, coreCheck: healthyCore });
    expect(result.components.database.status).toBe("healthy");
    expect(result.status).toBe("healthy");
  });

  it("reports unavailable when the database check fails without exposing the raw error", async () => {
    const result = await getPlatformHealth({ queryFn: vi.fn().mockRejectedValue(new Error("password secret-db-host")), storageCheck: healthyStorage, coreCheck: healthyCore });
    expect(result.status).toBe("unavailable");
    expect(result.components.database).toEqual({ status: "unavailable", message: "Database connection is unavailable" });
    expect(JSON.stringify(result)).not.toContain("secret-db-host");
  });

  it("reports healthy storage when all required directories are accessible", async () => {
    const result = await checkStorage([{ name: "Files", path: "/private/path" }], vi.fn().mockResolvedValue());
    expect(result.status).toBe("healthy");
    expect(JSON.stringify(result)).not.toContain("/private/path");
  });

  it("reports unavailable storage without exposing paths", async () => {
    const result = await checkStorage([{ name: "Files", path: "/private/path" }], vi.fn().mockRejectedValue(new Error("denied")));
    expect(result.status).toBe("unavailable");
    expect(result.directories[0]).toMatchObject({ name: "Files", status: "unavailable" });
    expect(JSON.stringify(result)).not.toContain("/private/path");
  });

  it("makes the overall platform degraded when required storage fails", async () => {
    const storageCheck = async () => ({ status: "unavailable", message: "Required storage is unavailable", directories: [] });
    const result = await getPlatformHealth({ queryFn: vi.fn().mockResolvedValue({ rows: [] }), storageCheck, coreCheck: healthyCore });
    expect(result.status).toBe("degraded");
  });

  it("makes the overall platform degraded when the core platform fails", async () => {
    const coreCheck = async () => ({ status: "unavailable", message: "Core platform check failed" });
    const result = await getPlatformHealth({ queryFn: vi.fn().mockResolvedValue({ rows: [] }), storageCheck: healthyStorage, coreCheck });
    expect(result.status).toBe("degraded");
  });

  it.each(["sites", "chargers", "faults"])("fails the core platform when %s access fails", async (failedModule) => {
    const checks = Object.fromEntries(["sites", "chargers", "faults"].map((name) => [name,
      name === failedModule ? vi.fn().mockRejectedValue(new Error("sensitive internal detail")) : vi.fn().mockResolvedValue([]),
    ]));
    const result = await checkCorePlatform(checks);
    expect(result).toEqual({ status: "unavailable", message: "Core platform check failed" });
    expect(JSON.stringify(result)).not.toContain("sensitive internal detail");
  });
});
