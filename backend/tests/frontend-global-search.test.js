import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

const root = path.resolve(process.cwd(), "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const componentPath = "frontend/pages/homepage/global-search.js";
const homepagePath = "frontend/pages/homepage/home-page.js";

function runtime() {
  const dom = new JSDOM('<!doctype html><main id="home"><div class="hero-row"></div><input id="global-search"></main>', { runScripts: "outside-only" });
  const listeners = { input: [], click: [] };
  const originalAddEventListener = dom.window.document.addEventListener.bind(dom.window.document);
  dom.window.document.addEventListener = (type, handler, options) => {
    if (listeners[type]) listeners[type].push(handler);
    return originalAddEventListener(type, handler, options);
  };
  const calls = [];
  const context = dom.getInternalVMContext();
  const run = (source, filename = "runtime.js") => vm.runInContext(source, context, { filename });
  run(`
    const state = {
      sites: [{ name: "Al Mana Central", code: "AMC", location: "Doha", description: "Main depot", chargers: [{ id: "charger-1", name: "DC Alpha", code: "DCA", serialNumber: "SN-100", manufacturer: "Zeeda", model: "Z1" }] }],
      faults: [{ faultId: "FLT-100", faultCode: "P100", faultName: "Cooling Fault", description: "Cooling issue", siteName: "Al Mana Central", chargerName: "DC Alpha" }],
      visits: [{ purpose: "Quarterly Inspection", notes: "Inspect cooling", siteName: "Al Mana Central", chargerName: "DC Alpha", createdBy: "Operator" }],
    };
    function getValidUploads() { return [
      { kind: "document", title: "Commissioning Manual", name: "manual.pdf", siteName: "Al Mana Central" },
      { kind: "weeklyReport", title: "Weekly Summary", siteName: "Al Mana Central" },
      { kind: "guide", title: "Cooling Guide", siteName: "Al Mana Central" },
    ]; }
    function valueOrPlaceholder(value) { return value || "Not Available Yet"; }
  `);
  run(read("frontend/shared/utils/display-utils.js"), "display-utils.js");
  context.setRoute = (route) => calls.push(["route", route]);
  context.openSite = (...args) => calls.push(["site", ...args]);
  context.openCharger = (...args) => calls.push(["charger", ...args]);
  run(read(componentPath), componentPath);
  return { calls, context, dom, listeners };
}

describe("Homepage Global Search component", () => {
  it("preserves partial, case-insensitive matching across every record type", () => {
    const { context } = runtime();
    expect(context.globalSearchRecords("mAnA").some((item) => item.type === "Site")).toBe(true);
    expect(context.globalSearchRecords("alpha").some((item) => item.type === "Charger")).toBe(true);
    expect(context.globalSearchRecords("p100").map((item) => item.type)).toContain("Fault");
    expect(context.globalSearchRecords("quarter").map((item) => item.type)).toContain("Site Visit");
    expect(context.globalSearchRecords("manual").map((item) => item.type)).toContain("Document");
    expect(context.globalSearchRecords("weekly").map((item) => item.type)).toContain("Weekly Report");
    expect(context.globalSearchRecords("guide").map((item) => item.type)).toContain("Troubleshootin");
  });

  it("preserves no-match and clearing behavior", () => {
    const { context, dom } = runtime();
    const input = dom.window.document.getElementById("global-search");
    input.value = "does-not-exist";
    input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    const results = dom.window.document.getElementById("global-search-results");
    expect(results.innerHTML).toContain("No matching records");
    input.value = "";
    input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    expect(results.innerHTML).toBe("");
    expect(results.classList.contains("hidden")).toBe(true);
    context.renderGlobalSearchResults("mana");
    expect(results.innerHTML).toContain("Search Results");
  });

  it("preserves Site, Charger, Fault, Visit, and document navigation", () => {
    const { calls, context, dom } = runtime();
    const results = () => dom.window.document.getElementById("global-search-results");
    const clickFirst = () => results().querySelector("[data-global-result]").click();

    context.renderGlobalSearchResults("main depot"); clickFirst();
    expect(calls.splice(0)).toEqual([["route", "sites"], ["site", "Al Mana Central", "Overview"]]);
    context.renderGlobalSearchResults("SN-100"); clickFirst();
    expect(calls.splice(0)).toEqual([["route", "sites"], ["charger", "Al Mana Central", "charger-1"]]);
    context.renderGlobalSearchResults("P100"); clickFirst();
    expect(calls.splice(0)).toEqual([["route", "sites"], ["site", "Al Mana Central", "Faults"]]);
    context.renderGlobalSearchResults("Quarterly"); clickFirst();
    expect(calls.splice(0)).toEqual([["route", "sites"], ["site", "Al Mana Central", "Site Visits"]]);
    context.renderGlobalSearchResults("Commissioning"); clickFirst();
    expect(calls.splice(0)).toEqual([["route", "sites"], ["site", "Al Mana Central", "Documents"]]);
  });

  it("registers each delegated listener once and never during rendering", () => {
    const { context, listeners } = runtime();
    expect(listeners.input).toHaveLength(1);
    expect(listeners.click).toHaveLength(1);
    context.renderGlobalSearchResults("mana");
    context.renderGlobalSearchResults("manual");
    context.renderGlobalSearchResults("");
    expect(listeners.input).toHaveLength(1);
    expect(listeners.click).toHaveLength(1);
  });

  it("loads before the orchestrator and keeps its renderCounts call", () => {
    const sources = Array.from(read("index.html").matchAll(/<script\s+src="([^"]+)"/g), (match) => match[1]);
    const componentIndex = sources.indexOf("frontend/pages/homepage/global-search.js?v=20260818-global-search-v1");
    expect(componentIndex).toBeGreaterThan(sources.indexOf("js/state.js?v=20260825-fault-visit-links-v2"));
    expect(componentIndex).toBeGreaterThan(sources.indexOf("js/auth-router.js?v=20260830-platform-health-alert-v1"));
    expect(componentIndex).toBeGreaterThan(sources.indexOf("frontend/shared/utils/display-utils.js?v=20260818-display-utils-v2"));
    expect(sources.indexOf("frontend/pages/homepage/home-page.js?v=20260818-homepage-kpi-orchestrator-v1")).toBeGreaterThan(componentIndex);
    expect(read(homepagePath)).toContain("renderGlobalSearchResults(globalSearch.value)");
  });

  it("keeps both functions and the listener block in exactly one production file", () => {
    const sources = [componentPath, homepagePath].map((file) => ({ file, source: read(file) }));
    for (const name of ["globalSearchRecords", "renderGlobalSearchResults"]) {
      const definitions = sources.flatMap(({ file, source }) =>
        Array.from(source.matchAll(new RegExp(`function\\s+${name}\\s*\\(`, "g")), () => file),
      );
      expect(definitions).toEqual([componentPath]);
    }
    expect(read(componentPath).match(/document\.addEventListener\("input"/g)).toHaveLength(1);
    expect(read(componentPath).match(/document\.addEventListener\("click"/g)).toHaveLength(1);
    expect(read(homepagePath)).not.toContain("data-global-result");
  });
});
