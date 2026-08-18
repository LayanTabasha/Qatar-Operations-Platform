import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

const root = path.resolve(process.cwd(), "..");
const sharedPath = "frontend/pages/sites/sites-shared.js";
const shared = fs.readFileSync(path.join(root, sharedPath), "utf8");
const sites = fs.readFileSync(path.join(root, "js/sites-page.js"), "utf8");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");

function runtime(overrides = {}) {
  const state = { currentSiteName: "", currentChargerId: "", visits: [], ...overrides.state };
  const context = vm.createContext({
    state,
    getRecordDate: (record) => record.visitDate || record.createdAt,
    formatDate: (value) => `formatted:${value}`,
    safeDetailValue: (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"),
    ...overrides,
  });
  vm.runInContext(shared, context, { filename: sharedPath });
  return context;
}

describe("shared Sites helpers", () => {
  it("preserves normalized partial and case-insensitive filtering", () => {
    const context = runtime();
    expect(context.normalizedFilterText("  Al MANA ")).toBe("al mana");
    expect(context.includesFilterText(["Mowasalat Depot", "Doha"], "SALAT dep")).toBe(true);
    expect(context.includesFilterText(["Mowasalat Depot"], "missing")).toBe(false);
    expect(context.includesFilterText(["anything"], "  ")).toBe(true);
  });

  it("sorts unique options case-insensitively and safely renders selection", () => {
    const context = runtime();
    expect(context.uniqueFilterOptions(["DC 10", "ac 2", "AC 2", "DC 2", ""])).toEqual(["AC 2", "DC 2", "DC 10"]);
    expect(context.filterOption('<AC & "One">', '<AC & "One">')).toBe('<option value="&lt;AC &amp; &quot;One&quot;&gt;" selected>&lt;AC &amp; &quot;One&quot;&gt;</option>');
  });

  it("persists filters independently by Site, Charger, and module in one Map", () => {
    const context = runtime({ state: { currentSiteName: "Al Mana", currentChargerId: "" } });
    const siteDocuments = context.moduleFilters("Documents");
    siteDocuments.search = "manual";
    expect(context.moduleFilterKey("Documents")).toBe("Al Mana::all-chargers::Documents");
    expect(context.moduleFilters("Documents")).toBe(siteDocuments);

    context.state.currentChargerId = "charger-1";
    const chargerDocuments = context.moduleFilters("Documents");
    chargerDocuments.search = "warranty";
    expect(context.moduleFilterKey("Documents")).toBe("Al Mana::charger-1::Documents");
    expect(chargerDocuments).not.toBe(siteDocuments);

    const chargerFaults = context.moduleFilters("Faults");
    expect(chargerFaults).not.toBe(chargerDocuments);
    context.state.currentChargerId = "";
    expect(context.moduleFilters("Documents").search).toBe("manual");
    expect(vm.runInContext("operationalRecordFilters.size", context)).toBe(3);
  });

  it("retains latest-visit calculation, upload kinds, and file icons", () => {
    const context = runtime({ state: { visits: [
      { siteName: "Msheireb", visitDate: "2026-08-01" },
      { siteName: "Msheireb", visitDate: "2026-08-18" },
      { siteName: "Al Mana", visitDate: "2026-08-20" },
    ] } });
    expect(context.latestVisitForSite("Msheireb")).toBe("formatted:2026-08-18");
    expect(context.latestVisitForSite("Mowasalat")).toBe("Not Available Yet");
    expect(context.uploadKindForTitle("Site Visits")).toEqual(["siteVisit", "visitReport"]);
    expect(context.uploadKindForTitle("Faults")).toEqual(["fault"]);
    expect(context.uploadKindForTitle("Documents")).toEqual(["document"]);
    expect(context.uploadKindForTitle("Weekly Reports")).toEqual(["weeklyReport"]);
    expect(context.uploadKindForTitle("Troubleshooting")).toEqual(["guide"]);
    for (const icon of ["download", "edit", "delete", "preview"]) expect(context.fileIcon(icon)).toContain("<svg");
  });

  it("loads after mapper/display dependencies and before Sites", () => {
    const sources = Array.from(index.matchAll(/<script\s+src="([^"]+)"/g), (match) => match[1].split("?")[0]);
    const sharedIndex = sources.indexOf(sharedPath);
    expect(sharedIndex).toBeGreaterThan(sources.indexOf("js/state.js"));
    expect(sharedIndex).toBeGreaterThan(sources.indexOf("frontend/shared/utils/display-utils.js"));
    expect(sharedIndex).toBeGreaterThan(sources.indexOf("frontend/pages/sites/sites-data-mappers.js"));
    expect(sharedIndex).toBeLessThan(sources.indexOf("js/sites-page.js"));
  });

  it("keeps one helper definition and one persistent filter store", () => {
    const production = `${shared}\n${sites}`;
    for (const name of ["normalizedFilterText", "includesFilterText", "latestVisitForSite", "uniqueFilterOptions", "filterOption", "uploadKindForTitle", "fileIcon", "moduleFilterKey", "moduleFilters"]) {
      expect(production.match(new RegExp(`function ${name}\\s*\\(`, "g")) || [], name).toHaveLength(1);
      expect(shared).toMatch(new RegExp(`function ${name}\\s*\\(`));
      expect(sites).not.toMatch(new RegExp(`function ${name}\\s*\\(`));
    }
    expect(production.match(/const operationalRecordFilters\s*=\s*new Map\(\)/g) || []).toHaveLength(1);
    expect(sites).toContain('const siteListFilters = { search: "", status: "" };');
  });
});
