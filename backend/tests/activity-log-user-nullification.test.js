import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDir = path.resolve("src/db/migrations");
const original = fs.readFileSync(path.join(migrationsDir, "009_create_activity_logs.sql"), "utf8");
const migration = fs.readFileSync(path.join(migrationsDir, "025_allow_user_fk_nullification_in_activity_logs.sql"), "utf8");
const userDeletion = fs.readFileSync(path.resolve("src/modules/users/users.repository.js"), "utf8");
const safeUserForeignKeys = fs.readFileSync(path.join(migrationsDir, "024_allow_safe_user_deletion.sql"), "utf8");

describe("activity log append-only user deletion exception", () => {
  it("documents the existing UPDATE and DELETE trigger coverage", () => {
    expect(original).toContain("CREATE TRIGGER activity_logs_prevent_update");
    expect(original).toContain("BEFORE UPDATE ON activity_logs");
    expect(original).toContain("CREATE TRIGGER activity_logs_prevent_delete");
    expect(original).toContain("BEFORE DELETE ON activity_logs");
    expect(original.match(/EXECUTE FUNCTION prevent_activity_log_changes\(\)/g)).toHaveLength(2);
  });

  it("allows only a non-null user reference to become null with every other field unchanged", () => {
    expect(migration).toContain("IF TG_OP = 'UPDATE'");
    expect(migration).toContain("current_setting('qatar_ops.allow_activity_log_user_nullification', true) = 'on'");
    expect(migration).toContain("OLD.user_id IS NOT NULL");
    expect(migration).toContain("NEW.user_id IS NULL");
    expect(migration).toContain("(to_jsonb(NEW) - 'user_id') = (to_jsonb(OLD) - 'user_id')");
    expect(migration).toContain("RETURN NEW");
  });

  it("continues to reject all other updates and every delete", () => {
    expect(migration).not.toMatch(/TG_OP\s*=\s*'DELETE'[\s\S]*RETURN (OLD|NEW)/);
    expect(migration).toContain("RAISE EXCEPTION 'activity_logs records are append-only'");
    expect(migration).not.toMatch(/DROP TRIGGER|DISABLE TRIGGER|ALTER TABLE activity_logs/);
  });

  it("retains operational rows while the user repository performs a real user delete", () => {
    expect(safeUserForeignKeys).not.toContain("ON DELETE CASCADE");
    expect(safeUserForeignKeys.match(/ON DELETE SET NULL/g)).toHaveLength(12);
    expect(userDeletion).toContain('client.query("DELETE FROM users WHERE id = $1", [id])');
    expect(userDeletion).toContain("set_config('qatar_ops.allow_activity_log_user_nullification', 'on', true)");
    expect(userDeletion).not.toMatch(/DELETE FROM (activity_logs|faults|site_visits|documents|reports|requests)/);
  });
});
