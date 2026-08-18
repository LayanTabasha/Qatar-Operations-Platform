import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

const root = path.resolve(process.cwd(), "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const componentPath = "frontend/pages/homepage/charger-status.js";
const homepagePath = "frontend/pages/homepage/home-page.js";

function runtime(dashboardChargers = [], sites = []) {
  const target = { innerHTML: "" };
  const document = { getElementById: (id) => id === "charger-status-chart" ? target : null };
  const context = vm.createContext({ document, state: { dashboardChargers, sites } });
  vm.runInContext(read("frontend/pages/homepage/home-shared.js"), context);
  vm.runInContext(read(componentPath), context, { filename: componentPath });
  return { context, target };
}

describe("Homepage Charger Status Distribution component", () => {
  it("renders All Sites and individual Site counts with unchanged colors and legend", () => {
    const { context, target } = runtime([
      { siteName: "Al Mana", status: "Available" },
      { siteName: "Al Mana", status: "Critical" },
      { siteName: "Musheireb", status: "Under Maintenance" },
      { siteName: "Al Mana", status: "Active", backendStatus: "archived" },
    ]);
    context.renderChargerStatusChart();
    expect(target.innerHTML).toContain('aria-label="All Sites: Active 1, Maintenance 1, Faulted 1"');
    expect(target.innerHTML).toContain('aria-label="Al Mana: Active 1, Maintenance 0, Faulted 1"');
    expect(target.innerHTML).toContain('aria-label="Msheireb: Active 0, Maintenance 1, Faulted 0"');
    expect(target.innerHTML).toContain("background:#37c985");
    expect(target.innerHTML).toContain("background:#dca94b");
    expect(target.innerHTML).toContain("background:#ef6262");
  });

  it("preserves every existing status normalization", () => {
    const { context } = runtime();
    expect(context.normalizeChargerStatus("Available")).toBe("Active");
    expect(context.normalizeChargerStatus("Operational")).toBe("Active");
    expect(context.normalizeChargerStatus("Critical")).toBe("Faulted");
    expect(context.normalizeChargerStatus("Warning")).toBe("Maintenance");
    expect(context.normalizeChargerStatus("Under Maintenance")).toBe("Maintenance");
    expect(context.normalizeChargerStatus("Pending Data")).toBe("Inactive");
    expect(context.normalizeChargerStatus("")).toBe("Inactive");
    expect(context.normalizeChargerStatus("Active")).toBe("Active");
  });

  it("retains the nested-site fallback and per-site empty states", () => {
    const nested = [{ name: "Mowasalat", chargers: [{ status: "Operational" }, { status: "Warning" }] }];
    const { context, target } = runtime([], nested);
    context.renderChargerStatusChart();
    expect(target.innerHTML).toContain('aria-label="All Sites: Active 1, Maintenance 1, Faulted 0"');
    expect(target.innerHTML).toContain('aria-label="Mowasalat: Active 1, Maintenance 1, Faulted 0"');

    const empty = runtime();
    empty.context.renderChargerStatusChart();
    expect(empty.target.innerHTML.match(/<span>No chargers<\/span>/g)).toHaveLength(4);
  });

  it("loads after shared helpers and before the Homepage orchestrator", () => {
    const sources = Array.from(read("index.html").matchAll(/<script\s+src="([^"]+)"/g), (match) => match[1]);
    const sharedIndex = sources.indexOf("frontend/pages/homepage/home-shared.js?v=20260818-home-shared-v1");
    const componentIndex = sources.indexOf("frontend/pages/homepage/charger-status.js?v=20260818-charger-status-v1");
    const homepageIndex = sources.indexOf("frontend/pages/homepage/home-page.js?v=20260818-homepage-fault-trend-v1");
    expect(componentIndex).toBeGreaterThan(sharedIndex);
    expect(homepageIndex).toBeGreaterThan(componentIndex);
    expect(read(homepagePath)).toContain("renderChargerStatusChart();");
  });

  it("keeps every Charger Status declaration in exactly one production file", () => {
    const names = ["CHARGER_STATUSES", "CHARGER_STATUS_COLORS", "renderChargerStatusChart", "normalizeChargerStatus"];
    const sources = [componentPath, homepagePath].map((file) => ({ file, source: read(file) }));
    for (const name of names) {
      const declaration = new RegExp(`(?:const|function)\\s+${name}\\b`, "g");
      const definitions = sources.flatMap(({ file, source }) => Array.from(source.matchAll(declaration), () => file));
      expect(definitions, `${name} must have one production owner`).toEqual([componentPath]);
    }
  });
});
