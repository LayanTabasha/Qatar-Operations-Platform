import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

const root = path.resolve(process.cwd(), "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const componentPath = "frontend/pages/homepage/visit-activity.js";
const homepagePath = "frontend/pages/homepage/home-page.js";

function runtime(state, initialMode = "status") {
  const selector = { value: initialMode };
  const target = { innerHTML: "" };
  const document = {
    getElementById(id) {
      if (id === "visit-activity-mode") return selector;
      if (id === "visit-activity-chart") return target;
      return null;
    },
  };
  const context = vm.createContext({ document, state });
  vm.runInContext(read("frontend/pages/homepage/home-shared.js"), context);
  vm.runInContext(read(componentPath), context, { filename: componentPath });
  return { context, selector, target };
}

describe("Homepage Site Visit Activity component", () => {
  it("renders unchanged status grouping and counts", () => {
    const { context, target } = runtime({
      sites: [],
      visits: [
        { status: "Scheduled" }, { status: "Scheduled" }, { status: "Completed" },
        { status: "Cancelled" }, { status: "Follow-Up Required" },
      ],
    });
    context.renderVisitActivityChart();
    expect(target.innerHTML).toContain('title="Scheduled: 2"');
    expect(target.innerHTML).toContain('title="Completed: 1"');
    expect(target.innerHTML).toContain('title="Cancelled: 1"');
    expect(target.innerHTML).toContain('title="Follow-Up Required: 1"');
  });

  it("switches to site grouping with the correct counts", () => {
    const { context, selector, target } = runtime({
      sites: [{ name: "Msheireb" }, { name: "Al Mana" }],
      visits: [{ siteName: "Msheireb" }, { siteName: "Msheireb" }, { siteName: "Al Mana" }],
    });
    context.renderVisitActivityChart();
    selector.value = "site";
    context.renderVisitActivityChart();
    expect(target.innerHTML).toContain('title="Msheireb: 2"');
    expect(target.innerHTML).toContain('title="Al Mana: 1"');
  });

  it("preserves the shared empty state", () => {
    const { context, target } = runtime({ sites: [], visits: [] });
    context.renderVisitActivityChart();
    expect(target.innerHTML).toContain("Add site visits to display this chart.");
    expect(target.innerHTML).toContain("Records entered in the platform will appear here automatically.");
  });

  it("loads after shared helpers and before the Homepage orchestrator", () => {
    const sources = Array.from(read("index.html").matchAll(/<script\s+src="([^"]+)"/g), (match) => match[1]);
    const sharedIndex = sources.indexOf("frontend/pages/homepage/home-shared.js?v=20260818-home-shared-v1");
    const componentIndex = sources.indexOf("frontend/pages/homepage/visit-activity.js?v=20260818-visit-activity-v1");
    const homepageIndex = sources.indexOf("frontend/pages/homepage/home-page.js?v=20260818-homepage-fault-status-v1");
    expect(componentIndex).toBeGreaterThan(sharedIndex);
    expect(homepageIndex).toBeGreaterThan(componentIndex);
    expect(read(homepagePath)).toContain("renderVisitActivityChart();");
  });

  it("has exactly one production implementation", () => {
    const definitions = [componentPath, homepagePath].flatMap((file) =>
      Array.from(read(file).matchAll(/function\s+renderVisitActivityChart\s*\(/g), () => file),
    );
    expect(definitions).toEqual([componentPath]);
  });
});
