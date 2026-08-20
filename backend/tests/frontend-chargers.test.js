import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(process.cwd(), "..");
const readRootFile = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

describe("frontend Archive workflow", () => {
  const sources = () => ({
    api: readRootFile("js/api-client.js"), archive: readRootFile("frontend/pages/settings/archive-page.js"),
    settings: readRootFile("js/settings-page.js"), sites: readRootFile("js/sites-page.js"),
    sitesList: readRootFile("frontend/pages/sites/sites-list.js"),
    mappers: readRootFile("frontend/pages/sites/sites-data-mappers.js"),
    state: readRootFile("js/state.js"), modals: readRootFile("js/modals.js"),
    index: readRootFile("index.html"), styles: readRootFile("styles.css"),
  });

  it("maps and submits the three existing charger form fields", () => {
    const { mappers, modals, state } = sources();
    expect(mappers).toContain('operator: charger.operator || ""');
    expect(mappers).toContain('administrator: charger.administrator || ""');
    expect(mappers).toContain('installationDate: charger.installation_date || ""');
    expect(modals).toContain('operator: document.getElementById("operator")?.value.trim() || null');
    expect(modals).toContain('administrator: document.getElementById("administrator")?.value.trim() || null');
    expect(modals).toContain('installation_date: document.getElementById("installation-date")?.value || null');
    expect(state).toContain('["Operator", "text"], ["Administrator", "text"]');
    expect(state).toContain('["Installation date", "date"]');
  });

  it("prefills the existing charger fields when editing", () => {
    const { modals } = sources();
    expect(modals).toContain('setFieldValue("operator", charger?.operator)');
    expect(modals).toContain('setFieldValue("administrator", charger?.administrator)');
    expect(modals).toContain('setFieldValue("installation-date", charger?.installationDate)');
  });

  it("keeps the charger card field labels and order unchanged", () => {
    const { sites } = sources();
    const cardStart = sites.indexOf('<article class="charger-card">');
    const cardEnd = sites.indexOf('</article>', cardStart);
    const card = sites.slice(cardStart, cardEnd);
    const labels = Array.from(card.matchAll(/placeholder\("([^"]+)"/g), (match) => match[1]);

    expect(labels).toEqual([
      "Charger Type", "Status", "Manufacturer", "Capacity", "Operator", "Administrator",
      "Model", "Serial Number", "Installation Date", "Faults", "Last Visit",
    ]);
  });

  it("shows Archive only in the Administrator settings menu", () => {
    const { settings, state } = sources();
    expect(state).toContain('administrationSettingsItems = ["User Management", "Site & Charger Configuration", "Archive", "Audit Logs"]');
    expect(settings).toContain("const adminButtons = isAdmin()");
    expect(settings).toContain("const availableSettings = isAdmin() ? settingsItems : personalSettingsItems");
  });

  it("renders both tabs, search, counts and states", () => {
    const { archive } = sources();
    expect(archive).toContain("Archived Sites");
    expect(archive).toContain("Archived Chargers");
    expect(archive).toContain('id="archive-search"');
    expect(archive).toContain("Loading archive");
    expect(archive).toContain("data-archive-retry");
    expect(archive).toContain("No archived");
  });

  it("renders responsive archive cards instead of the oversized Archive table", () => {
    const { archive, styles } = sources();
    expect(archive).toContain('class="archive-card archive-site-card"');
    expect(archive).toContain('class="archive-card archive-charger-card"');
    expect(archive).toContain('class="archive-card-footer"');
    expect(archive).not.toContain('class="table-wrap archive-table"');
    expect(styles).toContain(".archive-card-grid");
    expect(styles).toContain("repeat(auto-fit");
    expect(styles).toContain(".settings-panel { min-width: 0;");
    expect(styles).toContain("flex-wrap: wrap");
    expect(archive).toContain(">View Details</button>");
    expect(archive).toContain(">Restore</button>");
    expect(archive).toContain(">Delete Permanently</button>");
  });

  it("uses useful search placeholders and concise Archive-only missing values", () => {
    const { archive } = sources();
    expect(archive).toContain('placeholder="Search archived ${state.archive.tab}"');
    expect(archive).toContain('function archiveValue(value)');
    expect(archive).toContain('? "—"');
    expect(archive).not.toContain('value="${formatSettingValue(state.archive.search)}"');
    expect(archive).not.toContain("Not Available Yet");
  });

  it("loads archived sites and chargers from the dedicated endpoints", () => {
    const { api, archive } = sources();
    expect(api).toContain('apiRequest("/archive/sites"');
    expect(api).toContain('apiRequest("/archive/chargers"');
    expect(archive).toContain("window.QatarOpsApi.Archive.listSites()");
    expect(archive).toContain("window.QatarOpsApi.Archive.listChargers()");
  });

  it("uses the correct restore and permanent-delete endpoints", () => {
    const { api, archive } = sources();
    expect(api).toContain("`/sites/${id}/restore`");
    expect(api).toContain("`/chargers/${id}/restore`");
    expect(api).toContain("`/sites/${id}/permanent`");
    expect(api).toContain("`/chargers/${id}/permanent`");
    expect(archive).toContain("readableDependencies(archiveDependencies(error))");
  });

  it("provides admin-only Archive actions on active sites and chargers without permanent delete", () => {
    const { sites, sitesList } = sources();
    expect(sitesList).toContain('data-archive-active="site"');
    expect(sites).toContain('data-archive-active="charger"');
    expect(sites).toContain("isAdmin()");
    expect(sites).not.toContain('data-archive-delete="');
  });

  it("keeps archived data out of operational loading and local storage", () => {
    const { sites, state } = sources();
    expect(sites).not.toContain('ChargersApi.list({ status: "archived"');
    expect(state).not.toContain("archivedChargers");
    expect(state).not.toContain("archive: state.archive");
  });

  it("loads every changed browser asset with a current cache token", () => {
    const { index } = sources();
    expect(index).toContain("app.js?v=20260818-legacy-content-actions-v3");
    expect(index).toContain("frontend/pages/settings/archive-page.js?v=20260818-frontend-structure-v1");
    expect(index).toContain("js/settings-page.js?v=20260816-permanent-user-delete");
    expect(index).toContain("js/api-client.js?v=20260818-legacy-content-actions-v3");
    expect(index).toContain("js/state.js?v=20260818-fault-lifecycle-v1");
    expect(index).toContain("js/sites-page.js?v=20260820-operational-records-split-v1");
    expect(index).toContain("js/modals.js?v=20260818-fault-lifecycle-v1");
    expect(index).toContain("styles.css?v=20260816-homepage-compact");
  });
});
