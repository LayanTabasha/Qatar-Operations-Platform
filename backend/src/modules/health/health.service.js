import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { createRequire } from "node:module";
import { query } from "../../config/database.js";
import { requiredOperationalStorage } from "../../config/operational-storage.js";

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

async function checkMigrations(queryFn = query) {
  try {
    const result = await queryFn("SELECT filename, applied_at FROM schema_migrations ORDER BY applied_at DESC, filename DESC LIMIT 1");
    return {
      status: "healthy",
      message: result.rows[0] ? "Migration history is available" : "No applied migrations recorded",
      countAvailable: Boolean(result.rows[0]),
      latest: result.rows[0]?.filename || null,
      appliedAt: result.rows[0]?.applied_at || null,
    };
  } catch {
    return { status: "unknown", message: "Migration history is unavailable", countAvailable: false, latest: null, appliedAt: null };
  }
}

export async function getPlatformHealth({ queryFn = query, storageCheck = checkStorage, now = () => new Date(), uptime = () => process.uptime() } = {}) {
  const checkedAt = now().toISOString();
  const [database, storage, migrations] = await Promise.all([
    checkDatabase(queryFn),
    storageCheck(),
    checkMigrations(queryFn),
  ]);
  const criticalFailure = database.status === "unavailable" || storage.status === "unavailable";
  const noncriticalWarning = storage.status === "degraded" || migrations.status !== "healthy";
  const status = criticalFailure ? "unavailable" : noncriticalWarning ? "degraded" : "healthy";

  return {
    success: true,
    status,
    message: status === "healthy" ? "All critical platform services are operational" : status === "degraded" ? "Critical services are operational with a noncritical warning" : "A critical platform dependency is unavailable",
    components: {
      backend: safeComponent("healthy", "API is responding"),
      database,
      storage,
    },
    application: {
      uptimeSeconds: Math.max(0, Math.floor(uptime())),
      version,
    },
    serverTimestamp: checkedAt,
    lastHealthCheck: checkedAt,
    migrations,
  };
}
