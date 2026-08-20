import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(process.cwd(), "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const index = read("index.html");
const account = read("frontend/pages/settings/account-settings.js");
const users = read("frontend/pages/settings/user-management.js");
const page = read("frontend/pages/settings/settings-page.js");
const archive = read("frontend/pages/settings/archive-page.js");

describe("Settings and Archive structure", () => {
  it("preserves account and password panels", () => {
    expect(account).toContain("function renderReadOnlyProfile(user)");
    expect(account).toContain("function renderSecurityInfo(user)");
    expect(account).toContain("function renderPasswordPanel()");
    expect(account).toContain('id="settings-password-form"');
  });

  it("preserves administrator user-management actions and protections", () => {
    for (const action of ["loadManagedUsers", "submitUserManagementForm", "editManagedUser", "changeManagedUserStatus", "openDeleteUserModal", "resetManagedUserPassword"]) {
      expect(users).toContain(`function ${action}(`);
    }
    expect(users).toContain("You cannot deactivate your own account.");
    expect(users).toContain("This permanently deletes the user account");
  });

  it("keeps Archive cohesive and administrator-gated by the orchestrator", () => {
    expect(page).toContain('"Archive": renderArchivePage()');
    expect(page).toContain('selected === "Archive" && isAdmin()');
    expect(archive).toContain("await Promise.all([loadArchiveData(), loadOperationalData()])");
    expect(archive).toContain("await Promise.all([loadOperationalData(), loadArchiveData()])");
  });

  it("loads every component before the final orchestrator and app", () => {
    const sources = Array.from(index.matchAll(/<script\s+src="([^"]+)"/g), (match) => match[1].split("?")[0]);
    const orchestrator = sources.indexOf("frontend/pages/settings/settings-page.js");
    for (const file of ["settings-shared.js", "archive-page.js", "account-settings.js", "platform-health.js", "user-management.js"]) {
      expect(sources.indexOf(`frontend/pages/settings/${file}`)).toBeLessThan(orchestrator);
    }
    expect(orchestrator).toBeLessThan(sources.indexOf("app.js"));
  });
});
