import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { JSDOM, VirtualConsole } from "jsdom";
import { describe, expect, it, vi } from "vitest";

const root = path.resolve(process.cwd(), "..");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const scriptSources = Array.from(index.matchAll(/<script\s+src="([^"]+)"/g), (match) => match[1]);
const localScripts = scriptSources
  .filter((source) => !/^https?:\/\//.test(source))
  .map((source) => ({ source, file: source.split("?")[0] }));

function productionDefinitionCount(name, scripts = localScripts) {
  const production = scripts.map(({ file }) => fs.readFileSync(path.join(root, file), "utf8")).join("\n");
  return (production.match(new RegExp(`(?:async\\s+)?function\\s+${name}\\(`, "g")) || []).length;
}

async function startup() {
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on("jsdomError", (error) => errors.push(error));
  const dom = new JSDOM(index, {
    url: "https://zdoperations.zdenergyqatar.com/",
    runScripts: "outside-only",
    virtualConsole,
  });
  const { window } = dom;
  window.fetch = vi.fn(async () => ({
    ok: false,
    status: 401,
    headers: { get: () => "application/json" },
    json: async () => ({ message: "Unauthenticated startup test" }),
    text: async () => JSON.stringify({ message: "Unauthenticated startup test" }),
  }));
  window.alert = vi.fn();
  window.confirm = vi.fn(() => false);
  window.prompt = vi.fn(() => null);
  window.HTMLElement.prototype.scrollIntoView = () => {};
  window.HTMLElement.prototype.scrollTo = () => {};
  window.URL.createObjectURL = () => "blob:startup-test";
  window.URL.revokeObjectURL = () => {};
  const context = dom.getInternalVMContext();
  for (const { source, file } of localScripts) {
    const absolute = path.join(root, file);
    expect(fs.existsSync(absolute), `${source} must resolve to an active local script`).toBe(true);
    vm.runInContext(fs.readFileSync(absolute, "utf8"), context, { filename: file });
  }
  await new Promise((resolve) => setTimeout(resolve, 0));
  return { dom, context, errors };
}

describe("full production-order frontend startup", () => {
  it("derives and executes every active local script in exact index.html order", async () => {
    expect(localScripts.map(({ file }) => file)).toEqual([
      "js/state.js", "js/api-client.js", "js/auth-router.js", "frontend/shared/utils/display-utils.js",
      "frontend/pages/homepage/home-shared.js", "frontend/pages/homepage/records-by-site.js",
      "frontend/pages/homepage/visit-activity.js", "frontend/pages/homepage/fault-status.js",
      "frontend/pages/homepage/charger-status.js", "frontend/pages/homepage/recent-activity.js",
      "frontend/pages/homepage/requests-status.js", "frontend/pages/homepage/global-search.js",
      "frontend/pages/homepage/fault-trend.js", "frontend/pages/homepage/kpi-cards.js",
      "frontend/pages/homepage/home-page.js", "frontend/pages/sites/sites-data-mappers.js",
      "frontend/pages/sites/sites-shared.js", "frontend/pages/sites/sites-list.js",
      "frontend/pages/sites/site-visits.js", "frontend/pages/sites/faults.js",
      "frontend/pages/sites/operational-records.js", "frontend/pages/sites/site-profile.js",
      "frontend/pages/sites/charger-profile.js", "frontend/pages/sites/charger-lifecycle.js",
      "frontend/pages/sites/sites-data.js",
      "frontend/pages/contacts/contacts-page.js",
      "frontend/pages/requests/requests-shared.js", "frontend/pages/requests/requests-list.js",
      "frontend/pages/requests/request-detail.js", "frontend/pages/requests/request-form.js",
      "frontend/pages/requests/requests-page.js", "frontend/shared/modals/modal-files.js",
      "frontend/shared/modals/fault-modals.js", "frontend/shared/modals/modal-configs.js", "frontend/shared/modals/modal-core.js",
      "frontend/shared/modals/modal-submit.js",
      "frontend/shared/files/file-preview.js", "frontend/pages/settings/settings-shared.js",
      "frontend/pages/settings/archive-page.js", "frontend/pages/settings/account-settings.js",
      "frontend/pages/settings/platform-health.js", "frontend/pages/settings/user-management.js",
      "frontend/pages/settings/settings-page.js", "app.js",
    ]);
    const instance = await startup();
    expect(instance.errors).toEqual([]);
    expect(instance.dom.window.document.getElementById("login-screen")?.classList.contains("hidden")).toBe(false);
    instance.dom.window.close();
  });

  it("reproduces the exact duplicate siteListFilters outage if sites-list loads twice", async () => {
    const instance = await startup();
    const sitesList = fs.readFileSync(path.join(root, "frontend/pages/sites/sites-list.js"), "utf8");
    expect(() => vm.runInContext(sitesList, instance.context, { filename: "duplicate-sites-list.js" }))
      .toThrow(/Identifier 'siteListFilters' has already been declared/);
    instance.dom.window.close();
  });

  it("keeps moved lexical state and guarded listener registrations singular", () => {
    const production = localScripts.map(({ file }) => fs.readFileSync(path.join(root, file), "utf8")).join("\n");
    for (const declaration of ["siteListFilters", "operationalRecordFilters", "faultTrendChartInstance", "REQUEST_CATEGORIES", "REQUEST_PRIORITIES", "requestFilters", "requestPageLoading", "requestPageError"]) {
      const definitions = production.match(new RegExp(`(?:const|let|class)\\s+${declaration}\\b`, "g")) || [];
      expect(definitions, declaration).toHaveLength(1);
    }
    expect((production.match(/dataset\.sitesFiltersBound\s*=\s*"true"/g) || [])).toHaveLength(1);
    expect((production.match(/event\.target\.id === "global-search"/g) || [])).toHaveLength(1);
    expect((production.match(/event\.target\.closest\("\[data-global-result\]"\)/g) || [])).toHaveLength(1);
    expect((production.match(/event\.target\.id !== "requests-search"/g) || [])).toHaveLength(1);
    expect((production.match(/const filterMap = \{ "requests-status"/g) || [])).toHaveLength(1);
    for (const name of [
      "baseFilesForTitle", "filteredFiles", "fileRows", "fileActionButtons", "contentRecord",
      "contentTypeLabel", "openContentRecordDetail", "openContentDeleteConfirmation",
      "openLegacyContentDeleteConfirmation", "openOperationalDeleteConfirmation", "moduleFilterControls",
      "moduleTableBody", "recordsModule", "updateOperationalRecordResults", "restoreArchivedCharger",
      "permanentlyDeleteArchivedCharger",
      "siteTab", "openSite", "chargerTab", "openCharger",
      "loadOperationalData", "refreshOpenProfiles", "removeSiteVisitReportAttachment",
    ]) {
      expect(production.match(new RegExp(`(?:async\\s+)?function\\s+${name}\\(`, "g")) || [], name).toHaveLength(1);
    }
  });

  it("locks the Requests split cache and single-definition contract", () => {
    const requestSources = [
      "frontend/pages/requests/requests-shared.js?v=20260820-requests-shared-v1",
      "frontend/pages/requests/requests-list.js?v=20260820-requests-list-v1",
      "frontend/pages/requests/request-detail.js?v=20260820-request-detail-v1",
      "frontend/pages/requests/request-form.js?v=20260820-request-form-v1",
      "frontend/pages/requests/requests-page.js?v=20260820-requests-page-v1",
    ];
    for (const source of requestSources) expect(scriptSources).toContain(source);
    expect(scriptSources.some((source) => source.startsWith("js/requests-page.js?"))).toBe(false);
    expect(fs.existsSync(path.join(root, "js/requests-page.js"))).toBe(false);
    for (const name of ["renderRequestsPage", "loadRequestsPage", "loadRequestsPageFresh", "updateRequestsNavigation", "submitRequestForm", "openRequestDetails", "updateRequestStatusFromTable"]) {
      expect(productionDefinitionCount(name), name).toBe(1);
    }
  });

  it("locks the Settings split cache and single-definition contract", () => {
    const settingsSources = [
      "frontend/pages/settings/settings-shared.js?v=20260820-settings-shared-ownership-v1",
      "frontend/pages/settings/account-settings.js?v=20260820-account-settings-v1",
      "frontend/pages/settings/platform-health.js?v=20260825-platform-health-v2",
      "frontend/pages/settings/user-management.js?v=20260820-user-management-v1",
      "frontend/pages/settings/settings-page.js?v=20260820-settings-page-v1",
    ];
    for (const source of settingsSources) expect(scriptSources).toContain(source);
    expect(scriptSources.some((source) => source.startsWith("js/settings-page.js?"))).toBe(false);
    expect(fs.existsSync(path.join(root, "js/settings-page.js"))).toBe(false);
    for (const name of ["renderSettings", "renderSettingsMenu", "loadManagedUsers", "loadPlatformHealth", "renderArchivePage", "loadArchiveData"]) {
      expect(productionDefinitionCount(name), name).toBe(1);
    }
    const production = localScripts.map(({ file }) => fs.readFileSync(path.join(root, file), "utf8")).join("\n");
    expect((production.match(/data-user-delete-confirm/g) || []).length).toBeGreaterThan(0);
    expect((production.match(/getElementById\("settings-panel"\)\?\.addEventListener\("click"/g) || [])).toHaveLength(1);
    expect((production.match(/getElementById\("modal-form"\)\?\.addEventListener\("click"/g) || [])).toHaveLength(1);
  });

  it("locks the modal split cache and single-definition contract", () => {
    const modalSources = [
      "frontend/shared/modals/modal-files.js?v=20260820-modal-files-v1",
      "frontend/shared/modals/fault-modals.js?v=20260825-fault-resolution-v1",
      "frontend/shared/modals/modal-configs.js?v=20260825-site-visit-lifecycle-v1",
      "frontend/shared/modals/modal-core.js?v=20260825-contacts-admin-v1",
      "frontend/shared/modals/modal-submit.js?v=20260825-contacts-admin-v1",
    ];
    for (const source of modalSources) expect(scriptSources).toContain(source);
    expect(scriptSources.some((source) => source.startsWith("js/modals.js?"))).toBe(false);
    expect(fs.existsSync(path.join(root, "js/modals.js"))).toBe(false);
    for (const name of ["openModal", "closeModal", "prefillModal", "openSiteVisitDetail", "openFaultDetail", "handleModalSubmit", "simulateUpdate", "refreshChargerSelect", "renderCurrentAttachment", "persistOperationalFiles"]) {
      expect(productionDefinitionCount(name), name).toBe(1);
    }
    const production = localScripts.map(({ file }) => fs.readFileSync(path.join(root, file), "utf8")).join("\n");
    for (const declaration of ["IMAGE_UPLOAD_MAX_BYTES", "IMAGE_UPLOAD_TYPES", "pendingModalImage", "pendingSiteImageFile", "removeExistingSiteImage", "faultCatalogueSearchTimer"]) {
      expect(production.match(new RegExp(`(?:const|let|class)\\s+${declaration}\\b`, "g")) || [], declaration).toHaveLength(1);
    }
  });

  it("locks final shared ownership and foundational cache tokens", () => {
    expect(scriptSources).toContain("js/state.js?v=20260825-fault-resolution-v1");
    expect(scriptSources).toContain("js/auth-router.js?v=20260820-auth-router-ownership-v1");
    expect(scriptSources).toContain("frontend/shared/modals/modal-configs.js?v=20260825-site-visit-lifecycle-v1");
    expect(scriptSources).toContain("frontend/pages/settings/settings-shared.js?v=20260820-settings-shared-ownership-v1");
    const production = localScripts.map(({ file }) => fs.readFileSync(path.join(root, file), "utf8")).join("\n");
    for (const declaration of ["modalConfigs", "personalSettingsItems", "administrationSettingsItems", "systemSettingsItems", "settingsItems", "routes", "VIEW_CONTEXT_KEY"]) {
      expect(production.match(new RegExp(`(?:const|let|class)\\s+${declaration}\\b`, "g")) || [], declaration).toHaveLength(1);
    }
    const stateSource = fs.readFileSync(path.join(root, "js/state.js"), "utf8");
    for (const declaration of ["modalConfigs", "personalSettingsItems", "administrationSettingsItems", "systemSettingsItems", "settingsItems", "routes", "VIEW_CONTEXT_KEY"]) {
      expect(stateSource).not.toMatch(new RegExp(`(?:const|let|class)\\s+${declaration}\\b`));
    }
  });

  it("locks the Sites cache-fix contract", () => {
    expect(scriptSources).toContain("frontend/pages/sites/site-profile.js?v=20260820-site-profile-v1");
    expect(scriptSources).toContain("frontend/pages/sites/charger-profile.js?v=20260820-charger-profile-v1");
    expect(scriptSources).toContain("frontend/pages/sites/site-visits.js?v=20260820-site-visits-lifecycle-v1");
    expect(scriptSources).toContain("frontend/pages/sites/sites-data.js?v=20260820-sites-data-refresh-v1");
    expect(scriptSources.some((source) => source.startsWith("js/sites-page.js?"))).toBe(false);
    expect(scriptSources).toContain("frontend/pages/sites/operational-records.js?v=20260820-operational-records-v1");
    expect(scriptSources).toContain("frontend/pages/sites/charger-lifecycle.js?v=20260820-charger-lifecycle-v1");
    expect(scriptSources).not.toContain("js/sites-page.js?v=20260818-sites-split-cache-fix-v1");
    expect(scriptSources).not.toContain("js/sites-page.js?v=20260818-fault-lifecycle-v1");
    expect(fs.existsSync(path.join(root, "js/sites-page.js"))).toBe(false);
    expect(productionDefinitionCount("removeCurrentCharger", localScripts)).toBe(0);
  });

  it("preserves external global callers after final Sites ownership moves", () => {
    const callers = {
      loadOperationalData: ["app.js", "js/auth-router.js", "frontend/shared/modals/modal-submit.js", "frontend/pages/settings/archive-page.js"],
      refreshOpenProfiles: ["frontend/shared/modals/modal-submit.js", "frontend/pages/sites/site-visits.js"],
      removeSiteVisitReportAttachment: ["app.js"],
    };
    for (const [name, files] of Object.entries(callers)) {
      expect(productionDefinitionCount(name), `${name} definition`).toBe(1);
      for (const file of files) expect(fs.readFileSync(path.join(root, file), "utf8"), `${file} calls ${name}`).toContain(`${name}(`);
    }
  });
});
