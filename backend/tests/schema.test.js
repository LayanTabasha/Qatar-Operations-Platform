import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import packageJson from "../package.json" with { type: "json" };

const migrationsDir = path.resolve("src/db/migrations");
const seedsDir = path.resolve("src/db/seeds");

function sqlFilesIn(directory) {
  return fs.readdirSync(directory).filter((filename) => filename.endsWith(".sql")).sort();
}

describe("database schema files", () => {
  it("has migration files in numeric order", () => {
    const migrationFiles = sqlFilesIn(migrationsDir);

    expect(migrationFiles.length).toBeGreaterThan(0);
    expect(migrationFiles).toEqual([...migrationFiles].sort());
    expect(migrationFiles.every((filename) => /^\d{3}_.+\.sql$/.test(filename))).toBe(true);
  });

  it("includes required core tables in the migrations", () => {
    const combinedSql = sqlFilesIn(migrationsDir)
      .map((filename) => fs.readFileSync(path.join(migrationsDir, filename), "utf8"))
      .join("\n")
      .toLowerCase();

    [
      "create table roles",
      "create table users",
      "create table sites",
      "create table chargers",
      "create table site_visits",
      "create table faults",
      "create table documents",
      "create table reports",
      "create table activity_logs",
    ].forEach((requiredTable) => {
      expect(combinedSql).toContain(requiredTable);
    });
  });

  it("has seed files", () => {
    expect(sqlFilesIn(seedsDir)).toEqual(["001_roles.sql", "002_sample_sites.sql"]);
  });

  it("has migrate and seed npm scripts", () => {
    expect(packageJson.scripts.migrate).toBe("node src/db/migrate.js");
    expect(packageJson.scripts.seed).toBe("node src/db/seed.js");
  });
});
