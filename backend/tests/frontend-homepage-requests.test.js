import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(process.cwd(), "..");
const home = fs.readFileSync(path.join(root, "frontend/pages/homepage/home-page.js"), "utf8");
const page = fs.readFileSync(path.join(root, "index.html"), "utf8");
const state = fs.readFileSync(path.join(root, "js/state.js"), "utf8");
const sites = fs.readFileSync(path.join(root, "js/sites-page.js"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "styles.css"), "utf8");

function browserScripts() {
  return Array.from(page.matchAll(/<script\s+src="([^"]+)"/g))
    .filter((match) => !/^https?:\/\//.test(match[1]))
    .map((match) => ({
    source: match[1].split("?")[0],
    contents: fs.readFileSync(path.join(root, match[1].split("?")[0]), "utf8"),
    }));
}

describe("Homepage Requests integration", () => {
  it("shows the KPI and chart only through the established Requests role predicate", () => {
    expect(home).toContain("const visible = window.QatarOpsRequests.canAccess()");
    expect(state).toContain('["admin", "hq_user", "operations_staff"].includes');
    expect(page).toContain('id="open-requests-kpi"');
    expect(page).toContain('id="requests-status-card"');
  });

  it("counts active and high-priority requests without completed requests", () => {
    expect(home).toContain('["open", "in_progress"].includes(item.status)');
    expect(home).toContain('item.priority === "high"');
    expect(home).toContain("No high priority requests");
  });

  it("renders exactly the three supported request statuses", () => {
    expect(state).toContain('{ value: "open", label: "Open"');
    expect(state).toContain('{ value: "in_progress", label: "In Progress"');
    expect(state).toContain('{ value: "completed", label: "Completed"');
    expect(state).not.toContain('label: "Overdue"');
    expect(state).not.toContain('label: "Closed"');
    expect(state).not.toContain('label: "Awaiting Verification"');
    expect(home).toContain('class="requests-status-summary"');
    expect(home).toContain('class="request-status-row"');
    expect(home).toContain('class="request-status-heading"');
    expect(home).not.toContain('class="request-status-doughnut"');
    expect(page).toContain('class="panel dashboard-card hidden" id="requests-status-card"');
    expect(page).not.toContain('class="panel dashboard-card wide hidden" id="requests-status-card"');
  });

  it("keeps the Open Requests KPI defined as Open plus In Progress", () => {
    expect(home).toContain('const active = state.requests.filter((item) => ["open", "in_progress"].includes(item.status))');
    expect(home).toContain("if (count) count.textContent = active.length");
  });

  it("places Site Visit Activity and Requests Status in the responsive dashboard grid", () => {
    const visitCard = page.indexOf('<h2>Site Visit Activity</h2>');
    const requestsCard = page.indexOf('<h2>Requests Status</h2>');
    expect(visitCard).toBeGreaterThan(0);
    expect(requestsCard).toBeGreaterThan(visitCard);
    expect(styles).toContain(".dashboard-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));");
    expect(styles).toContain(".kpi-grid, .site-grid, .contact-grid, .charger-grid, .summary-grid, .dashboard-grid");
  });

  it("renders a chronological split fault trend from one set of per-site series", () => {
    expect(page).toContain('id="fault-trend-site"');
    expect(home).toContain('state.sites.map((site)');
    expect(home).toContain('faultBelongsToSite(fault, site)');
    expect(home).toContain('type: "line"');
    expect(home).toContain('siteSelected ? "Site Faults" : "Total Faults"');
    expect(home).toContain('counts.set(key, 0)');
    expect(page).toContain('id="fault-trend-site-list"');
    expect(page).toContain('id="fault-trend-total"');
    expect(home).toContain("siteSeries.reduce((sum, entry) => sum + entry.total, 0)");
    expect(home).toContain("faultTrendSparkline(series.values, color, site.name)");
    expect(app).toContain('[data-fault-trend-site]');
    expect(home).toContain('No faults reported for this site during this period.');
    expect(home).toContain("const days = Number(document.getElementById(\"fault-trend-range\")?.value || 30)");
    expect(app).toContain('["fault-trend-site", "fault-trend-range", "visit-activity-mode"]');
  });

  it("removes placeholder KPI subtitles while retaining useful secondary text", () => {
    const homepage = page.slice(page.indexOf('id="home"'), page.indexOf('id="sites"'));
    expect(homepage).not.toContain("Pending Data");
    expect(homepage).toContain("Current sites");
    expect(home).toContain("No high priority requests");
  });

  it("uses the shared Requests API with isolated failure handling", () => {
    expect(home).toContain("window.QatarOpsApi.Requests.list({ limit: 500 })");
    expect(home).toContain("state.homepageRequestsError = error.message");
    expect(home).not.toContain("localStorage");
    expect(sites).toContain("Promise.resolve().then(loadHomepageRequests).catch");
  });

  it("isolates optional Requests rendering from bootstrap", () => {
    expect(home).toContain('console.error("Homepage Requests rendering failed", error)');
    expect(sites).toContain('console.error("Homepage Requests loading failed", error)');
  });

  it("has one shared Requests contract and no duplicate browser-global declarations", () => {
    const scripts = browserScripts();
    const combined = scripts.map(({ contents }) => contents).join("\n");
    expect(combined.match(/\b(?:const|let|var)\s+REQUEST_STATUSES\b/g) || []).toHaveLength(0);
    expect(combined.match(/\bfunction\s+canAccessRequests\b/g) || []).toHaveLength(0);
    expect(combined.match(/window\.QatarOpsRequests\s*=\s*Object\.freeze/g) || []).toHaveLength(1);
    expect(combined.match(/\bcanAccess\(\)\s*\{/g) || []).toHaveLength(1);
  });

  it("loads the shared Requests contract before every consumer", () => {
    const sources = browserScripts().map(({ source }) => source);
    const sharedIndex = sources.indexOf("js/state.js");
    for (const consumer of ["js/auth-router.js", "frontend/pages/homepage/home-page.js", "js/sites-page.js", "js/requests-page.js"]) {
      expect(sources.indexOf(consumer)).toBeGreaterThan(sharedIndex);
    }
  });

  it("keeps session bootstrap routing after isolated homepage rendering", () => {
    expect(app).toContain("const restored = await restoreAuthenticatedSession()");
    expect(app).toContain("if (!restored) showLoginScreen()");
  });
});
