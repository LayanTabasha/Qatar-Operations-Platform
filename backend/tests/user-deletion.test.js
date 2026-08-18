import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(process.cwd(), "..");
const repository = fs.readFileSync(path.join(process.cwd(), "src/modules/users/users.repository.js"), "utf8");
const routes = fs.readFileSync(path.join(process.cwd(), "src/modules/users/users.routes.js"), "utf8");
const settings = fs.readFileSync(path.join(root, "js/settings-page.js"), "utf8");
const api = fs.readFileSync(path.join(root, "js/api-client.js"), "utf8");
const migration = fs.readFileSync(path.join(process.cwd(), "src/db/migrations/024_allow_safe_user_deletion.sql"), "utf8");

describe("permanent user deletion contract", () => {
  it("uses a real DELETE endpoint and retains the separate status endpoint", () => {
    expect(api).toContain('return apiRequest(`/users/${id}`, { method: "DELETE" })');
    expect(routes).toContain('usersRouter.delete("/:id", deleteUser)');
    expect(routes).toContain('usersRouter.patch("/:id/status", updateUserStatus)');
    expect(repository).toContain('client.query("DELETE FROM users WHERE id = $1", [id])');
  });

  it("preserves historical rows with SET NULL and never cascades from users", () => {
    expect(migration).not.toContain("ON DELETE CASCADE");
    expect(migration).not.toMatch(/DROP TABLE|TRUNCATE|DELETE FROM/);
    expect(migration.match(/ON DELETE SET NULL/g)).toHaveLength(12);
    for (const constraint of [
      "site_visits_created_by_fkey", "site_visits_updated_by_fkey", "faults_created_by_fkey",
      "documents_uploaded_by_fkey", "reports_created_by_fkey", "operational_attachments_uploaded_by_fkey",
      "troubleshooting_records_created_by_fkey", "sites_archived_by_fkey", "chargers_archived_by_fkey",
      "chargers_restored_by_fkey", "chargers_deleted_by_fkey", "requests_requested_by_fkey",
    ]) expect(migration).toContain(`DROP CONSTRAINT ${constraint}`);
  });

  it("confirms permanent deletion, refreshes, protects self, and records audit", () => {
    expect(settings).toContain("This permanently deletes the user account");
    expect(settings).toMatch(/Users\.remove[\s\S]*loadManagedUsers\(\)[\s\S]*User deleted successfully/);
    expect(settings).toContain("user.id === currentUserId");
    expect(repository).toContain('action: "user_deleted"');
    expect(repository).toContain("deleted_user_id");
    expect(repository).toContain("pg_advisory_xact_lock");
  });
});
