import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

const root = path.resolve(process.cwd(), "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const componentPath = "frontend/pages/homepage/fault-status.js";
const homepagePath = "frontend/pages/homepage/home-page.js";

function runtime(faults) {
  const target = { innerHTML: "" };
  const document = { getElementById: (id) => id === "fault-status-chart" ? target : null };
  const context = vm.createContext({ document, state: { faults } });
  vm.runInContext(read("frontend/pages/homepage/home-shared.js"), context);
  vm.runInContext(read(componentPath), context, { filename: componentPath });
  return { context, target };
}

describe("Homepage Fault Status component", () => {
  it("renders All Sites and individual Site counts for the approved lifecycle", () => {
    const { context, target } = runtime([
      { siteName: "Al Mana", status: "Open" },
      { siteName: "Al Mana", status: "In Progress" },
      { siteName: "Musheireb", status: "Resolved" },
    ]);
    context.renderFaultStatusChart();
    expect(target.innerHTML).toContain('aria-label="All Sites: Open 1, In Progress 1, Resolved 1"');
    expect(target.innerHTML).toContain('aria-label="Al Mana: Open 1, In Progress 1, Resolved 0"');
    expect(target.innerHTML).toContain('aria-label="Msheireb: Open 0, In Progress 0, Resolved 1"');
    expect(target.innerHTML).toContain('title="Open: 33%, In Progress: 33%, Resolved: 33%"');
  });

  it("keeps percentages, slice labels, colors, and legend unchanged", () => {
    const { context, target } = runtime([
      { siteName: "Al Mana", status: "Open" },
      { siteName: "Al Mana", status: "In Progress" },
    ]);
    context.renderFaultStatusChart();
    expect(context.faultPercentageSummary(["Open", "In Progress", "Resolved"], { Open: 1, "In Progress": 1, Resolved: 0 }, 2)).toBe("Open: 50%, In Progress: 50%");
    expect(target.innerHTML).toContain(">50%</span>");
    expect(target.innerHTML).toContain("background:#4f8dff");
    expect(target.innerHTML).toContain("background:#dca94b");
    expect(target.innerHTML).toContain("background:#37c985");
    expect(target.innerHTML).toContain("Open");
    expect(target.innerHTML).toContain("In Progress");
    expect(target.innerHTML).toContain("Resolved");
  });

  it("renders the unchanged per-site empty states and excludes Closed", () => {
    const { context, target } = runtime([]);
    context.renderFaultStatusChart();
    expect(target.innerHTML.match(/<span>No faults<\/span>/g)).toHaveLength(4);
    expect(target.innerHTML).not.toContain("Closed");
    expect(vm.runInContext("FAULT_STATUSES.map(({ label }) => label).join('|')", context)).toBe("Open|In Progress|Resolved");
    expect(read(componentPath)).not.toContain('label: "Closed"');
  });

  it("loads after shared helpers and before the Homepage orchestrator", () => {
    const sources = Array.from(read("index.html").matchAll(/<script\s+src="([^"]+)"/g), (match) => match[1]);
    const sharedIndex = sources.indexOf("frontend/pages/homepage/home-shared.js?v=20260818-home-shared-v1");
    const componentIndex = sources.indexOf("frontend/pages/homepage/fault-status.js?v=20260818-fault-status-v1");
    const homepageIndex = sources.indexOf("frontend/pages/homepage/home-page.js?v=20260818-homepage-fault-trend-v1");
    expect(componentIndex).toBeGreaterThan(sharedIndex);
    expect(homepageIndex).toBeGreaterThan(componentIndex);
    expect(read(homepagePath)).toContain("renderFaultStatusChart();");
  });

  it("keeps each Fault Status declaration in exactly one production file", () => {
    const names = ["FAULT_STATUSES", "FAULT_STATUS_COLORS", "renderFaultStatusChart", "faultPercentageSummary", "doughnutSliceLabels", "doughnutGradient"];
    const sources = [componentPath, homepagePath].map((file) => ({ file, source: read(file) }));
    for (const name of names) {
      const declaration = new RegExp(`(?:const|function)\\s+${name}\\b`, "g");
      const definitions = sources.flatMap(({ file, source }) => Array.from(source.matchAll(declaration), () => file));
      expect(definitions, `${name} must have one production owner`).toEqual([componentPath]);
    }
  });
});
