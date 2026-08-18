import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

const root = path.resolve(process.cwd(), "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const sharedPath = "frontend/pages/homepage/home-shared.js";
const homepagePath = "frontend/pages/homepage/home-page.js";
const recordsPath = "frontend/pages/homepage/records-by-site.js";
const movedNames = [
  "DASHBOARD_COLORS", "DASHBOARD_SITES", "groupCount", "chartEmpty", "renderBarList",
  "recordsForDashboardSite", "sharedLegend", "statusSummary",
];

function contextWithContainers() {
  const containers = new Map();
  const document = { getElementById: (id) => containers.get(id) || null };
  const context = vm.createContext({ document });
  vm.runInContext(read(sharedPath), context, { filename: sharedPath });
  return { context, containers };
}

describe("shared Homepage helpers", () => {
  it("preserves shared constants, grouping, filtering, legends, and summaries", () => {
    const { context } = contextWithContainers();
    expect(vm.runInContext("DASHBOARD_COLORS.length", context)).toBe(6);
    expect(vm.runInContext("DASHBOARD_SITES.map((site) => site.label).join('|')", context)).toBe("All Sites|Al Mana|Mowasalat|Msheireb");
    expect(JSON.parse(JSON.stringify(context.groupCount([{ status: "Open" }, { status: "Open" }, { status: "Resolved" }], ["Open", "Resolved"], (item) => item.status)))).toEqual({ Open: 2, Resolved: 1 });
    expect(context.recordsForDashboardSite([{ siteName: "Musheireb" }, { siteName: "Al Mana" }], { aliases: ["Msheireb", "Musheireb"] })).toHaveLength(1);
    expect(context.statusSummary(["Open", "Resolved"], { Open: 2, Resolved: 1 })).toBe("Open 2, Resolved 1");
    expect(context.sharedLegend(["Open"], { Open: "#fff" }, { Open: 2 })).toContain("Open 2");
  });

  it("preserves bar rendering and shared empty-state behavior", () => {
    const { context, containers } = contextWithContainers();
    const target = { innerHTML: "" };
    containers.set("chart", target);
    context.renderBarList("chart", [{ label: "Open", value: 2 }, { label: "Resolved", value: 1 }], "No data");
    expect(target.innerHTML).toContain('title="Open: 2"');
    expect(target.innerHTML).toContain("width:67%");
    context.renderBarList("chart", [], "No data");
    expect(target.innerHTML).toBe(context.chartEmpty("No data"));
  });

  it("loads before Records by Site and the Homepage orchestrator", () => {
    const sources = Array.from(read("index.html").matchAll(/<script\s+src="([^"]+)"/g), (match) => match[1]);
    const sharedIndex = sources.indexOf("frontend/pages/homepage/home-shared.js?v=20260818-home-shared-v1");
    const recordsIndex = sources.indexOf("frontend/pages/homepage/records-by-site.js?v=20260818-records-by-site-v1");
    const homepageIndex = sources.indexOf("frontend/pages/homepage/home-page.js?v=20260818-homepage-global-search-v1");
    expect(sharedIndex).toBeGreaterThanOrEqual(0);
    expect(recordsIndex).toBeGreaterThan(sharedIndex);
    expect(homepageIndex).toBeGreaterThan(recordsIndex);
  });

  it("keeps every moved declaration in exactly one production file", () => {
    const sources = [sharedPath, recordsPath, homepagePath].map((file) => ({ file, source: read(file) }));
    for (const name of movedNames) {
      const declaration = new RegExp(`(?:const|function)\\s+${name}\\b`, "g");
      const definitions = sources.flatMap(({ file, source }) => Array.from(source.matchAll(declaration), () => file));
      expect(definitions, `${name} must have one production owner`).toEqual([sharedPath]);
    }
  });
});
