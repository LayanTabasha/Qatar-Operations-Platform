import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import packageJson from "../package.json" with { type: "json" };

const migrationsDir = path.resolve("src/db/migrations");
const seedsDir = path.resolve("src/db/seeds");
const modulesDir = path.resolve("src/modules");

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

  it("uses active and archived site statuses only", () => {
    const sitesMigration = fs.readFileSync(path.join(migrationsDir, "003_create_sites.sql"), "utf8").toLowerCase();

    expect(sitesMigration).toContain("'archived'");
    expect(sitesMigration).not.toContain("'inactive'");
  });

  it("has seed files", () => {
    expect(sqlFilesIn(seedsDir)).toEqual(["001_roles.sql", "002_sample_sites.sql"]);
  });

  it("has the simplified role seed", () => {
    const rolesSeed = fs.readFileSync(path.join(seedsDir, "001_roles.sql"), "utf8").toLowerCase();

    expect(rolesSeed).toContain("'admin'");
    expect(rolesSeed).toContain("'operator'");
    expect(rolesSeed).toContain("'viewer'");
    expect(rolesSeed).not.toContain("'manager'");
  });

  it("keeps health files inside the health module only", () => {
    expect(fs.existsSync(path.join(modulesDir, "health", "health.controller.js"))).toBe(true);
    expect(fs.existsSync(path.join(modulesDir, "health", "health.routes.js"))).toBe(true);
    expect(fs.existsSync(path.resolve("src/controllers/health.controller.js"))).toBe(false);
    expect(fs.existsSync(path.resolve("src/routes/health.routes.js"))).toBe(false);
  });

  it("has migrate and seed npm scripts", () => {
    expect(packageJson.scripts.migrate).toBe("node src/db/migrate.js");
    expect(packageJson.scripts.seed).toBe("node src/db/seed.js");
    expect(packageJson.scripts["create-admin"]).toBe("node src/db/create-admin.js");
  });
});
