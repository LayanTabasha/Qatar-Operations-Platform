import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "../config/database.js";
import { logger } from "../config/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsDir = path.join(__dirname, "migrations");

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
}

async function getAppliedMigrations(client) {
  const result = await client.query("SELECT filename FROM schema_migrations");
  return new Set(result.rows.map((row) => row.filename));
}

async function getMigrationFiles() {
  const entries = await fs.readdir(migrationsDir);
  return entries.filter((entry) => entry.endsWith(".sql")).sort();
}

export async function runMigrations() {
  const client = await pool.connect();

  try {
    await ensureMigrationsTable(client);

    const appliedMigrations = await getAppliedMigrations(client);
    const migrationFiles = await getMigrationFiles();

    for (const filename of migrationFiles) {
      if (appliedMigrations.has(filename)) {
        continue;
      }

      const filePath = path.join(migrationsDir, filename);
      const sql = await fs.readFile(filePath, "utf8");

      await client.query("BEGIN");

      try {
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [filename]);
        await client.query("COMMIT");
        logger.info({ migration: filename }, "Migration applied");
      } catch (err) {
        await client.query("ROLLBACK");
        logger.error({ err, migration: filename }, "Migration failed");
        throw err;
      }
    }
  } finally {
    client.release();
  }
}

runMigrations()
  .then(async () => {
    logger.info("Migrations complete");
    await pool.end();
  })
  .catch(async (err) => {
    logger.error({ err }, "Migration runner failed");
    await pool.end();
    process.exit(1);
  });
