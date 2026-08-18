import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

const root = path.resolve(process.cwd(), "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const componentPath = "frontend/pages/homepage/records-by-site.js";
const homepagePath = "frontend/pages/homepage/home-page.js";

function runtime(state, uploads = []) {
  const target = { innerHTML: "" };
  const document = {
    addEventListener() {},
    getElementById: (id) => id === "records-by-site-chart" ? target : null,
  };
  const context = vm.createContext({
    console,
    document,
    state,
    getValidUploads: () => uploads,
    valueOrPlaceholder: (value) => value ?? "Pending Data",
  });
  vm.runInContext(read("frontend/shared/utils/display-utils.js"), context);
  vm.runInContext(read("frontend/pages/homepage/home-shared.js"), context);
  vm.runInContext(read(componentPath), context, { filename: componentPath });
  return { context, target };
}

describe("Homepage Records by Site component", () => {
  it("renders charger, open fault, visit, and upload counts without changing labels", () => {
    const state = {
      sites: [{ name: "Msheireb", chargers: [{}, {}] }],
      faults: [
        { siteName: "Msheireb", status: "Open" },
        { siteName: "Msheireb", status: "In Progress" },
        { siteName: "Msheireb", status: "Resolved" },
        { siteName: "Other", status: "Open" },
      ],
      visits: [{ siteName: "Msheireb" }, { siteName: "Other" }],
    };
    const uploads = [{ siteName: "Msheireb" }, { siteName: "Msheireb" }, { siteName: "Other" }];
    const { context, target } = runtime(state, uploads);
    context.renderRecordsBySiteChart();
    expect(target.innerHTML).toContain("Msheireb");
    expect(target.innerHTML).toContain("Chargers <b>2</b>");
    expect(target.innerHTML).toContain("Open Faults <b>2</b>");
    expect(target.innerHTML).toContain("Visits <b>1</b>");
    expect(target.innerHTML).toContain("Uploads <b>2</b>");
  });

  it("retains the shared Homepage empty state", () => {
    const { context, target } = runtime({ sites: [], faults: [], visits: [] });
    context.renderRecordsBySiteChart();
    expect(target.innerHTML).toContain("No site records are available yet.");
    expect(target.innerHTML).toContain("Records entered in the platform will appear here automatically.");
  });

  it("loads before the orchestrator and remains callable from renderDashboardCharts", () => {
    const index = read("index.html");
    const sources = Array.from(index.matchAll(/<script\s+src="([^"]+)"/g), (match) => match[1]);
    const component = "frontend/pages/homepage/records-by-site.js?v=20260818-records-by-site-v1";
    const shared = "frontend/pages/homepage/home-shared.js?v=20260818-home-shared-v1";
    const homepage = "frontend/pages/homepage/home-page.js?v=20260818-home-shared-extraction-v1";
    expect(sources.indexOf(shared)).toBeGreaterThanOrEqual(0);
    expect(sources.indexOf(component)).toBeGreaterThanOrEqual(0);
    expect(sources.indexOf(shared)).toBeLessThan(sources.indexOf(component));
    expect(sources.indexOf(component)).toBeLessThan(sources.indexOf(homepage));

    const { context, target } = runtime({ sites: [], faults: [], visits: [], dashboardChargers: [] });
    expect(typeof context.renderRecordsBySiteChart).toBe("function");
    vm.runInContext(read(homepagePath), context, { filename: homepagePath });
    context.renderDashboardCharts();
    expect(target.innerHTML).toContain("No site records are available yet.");
  });

  it("has exactly one production implementation", () => {
    const definitions = [componentPath, homepagePath].flatMap((file) =>
      Array.from(read(file).matchAll(/function\s+renderRecordsBySiteChart\s*\(/g), () => file),
    );
    expect(definitions).toEqual([componentPath]);
    expect(read(homepagePath)).toContain("renderRecordsBySiteChart();");
  });
});
