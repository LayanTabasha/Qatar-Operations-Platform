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
    context.chartEmpty = () => "unused";
    context.renderRecordsBySiteChart();
    expect(target.innerHTML).toContain("Msheireb");
    expect(target.innerHTML).toContain("Chargers <b>2</b>");
    expect(target.innerHTML).toContain("Open Faults <b>2</b>");
    expect(target.innerHTML).toContain("Visits <b>1</b>");
    expect(target.innerHTML).toContain("Uploads <b>2</b>");
  });

  it("retains the shared Homepage empty state", () => {
    const { context, target } = runtime({ sites: [], faults: [], visits: [] });
    context.chartEmpty = (message) => `EMPTY:${message}`;
    context.renderRecordsBySiteChart();
    expect(target.innerHTML).toBe("EMPTY:No site records are available yet.");
  });

  it("loads before the orchestrator and remains callable from renderDashboardCharts", () => {
    const index = read("index.html");
    const sources = Array.from(index.matchAll(/<script\s+src="([^"]+)"/g), (match) => match[1]);
    const component = "frontend/pages/homepage/records-by-site.js?v=20260818-records-by-site-v1";
    const homepage = "frontend/pages/homepage/home-page.js?v=20260818-homepage-records-by-site-v1";
    expect(sources.indexOf(component)).toBeGreaterThanOrEqual(0);
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
