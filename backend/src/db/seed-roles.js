import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { pool, query } from "../config/database.js";
import { logger } from "../config/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rolesSeedFile = path.join(__dirname, "seeds", "001_roles.sql");

export async function runRoleSeed({ dbQuery = query, seedFilePath = rolesSeedFile } = {}) {
  const sql = await fs.readFile(seedFilePath, "utf8");
  await dbQuery(sql);
  logger.info("Roles seed applied");

  return { status: "applied" };
}

async function runCli() {
  try {
    await runRoleSeed();
  } finally {
    await pool.end();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().catch((err) => {
    logger.error({ err }, "Roles seed failed");
    process.exit(1);
  });
}
