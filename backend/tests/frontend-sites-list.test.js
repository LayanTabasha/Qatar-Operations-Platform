import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

const root = path.resolve(process.cwd(), "..");
const sharedPath = "frontend/pages/sites/sites-shared.js";
const listPath = "frontend/pages/sites/sites-list.js";
const shared = fs.readFileSync(path.join(root, sharedPath), "utf8");
const list = fs.readFileSync(path.join(root, listPath), "utf8");
const sitesPage = fs.readFileSync(path.join(root, "frontend/pages/sites/sites-data.js"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");

function runtime({ admin = true, sites, backendLoading = false, backendError = "" } = {}) {
  const dom = new JSDOM(`<!doctype html><html><body><section id="sites"><div class="site-header-tools"><input type="search"><select></select></div><button id="add-site-button"></button><div id="site-list"></div></section></body></html>`, { runScripts: "outside-only" });
  const context = dom.getInternalVMContext();
  const listeners = { input: 0, change: 0 };
  const addEventListener = context.document.addEventListener.bind(context.document);
  context.document.addEventListener = (type, handler, options) => {
    if (type in listeners) listeners[type] += 1;
    return addEventListener(type, handler, options);
  };
  context.state = {
    backendLoading,
    backendError,
    faults: [{ siteName: "Al Mana", status: "Open" }],
    visits: [{ siteName: "Al Mana", visitDate: "2026-08-17" }],
    currentSiteName: "",
    currentChargerId: "",
    sites: sites ?? [
      { id: "1", name: "Al Mana", code: "AM", location: "Doha", status: "Active", chargers: [{}, {}] },
      { id: "2", name: "Mowasalat", code: "MW", location: "Depot", status: "Under Maintenance", chargers: [{}] },
      { id: "3", name: "Msheireb", code: "MS", location: "Central", status: "Active", chargers: [] },
      { id: "4", name: "Inactive Depot", code: "ID", location: "Depot", status: "Inactive", chargers: [] },
    ],
  };
  context.getRecordDate = (record) => record.visitDate || record.createdAt;
  context.formatDate = (value) => value || "--";
  context.safeDetailValue = (value) => String(value ?? "");
  context.imageBlock = () => '<div class="image"></div>';
  context.placeholder = (label, value = "") => `<span>${label}:${value}</span>`;
  context.valueOrPlaceholder = (value) => value || "Not Available Yet";
  context.isAdmin = () => admin;
  context.formatSettingValue = (value) => String(value ?? "");
  vm.runInContext(shared, context, { filename: sharedPath });
  vm.runInContext(list, context, { filename: listPath });
  return { context, document: context.document, listeners };
}

describe("Main Sites list component", () => {
  it("renders all current Sites with counts, actions, and role visibility", () => {
    const admin = runtime();
    admin.context.buildSites();
    const html = admin.document.getElementById("site-list").innerHTML;
    for (const site of ["Al Mana", "Mowasalat", "Msheireb", "Inactive Depot"]) expect(html).toContain(site);
    expect(html).toContain("site-status-active");
    expect(html).toContain("site-status-inactive");
    expect(html).toContain("site-status-under-maintenance");
    expect(html).toContain("Number of Chargers:2");
    expect(html).toContain("Open Faults:1");
    expect(html).toContain("Edit");
    expect(html).toContain("Archive");
    expect(admin.document.getElementById("add-site-button").classList.contains("hidden")).toBe(false);

    const viewer = runtime({ admin: false });
    viewer.context.buildSites();
    expect(viewer.document.getElementById("site-list").innerHTML).not.toContain("data-mode=\"edit\"");
    expect(viewer.document.getElementById("site-list").innerHTML).not.toContain("data-archive-active");
    expect(viewer.document.getElementById("add-site-button").classList.contains("hidden")).toBe(true);
  });

  it("preserves partial/case-insensitive search, combined status, clearing, and refresh", () => {
    const { context, document } = runtime();
    const search = document.querySelector('input[type="search"]');
    const status = document.querySelector("select");
    context.buildSites();
    search.value = "MANA";
    search.dispatchEvent(new context.Event("input", { bubbles: true }));
    expect(document.getElementById("site-list").textContent).toContain("Al Mana");
    expect(document.getElementById("site-list").textContent).not.toContain("Mowasalat");

    status.value = "Under Maintenance";
    status.dispatchEvent(new context.Event("change", { bubbles: true }));
    expect(document.getElementById("site-list").textContent).toContain("No sites match the selected filters");
    search.value = "";
    search.dispatchEvent(new context.Event("input", { bubbles: true }));
    expect(document.getElementById("site-list").textContent).toContain("Mowasalat");

    context.state.sites.push({ id: "5", name: "West Depot", status: "Under Maintenance", chargers: [] });
    context.buildSites();
    expect(document.getElementById("site-list").textContent).toContain("West Depot");
    expect(search.value).toBe("");
    expect(status.value).toBe("Under Maintenance");
    status.value = "";
    status.dispatchEvent(new context.Event("change", { bubbles: true }));
    for (const site of ["Al Mana", "Mowasalat", "Msheireb", "Inactive Depot", "West Depot"]) expect(document.getElementById("site-list").textContent).toContain(site);
  });

  it("preserves loading, API error, empty, and no-match states", () => {
    const loading = runtime({ backendLoading: true });
    loading.context.buildSites();
    expect(loading.document.getElementById("site-list").textContent).toContain("Loading sites");

    const error = runtime({ backendError: "Backend unavailable" });
    error.context.buildSites();
    expect(error.document.getElementById("site-list").textContent).toContain("Could not load sites");
    expect(error.document.getElementById("site-list").textContent).toContain("Backend unavailable");

    const empty = runtime({ sites: [] });
    empty.context.buildSites();
    expect(empty.document.getElementById("site-list").textContent).toContain("No sites found");

    const noMatch = runtime();
    noMatch.context.buildSites();
    const search = noMatch.document.querySelector('input[type="search"]');
    search.value = "absent site";
    search.dispatchEvent(new noMatch.context.Event("input", { bubbles: true }));
    expect(noMatch.document.getElementById("site-list").textContent).toContain("No sites match the selected filters");
  });

  it("registers one guarded listener pair and keeps one persistent filter object", () => {
    const { context, listeners } = runtime();
    expect(listeners).toEqual({ input: 1, change: 1 });
    context.bindSitesFilters();
    context.bindSitesFilters();
    expect(listeners).toEqual({ input: 1, change: 1 });
    expect(vm.runInContext("siteListFilters", context)).toEqual({ search: "", status: "" });
  });

  it("loads before Sites orchestration and preserves every external buildSites caller", () => {
    const sources = Array.from(index.matchAll(/<script\s+src="([^"]+)"/g), (match) => match[1].split("?")[0]);
    const listIndex = sources.indexOf(listPath);
    expect(listIndex).toBeGreaterThan(sources.indexOf("frontend/pages/sites/sites-shared.js"));
    expect(listIndex).toBeLessThan(sources.indexOf("frontend/pages/sites/sites-data.js"));
    expect(listIndex).toBeLessThan(sources.indexOf("app.js"));
    expect(app).toMatch(/\bbuildSites\s*\(/);
    expect(sitesPage.match(/\bbuildSites\s*\(/g) || []).toHaveLength(3);
  });

  it("keeps one list state, implementation, and immediate binding call", () => {
    const production = `${list}\n${sitesPage}`;
    expect(production.match(/const siteListFilters\s*=\s*\{ search: "", status: "" \}/g) || []).toHaveLength(1);
    expect(production.match(/function buildSites\s*\(/g) || []).toHaveLength(1);
    expect(production.match(/function bindSitesFilters\s*\(/g) || []).toHaveLength(1);
    expect(production.match(/^bindSitesFilters\(\);$/gm) || []).toHaveLength(1);
  });
});
