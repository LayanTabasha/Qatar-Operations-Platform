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
      "frontend/pages/sites/operational-records.js", "frontend/pages/sites/charger-lifecycle.js", "js/sites-page.js",
      "frontend/pages/contacts/contacts-page.js", "js/requests-page.js", "js/modals.js",
      "frontend/shared/files/file-preview.js", "frontend/pages/settings/archive-page.js",
      "js/settings-page.js", "app.js",
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
    for (const declaration of ["siteListFilters", "operationalRecordFilters", "faultTrendChartInstance"]) {
      const definitions = production.match(new RegExp(`(?:const|let|class)\\s+${declaration}\\b`, "g")) || [];
      expect(definitions, declaration).toHaveLength(1);
    }
    expect((production.match(/dataset\.sitesFiltersBound\s*=\s*"true"/g) || [])).toHaveLength(1);
    expect((production.match(/event\.target\.id === "global-search"/g) || [])).toHaveLength(1);
    expect((production.match(/event\.target\.closest\("\[data-global-result\]"\)/g) || [])).toHaveLength(1);
    for (const name of [
      "baseFilesForTitle", "filteredFiles", "fileRows", "fileActionButtons", "contentRecord",
      "contentTypeLabel", "openContentRecordDetail", "openContentDeleteConfirmation",
      "openLegacyContentDeleteConfirmation", "openOperationalDeleteConfirmation", "moduleFilterControls",
      "moduleTableBody", "recordsModule", "updateOperationalRecordResults", "restoreArchivedCharger",
      "permanentlyDeleteArchivedCharger",
    ]) {
      expect(production.match(new RegExp(`(?:async\\s+)?function\\s+${name}\\(`, "g")) || [], name).toHaveLength(1);
    }
  });

  it("locks the Sites cache-fix contract", () => {
    expect(scriptSources).toContain("js/sites-page.js?v=20260820-operational-records-split-v1");
    expect(scriptSources).toContain("frontend/pages/sites/operational-records.js?v=20260820-operational-records-v1");
    expect(scriptSources).toContain("frontend/pages/sites/charger-lifecycle.js?v=20260820-charger-lifecycle-v1");
    expect(scriptSources).not.toContain("js/sites-page.js?v=20260818-sites-split-cache-fix-v1");
    expect(scriptSources).not.toContain("js/sites-page.js?v=20260818-fault-lifecycle-v1");
    expect(fs.readFileSync(path.join(root, "js/sites-page.js"), "utf8")).not.toMatch(/(?:const|let|class)\s+siteListFilters\b/);
  });
});
