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

  it("uses the current charger statuses and field names", () => {
    const chargersMigration = fs.readFileSync(path.join(migrationsDir, "004_create_chargers.sql"), "utf8").toLowerCase();

    expect(chargersMigration).toContain("'archived'");
    expect(chargersMigration).toContain("'maintenance'");
    expect(chargersMigration).toContain("'faulted'");
    expect(chargersMigration).toContain("power_kw");
    expect(chargersMigration).toContain("firmware_version");
    expect(chargersMigration).not.toContain("'inactive'");
    expect(chargersMigration).not.toContain("rated_power_kw");
  });

  it("has seed files", () => {
    expect(sqlFilesIn(seedsDir)).toEqual(["001_roles.sql", "002_sample_sites.sql", "003_sample_chargers.sql"]);
  });

  it("renames site visit time columns to the API field names", () => {
    const migration = fs.readFileSync(path.join(migrationsDir, "012_rename_site_visit_time_columns.sql"), "utf8").toLowerCase();

    expect(migration).toContain("rename column check_in_time to time_in");
    expect(migration).toContain("rename column check_out_time to time_out");
  });

  it("adds production Site Visit status and last-modified audit fields", () => {
    const migration = fs.readFileSync(path.join(migrationsDir, "013_add_site_visit_status_and_update_audit.sql"), "utf8").toLowerCase();

    expect(migration).toContain("add column status");
    expect(migration).toContain("add column updated_by");
    expect(migration).toContain("site_visits_status_check");
  });

  it("adds charger lifecycle audit fields for archive restore and soft delete", () => {
    const migration = fs.readFileSync(path.join(migrationsDir, "014_add_charger_lifecycle_audit.sql"), "utf8").toLowerCase();

    ["archived_at", "archived_by", "restored_at", "restored_by", "deleted_at", "deleted_by", "previous_status"].forEach((column) => {
      expect(migration).toContain(column);
    });
  });

  it("creates the DTC fault catalogue and links faults to catalogue records", () => {
    const migration = fs.readFileSync(path.join(migrationsDir, "015_create_fault_catalogue.sql"), "utf8").toLowerCase();

    expect(migration).toContain("create table fault_catalogue");
    expect(migration).toContain("dtc_code_normalized");
    expect(migration).toContain("fault_catalogue_unique_scope");
    expect(migration).toContain("alter table faults");
    expect(migration).toContain("add column fault_catalogue_id");
    expect(migration).toContain("catalogue_snapshot");
    expect(migration).toContain("idx_fault_catalogue_dtc_code");
  });

  it("has the simplified role seed", () => {
    const rolesSeed = fs.readFileSync(path.join(seedsDir, "001_roles.sql"), "utf8").toLowerCase();

    expect(rolesSeed).toContain("'admin'");
    expect(rolesSeed).toContain("'operations_staff'");
    expect(rolesSeed).toContain("'viewer'");
    expect(rolesSeed).toContain("on conflict (name) do update");
    expect(rolesSeed).not.toContain("'operator'");
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
    expect(packageJson.scripts["seed:roles"]).toBe("node src/db/seed-roles.js");
    expect(packageJson.scripts.seed).toBe("node src/db/seed.js");
    expect(packageJson.scripts["create-admin"]).toBe("node src/db/create-admin.js");
    expect(packageJson.scripts["test:auth-local"]).toBe("node src/scripts/verify-auth-local.js");
  });

  it("has repeat-safe sample charger seed data", () => {
    const chargerSeed = fs.readFileSync(path.join(seedsDir, "003_sample_chargers.sql"), "utf8").toLowerCase();

    ["'mow-dc-01'", "'msh-dc-01'", "'msh-dc-02'", "'msh-ac-01'", "'alm-ac-01'"].forEach((code) => {
      expect(chargerSeed).toContain(code);
    });
    expect(chargerSeed).toContain("on conflict (code) do update");
  });
});
