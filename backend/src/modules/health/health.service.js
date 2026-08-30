import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { createRequire } from "node:module";
import { query } from "../../config/database.js";
import { requiredOperationalStorage } from "../../config/operational-storage.js";
import { listSites } from "../sites/sites.repository.js";
import { listChargers } from "../chargers/chargers.repository.js";
import { listFaults } from "../faults/faults.repository.js";

const require = createRequire(import.meta.url);
const { version } = require("../../../package.json");

function safeComponent(status, message) {
  return { status, message };
}

export async function checkStorage(directories = requiredOperationalStorage, accessFn = access) {
  const checks = await Promise.all(directories.map(async (directory) => {
    try {
      await accessFn(directory.path, constants.R_OK | constants.W_OK);
      return { name: directory.name, status: "healthy", message: "Readable and writable" };
    } catch {
      return { name: directory.name, status: "unavailable", message: "Required storage is not accessible" };
    }
  }));

  const uploadAvailable = checks.find((check, index) => directories[index]?.key === "upload")?.status === "healthy";
  const allAvailable = checks.every((check) => check.status === "healthy");
  return {
    status: allAvailable ? "healthy" : uploadAvailable ? "degraded" : "unavailable",
    message: allAvailable ? "File storage is operational" : uploadAvailable ? "File previews are unavailable" : "File uploads are unavailable",
    directories: checks,
  };
}

async function checkDatabase(queryFn = query) {
  try {
    await queryFn("SELECT 1");
    return safeComponent("healthy", "Database connection is available");
  } catch {
    return safeComponent("unavailable", "Database connection is unavailable");
  }
}

export async function checkCorePlatform({ sites = listSites, chargers = listChargers, faults = listFaults } = {}) {
  const checks = await Promise.allSettled([
    sites({ status: "all", search: undefined, sort: "name", order: "asc", limit: 1 }),
    chargers({ site_id: undefined, status: undefined, type: undefined, search: undefined, sort: "name", order: "asc", limit: 1 }),
    faults({ limit: 1 }),
  ]);

  return checks.every((check) => check.status === "fulfilled")
    ? safeComponent("healthy", "Sites, chargers, and faults are accessible")
    : safeComponent("unavailable", "Core platform check failed");
}

export async function getPlatformHealth({ queryFn = query, storageCheck = checkStorage, coreCheck = checkCorePlatform, now = () => new Date() } = {}) {
  const checkedAt = now().toISOString();
  const [database, storage, core] = await Promise.all([
    checkDatabase(queryFn),
    storageCheck(),
    coreCheck(),
  ]);
  const status = database.status === "unavailable"
    ? "unavailable"
    : core.status !== "healthy" || storage.status !== "healthy"
      ? "degraded"
      : "healthy";

  return {
    success: true,
    status,
    message: status === "healthy" ? "All critical platform services are operational" : status === "degraded" ? "One or more platform services are degraded" : "A critical platform dependency is unavailable",
    components: {
      backend: safeComponent("healthy", "API is responding"),
      database,
      storage,
      core,
    },
    application: {
      version,
    },
    serverTimestamp: checkedAt,
    lastHealthCheck: checkedAt,
  };
}
