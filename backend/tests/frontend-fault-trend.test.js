import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { JSDOM } from "jsdom";
import { describe, expect, it, vi } from "vitest";

const root = path.resolve(process.cwd(), "..");
const componentPath = path.join(root, "frontend/pages/homepage/fault-trend.js");
const component = fs.readFileSync(componentPath, "utf8");
const home = fs.readFileSync(path.join(root, "frontend/pages/homepage/home-page.js"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");

function runtime() {
  const dom = new JSDOM(`<!doctype html><select id="fault-trend-site"></select><select id="fault-trend-range"><option value="7">Last 7 Days</option><option value="30" selected>Last 30 Days</option><option value="90">Last 90 Days</option><option value="180">Last 180 Days</option><option value="365">Last 365 Days</option></select><div id="fault-trend-subtitle"></div><div id="fault-trend-detail-title"></div><div id="fault-trend-context"></div><div id="fault-trend-total"></div><div id="fault-trend-site-list"></div><div id="fault-trend-chart"></div>`);
  const charts = [];
  class ChartMock {
    constructor(canvas, config) {
      this.canvas = canvas;
      this.config = config;
      this.destroy = vi.fn();
      charts.push(this);
    }
  }
  const context = vm.createContext({
    window: dom.window,
    document: dom.window.document,
    state: {
      sites: [{ id: "one", name: "Alpha" }, { id: "two", name: "Bravo" }],
      faults: [
        { siteId: "one", siteName: "Alpha", createdAt: "2026-08-17T12:00:00Z" },
        { siteId: "one", siteName: "Alpha", createdAt: "2026-08-12T12:00:00Z" },
        { siteId: "two", siteName: "Bravo", createdAt: "2026-08-16T12:00:00Z" },
      ],
    },
    DASHBOARD_COLORS: ["#111111", "#222222"],
    safeDetailValue: (value) => String(value ?? ""),
    getRecordDate: (record) => record.createdAt,
    chartEmpty: (message) => `<p class="empty">${message}</p>`,
    Date,
    Map,
    Number,
    String,
    Array,
  });
  context.window.Chart = ChartMock;
  vm.runInContext(component, context);
  return { context, document: dom.window.document, charts };
}

describe("Homepage Fault Trend component", () => {
  it("retains daily, weekly, and monthly periods including zero-count periods", () => {
    const { context } = runtime();
    const now = new Date("2026-08-18T12:00:00Z");
    for (const [days, grouping] of [[7, "day"], [30, "day"], [90, "week"], [180, "month"], [365, "month"]]) {
      const series = context.buildFaultTrendSeries(context.state.faults, days, now);
      expect(series.grouping).toBe(grouping);
      expect(series.labels).toHaveLength(series.values.length);
      expect(series.values).toContain(0);
    }
  });

  it("renders All Sites totals, per-site totals, colors, sparklines, and selection", () => {
    const { context, document, charts } = runtime();
    context.renderFaultTrendChart();
    expect(document.getElementById("fault-trend-total").textContent).toBe("3");
    expect(document.querySelectorAll("[data-fault-trend-site]")).toHaveLength(2);
    expect(document.querySelectorAll(".fault-trend-sparkline")).toHaveLength(2);
    expect(charts[0].config.data.datasets[0].borderColor).toBe("#111111");

    document.getElementById("fault-trend-site").value = "two";
    context.renderFaultTrendChart();
    expect(document.getElementById("fault-trend-total").textContent).toBe("1");
    expect(document.querySelector('[data-fault-trend-site="two"]').classList.contains("selected")).toBe(true);
    expect(charts[1].config.data.datasets[0].borderColor).toBe("#222222");
  });

  it("destroys the previous chart before every replacement without leaking instances", () => {
    const { context, document, charts } = runtime();
    context.renderFaultTrendChart();
    document.getElementById("fault-trend-range").value = "7";
    context.renderFaultTrendChart();
    expect(charts).toHaveLength(2);
    expect(charts[0].destroy).toHaveBeenCalledTimes(1);
    expect(charts[1].destroy).not.toHaveBeenCalled();
  });

  it("preserves global and selected-site empty states", () => {
    const { context, document } = runtime();
    context.state.faults = [];
    context.renderFaultTrendChart();
    expect(document.getElementById("fault-trend-chart").textContent).toContain("No faults reported during this period.");
    document.getElementById("fault-trend-site").value = "one";
    context.renderFaultTrendChart();
    expect(document.getElementById("fault-trend-chart").textContent).toContain("No faults reported for this site during this period.");
  });

  it("loads after shared dependencies and before the orchestrator and app caller", () => {
    const sources = Array.from(index.matchAll(/<script\s+src="([^"]+)"/g), (match) => match[1].split("?")[0]);
    const componentIndex = sources.indexOf("frontend/pages/homepage/fault-trend.js");
    expect(componentIndex).toBeGreaterThan(sources.indexOf("frontend/pages/homepage/home-shared.js"));
    expect(componentIndex).toBeGreaterThan(sources.indexOf("frontend/shared/utils/display-utils.js"));
    expect(componentIndex).toBeGreaterThan(sources.indexOf("js/state.js"));
    expect(componentIndex).toBeLessThan(sources.indexOf("frontend/pages/homepage/home-page.js"));
    expect(componentIndex).toBeLessThan(sources.indexOf("app.js"));
    expect(home).toContain("renderFaultTrendChart();");
    expect(app).toContain("renderFaultTrendChart();");
  });

  it("has exactly one production implementation and one mutable chart declaration", () => {
    const production = [
      "frontend/pages/homepage/fault-trend.js",
      "frontend/pages/homepage/home-page.js",
      "app.js",
      "frontend/pages/sites/sites-data.js",
      "js/requests-page.js",
    ].map((file) => fs.readFileSync(path.join(root, file), "utf8")).join("\n");
    expect(production.match(/function renderFaultTrendChart\s*\(/g) || []).toHaveLength(1);
    expect(production.match(/let faultTrendChartInstance\s*=\s*null/g) || []).toHaveLength(1);
    for (const name of ["localDateKey", "startOfFaultTrendWeek", "faultTrendPeriodStart", "nextFaultTrendPeriod", "faultTrendLabel", "syncFaultTrendSiteSelector", "faultTrendSiteColor", "faultBelongsToSite", "buildFaultTrendSeries", "destroyFaultTrendChart", "faultTrendSparkline", "renderFaultTrendSites", "renderFaultTrendLine"]) {
      expect(production.match(new RegExp(`function ${name}\\s*\\(`, "g")) || [], name).toHaveLength(1);
    }
  });
});
