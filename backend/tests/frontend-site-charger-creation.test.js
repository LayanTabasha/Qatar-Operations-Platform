import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(process.cwd(), "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const index = read("index.html");
const siteProfile = read("frontend/pages/sites/site-profile.js");
const chargerProfile = read("frontend/pages/sites/charger-profile.js");
const sitesList = read("frontend/pages/sites/sites-list.js");
const modals = ["frontend/shared/modals/modal-files.js", "frontend/shared/modals/fault-modals.js", "frontend/shared/modals/modal-configs.js", "frontend/shared/modals/modal-core.js", "frontend/shared/modals/modal-submit.js"].map(read).join("\n");
const state = read("js/state.js");
const app = read("app.js");
const styles = read("styles.css");

describe("Site and Charger creation controls", () => {
  it("shows Add Site only to administrators", () => {
    expect(index).toContain('id="add-site-button"');
    expect(index).toContain('data-modal="site" data-mode="create"');
    expect(sitesList).toContain('classList.toggle("hidden", !isAdmin())');
    expect(state).toContain("function isAdmin()");
    expect(index).toContain('class="primary-button hidden" id="add-site-button"');
  });

  it("shows Add Charger in populated and empty Site Profile Charger tabs only to writable roles", () => {
    expect(siteProfile).toContain("const addCharger = isAdmin() && siteRecord?.id");
    expect(siteProfile).toContain('${addCharger}</div></div><div class="charger-grid">');
    expect(siteProfile).toContain("${addCharger}</div>`");
    expect(siteProfile).toContain('data-mode="create" data-site-context="${site}"');
  });

  it("locks Site Profile charger creation to the captured PostgreSQL site UUID", () => {
    expect(siteProfile).toContain('data-site-id="${siteRecord.id}" data-lock-site="true"');
    expect(app).toContain('siteId: modalButton.dataset.siteId || ""');
    expect(app).toContain('lockSite: modalButton.dataset.lockSite === "true"');
    expect(modals).toContain('form.dataset.siteId = context.siteId || ""');
    expect(modals).toContain("siteField.disabled = true");
    expect(modals).toContain('siteField.setAttribute("aria-readonly", "true")');
    expect(modals).toContain("state.sites.find((item) => item.id === lockedSiteId)");
    expect(modals).toContain("site_id: site.id");
  });

  it("creates through namespaced APIs and reloads PostgreSQL-backed operational data", () => {
    expect(modals).toContain("await window.QatarOpsApi.Sites.create(payload)");
    expect(modals).toContain("await window.QatarOpsApi.Chargers.create(payload)");
    expect(modals.match(/await loadOperationalData\(\)/g)?.length).toBeGreaterThanOrEqual(2);
    expect(state).not.toMatch(/sites:\s*state\.sites/);
    expect(state).not.toMatch(/chargers:\s*state\.(?:chargers|sites)/);
  });

  it("preserves edit and archive controls with role-safe rendering", () => {
    expect(sitesList).toContain('data-modal="site" data-mode="edit"');
    expect(chargerProfile).toContain('data-modal="charger" type="button">Edit Charger Information');
    expect(sitesList).toContain('data-archive-active="site"');
    expect(chargerProfile).toContain('data-archive-active="charger"');
    expect(chargerProfile).not.toContain('data-archive-delete="');
  });

  it("reuses compact controls without changing Site or Charger card sizing CSS", () => {
    expect(siteProfile).toContain('class="quick-actions compact"');
    expect(styles).toContain(".site-card .site-card-actions button { flex: 1 1 82px; width: auto;");
    expect(styles).toContain(".site-grid, .contact-grid, .charger-grid, .summary-grid { display: grid;");
  });
});
