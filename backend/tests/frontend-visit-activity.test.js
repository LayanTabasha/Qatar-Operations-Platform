import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

const root = path.resolve(process.cwd(), "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const componentPath = "frontend/pages/homepage/visit-activity.js";
const homepagePath = "frontend/pages/homepage/home-page.js";

function runtime(state) {
  const target = { innerHTML: "" };
  const document = {
    getElementById(id) {
      if (id === "visit-activity-chart") return target;
      return null;
    },
  };
  const context = vm.createContext({ document, state });
  vm.runInContext(read("frontend/pages/homepage/home-shared.js"), context);
  vm.runInContext(read(componentPath), context, { filename: componentPath });
  return { context, target };
}

describe("Homepage Site Visit Activity component", () => {
  it("offers exactly the three operational Site Visit statuses", () => {
    const configs = read("frontend/shared/modals/modal-configs.js");
    expect(configs).toContain("select:Scheduled,Completed,Follow-Up Required");
    expect(configs).not.toContain("Cancelled");
    expect(configs).not.toContain("Ongoing");
  });

  it("removes the view dropdown and renders exactly one combined chart", () => {
    const index = read("index.html");
    expect(index).not.toContain("visit-activity-mode");
    expect(index.match(/id="visit-activity-chart"/g)).toHaveLength(1);
    expect(read("app.js")).not.toContain("visit-activity-mode");
  });

  it("renders All Sites and one row for each normal dashboard site with correct totals", () => {
    const { context, target } = runtime({
      sites: [],
      visits: [
        { siteName: "Al Mana", status: "Scheduled" },
        { siteName: "Mowasalat", status: "Completed" },
        { siteName: "Mowasalat", status: "Scheduled" },
        { siteName: "Msheireb", status: "Follow-Up Required" },
      ],
    });
    context.renderVisitActivityChart();
    expect(target.innerHTML.match(/class="bar-row visit-activity-row"/g)).toHaveLength(4);
    expect(target.innerHTML).toContain('title="All Sites: 4.');
    expect(target.innerHTML).toContain('title="Al Mana: 1.');
    expect(target.innerHTML).toContain('title="Mowasalat: 2.');
    expect(target.innerHTML).toContain('title="Msheireb: 1.');
  });

  it("uses status colors for proportional stacked segments", () => {
    const { context, target } = runtime({
      sites: [],
      visits: [
        { siteName: "Mowasalat", status: "Scheduled" },
        { siteName: "Mowasalat", status: "Completed" },
        { siteName: "Mowasalat", status: "Completed" },
        { siteName: "Mowasalat", status: "Follow-Up Required" },
      ],
    });
    context.renderVisitActivityChart();
    const mowasalat = target.innerHTML.match(/title="Mowasalat: 4\.[\s\S]*?<strong>4<\/strong>/)[0];
    expect(mowasalat).toContain('data-visit-status="Scheduled" title="Scheduled: 1" style="width:25%; background:#73d7ff"');
    expect(mowasalat).toContain('data-visit-status="Completed" title="Completed: 2" style="width:50%; background:#4f8dff"');
    expect(mowasalat).not.toContain('data-visit-status="Cancelled"');
    expect(mowasalat).toContain('data-visit-status="Follow-Up Required" title="Follow-Up Required: 1" style="width:25%; background:#dca94b"');
  });

  it("renders a zero-visit site as an empty track with a zero total", () => {
    const { context, target } = runtime({ sites: [], visits: [] });
    context.renderVisitActivityChart();
    const alMana = target.innerHTML.match(/title="Al Mana: 0\.[\s\S]*?<strong>0<\/strong>/)[0];
    expect(alMana).toContain('class="bar-track visit-activity-track"');
    expect(alMana).not.toContain("data-visit-status");
  });

  it("renders exactly three legend statuses and excludes removed statuses from totals", () => {
    const { context, target } = runtime({ sites: [], visits: [{ siteName: "Al Mana", status: "Cancelled" }] });
    context.renderVisitActivityChart();
    const legend = target.innerHTML.match(/<div class="shared-chart-legend"[\s\S]*?<\/div>/)[0];
    expect(legend.match(/<span>/g)).toHaveLength(3);
    expect(legend).toContain('background:#73d7ff"></i>Scheduled');
    expect(legend).toContain('background:#4f8dff"></i>Completed');
    expect(legend).toContain('background:#dca94b"></i>Follow-Up Required');
    expect(legend).not.toContain("Cancelled");
    expect(target.innerHTML).not.toContain('data-visit-status="Cancelled"');
    expect(target.innerHTML).toContain('title="All Sites: 0.');
    expect(target.innerHTML).toContain('title="Al Mana: 0.');
  });

  it("does not modify visit records and retains the shared mobile row layout", () => {
    const visits = Object.freeze([Object.freeze({ siteName: "Al Mana", status: "Scheduled" })]);
    const { context } = runtime({ sites: [], visits });
    expect(() => context.renderVisitActivityChart()).not.toThrow();
    expect(visits[0]).toEqual({ siteName: "Al Mana", status: "Scheduled" });
    const styles = read("styles.css");
    expect(styles).toContain("@media (max-width: 780px)");
    expect(styles).toContain(".bar-row { grid-template-columns: 1fr 42px; }");
    expect(styles).toContain(".bar-track { grid-column: 1 / -1; grid-row: 2; }");
  });

  it("loads after shared helpers and before the Homepage orchestrator", () => {
    const sources = Array.from(read("index.html").matchAll(/<script\s+src="([^"]+)"/g), (match) => match[1]);
    const sharedIndex = sources.indexOf("frontend/pages/homepage/home-shared.js?v=20260818-home-shared-v1");
    const componentIndex = sources.indexOf("frontend/pages/homepage/visit-activity.js?v=20260825-site-visit-lifecycle-v1");
    const homepageIndex = sources.indexOf("frontend/pages/homepage/home-page.js?v=20260818-homepage-kpi-orchestrator-v1");
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
