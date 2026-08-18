import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

const root = path.resolve(process.cwd(), "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const kpiPath = "frontend/pages/homepage/kpi-cards.js";
const homePath = "frontend/pages/homepage/home-page.js";
const kpi = read(kpiPath);
const home = read(homePath);
const requests = read("frontend/pages/homepage/requests-status.js");
const index = read("index.html");

function kpiRuntime() {
  const dom = new JSDOM(`<!doctype html><strong id="kpi-sites"></strong><strong id="kpi-chargers"></strong><strong id="kpi-faults"></strong><strong id="kpi-visits"></strong>`);
  const context = vm.createContext({ document: dom.window.document, state: { sites: [{}, {}, {}], counts: { chargers: 17, faults: 4, visits: 9 } } });
  vm.runInContext(kpi, context, { filename: kpiPath });
  return { context, document: dom.window.document };
}

describe("Homepage KPI Cards component", () => {
  it("renders the established Sites, Chargers, Open Faults, and Site Visits counts", () => {
    const { context, document } = kpiRuntime();
    context.renderKpiCards();
    expect(document.getElementById("kpi-sites").textContent).toBe("3");
    expect(document.getElementById("kpi-chargers").textContent).toBe("17");
    expect(document.getElementById("kpi-faults").textContent).toBe("4");
    expect(document.getElementById("kpi-visits").textContent).toBe("9");
  });

  it("keeps Requests KPI rendering and authorization in requests-status.js", () => {
    expect(kpi).not.toContain("kpi-requests");
    expect(kpi).not.toContain("QatarOpsRequests");
    expect(requests).toContain("window.QatarOpsRequests.canAccess()");
    expect(requests).toContain('card?.classList.toggle("hidden", !visible)');
    expect(requests).toContain('["open", "in_progress"].includes(item.status)');
  });

  it("preserves the renderCounts orchestration order", () => {
    const calls = [];
    const input = { value: "fault" };
    const context = vm.createContext({
      console,
      document: { getElementById: (id) => id === "global-search" ? input : null },
      refreshDerivedCounts: () => calls.push("refresh"),
      renderKpiCards: () => calls.push("kpis"),
      renderHomepageRequests: () => calls.push("requests"),
      renderFaultStatusChart: () => calls.push("fault-status"),
      renderChargerStatusChart: () => calls.push("charger-status"),
      renderFaultTrendChart: () => calls.push("fault-trend"),
      renderVisitActivityChart: () => calls.push("visits"),
      renderRecordsBySiteChart: () => calls.push("records"),
      renderGlobalSearchResults: () => calls.push("search"),
    });
    vm.runInContext(home, context, { filename: homePath });
    context.renderCounts();
    expect(calls).toEqual(["refresh", "kpis", "requests", "fault-status", "charger-status", "fault-trend", "visits", "records", "search"]);
  });

  it("preserves external renderCounts and renderDashboardCharts callers", () => {
    for (const caller of ["app.js", "js/sites-page.js", "js/modals.js"]) {
      expect(read(caller), caller).toMatch(/\brenderCounts\s*\(/);
    }
    expect(read("app.js")).toContain('addEventListener("change", renderDashboardCharts)');
    expect(read("js/sites-page.js")).toMatch(/\brenderDashboardCharts\s*\(/);
    expect(home.match(/function renderCounts\s*\(/g) || []).toHaveLength(1);
    expect(home.match(/function renderDashboardCharts\s*\(/g) || []).toHaveLength(1);
  });

  it("loads KPI Cards after components and before the small orchestrator", () => {
    const sources = Array.from(index.matchAll(/<script\s+src="([^"]+)"/g), (match) => match[1]);
    const faultTrend = sources.indexOf("frontend/pages/homepage/fault-trend.js?v=20260818-fault-trend-v1");
    const component = sources.indexOf("frontend/pages/homepage/kpi-cards.js?v=20260818-kpi-cards-v1");
    const orchestrator = sources.indexOf("frontend/pages/homepage/home-page.js?v=20260818-homepage-kpi-orchestrator-v1");
    expect(component).toBeGreaterThan(faultTrend);
    expect(orchestrator).toBeGreaterThan(component);
    expect(kpi.match(/function renderKpiCards\s*\(/g) || []).toHaveLength(1);
    expect(home).not.toContain('getElementById("kpi-');
  });
});
