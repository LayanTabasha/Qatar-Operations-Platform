import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "../config/database.js";
import { logger } from "../config/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const seedsDir = path.join(__dirname, "seeds");

async function getSeedFiles() {
  const entries = await fs.readdir(seedsDir);
  return entries.filter((entry) => entry.endsWith(".sql")).sort();
}

export async function runSeeds() {
  const client = await pool.connect();

  try {
    const seedFiles = await getSeedFiles();

    for (const filename of seedFiles) {
      const filePath = path.join(seedsDir, filename);
      const sql = await fs.readFile(filePath, "utf8");

      await client.query("BEGIN");

      try {
        await client.query(sql);
        await client.query("COMMIT");
        logger.info({ seed: filename }, "Seed applied");
      } catch (err) {
        await client.query("ROLLBACK");
        logger.error({ err, seed: filename }, "Seed failed");
        throw err;
      }
    }
  } finally {
    client.release();
  }
}

runSeeds()
  .then(async () => {
    logger.info("Seeds complete");
    await pool.end();
  })
  .catch(async (err) => {
    logger.error({ err }, "Seed runner failed");
    await pool.end();
    process.exit(1);
  });
