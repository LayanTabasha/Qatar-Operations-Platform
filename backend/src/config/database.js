import pg from "pg";
import { env } from "./env.js";

export const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  ssl: env.DATABASE_SSL ? { rejectUnauthorized: false } : false,
});

export function query(text, params) {
  return pool.query(text, params);
}

export async function testDatabaseConnection() {
  await query("SELECT 1");
}

export async function closeDatabasePool() {
  await pool.end();
}
