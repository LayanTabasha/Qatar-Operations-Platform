import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

const root = path.resolve(process.cwd(), "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const componentPath = "frontend/pages/homepage/requests-status.js";
const homepagePath = "frontend/pages/homepage/home-page.js";

function runtime(roleKey = "admin") {
  const elements = new Map(["open-requests-kpi", "requests-status-card", "kpi-requests", "kpi-requests-detail", "requests-status-chart"].map((id) => [id, {
    classList: { hidden: false, toggle(_name, hidden) { this.hidden = hidden; } },
    textContent: "",
    innerHTML: "",
  }]));
  const document = { getElementById: (id) => elements.get(id) || null };
  const window = {};
  const context = vm.createContext({ console, document, window });
  vm.runInContext(read("js/state.js"), context, { filename: "js/state.js" });
  vm.runInContext(`state.currentUserRoleKey = ${JSON.stringify(roleKey)};`, context);
  vm.runInContext(read(componentPath), context, { filename: componentPath });
  return { context, elements, window };
}

function setState(context, values) {
  for (const [key, value] of Object.entries(values)) vm.runInContext(`state[${JSON.stringify(key)}] = ${JSON.stringify(value)};`, context);
}

describe("Homepage Requests Status component", () => {
  it("preserves Admin and HQ access while denying Operations Staff and Viewer", () => {
    for (const role of ["admin", "hq_user"]) {
      const { context, elements } = runtime(role);
      context.renderHomepageRequests();
      expect(elements.get("open-requests-kpi").classList.hidden, role).toBe(false);
      expect(elements.get("requests-status-card").classList.hidden, role).toBe(false);
    }
    for (const role of ["operations_staff", "viewer"]) {
      const { context, elements } = runtime(role);
      context.renderHomepageRequests();
      expect(elements.get("open-requests-kpi").classList.hidden, role).toBe(true);
      expect(elements.get("requests-status-card").classList.hidden, role).toBe(true);
    }
  });

  it("preserves loading, error, and empty states", () => {
    const { context, elements } = runtime();
    setState(context, { homepageRequestsLoading: true });
    context.renderHomepageRequests();
    expect(elements.get("kpi-requests").textContent).toBe("--");
    expect(elements.get("kpi-requests-detail").textContent).toBe("Loading requests");
    expect(elements.get("requests-status-chart").innerHTML).toContain("Loading requests");

    setState(context, { homepageRequestsLoading: false, homepageRequestsError: "Unavailable" });
    context.renderHomepageRequests();
    expect(elements.get("kpi-requests").textContent).toBe("Not Available Yet");
    expect(elements.get("kpi-requests-detail").textContent).toBe("Requests unavailable");

    setState(context, { homepageRequestsError: "", requests: [] });
    context.renderHomepageRequests();
    expect(elements.get("kpi-requests").textContent).toBe(0);
    expect(elements.get("kpi-requests-detail").textContent).toBe("No high priority requests");
    expect(elements.get("requests-status-chart").innerHTML).toContain('aria-label="Open: 0 requests"');
  });

  it("preserves KPI and status counts", () => {
    const { context, elements } = runtime();
    setState(context, { requests: [
      { status: "open", priority: "high" },
      { status: "in_progress", priority: "low" },
      { status: "completed", priority: "high" },
    ] });
    context.renderHomepageRequests();
    expect(elements.get("kpi-requests").textContent).toBe(2);
    expect(elements.get("kpi-requests-detail").textContent).toBe("1 High Priority");
    const chart = elements.get("requests-status-chart").innerHTML;
    expect(chart).toContain('aria-label="Open: 1 request"');
    expect(chart).toContain('aria-label="In Progress: 1 request"');
    expect(chart).toContain('aria-label="Completed: 1 request"');
  });

  it("preserves API parameters, response mapping, error state, and unauthorized clearing", async () => {
    const admin = runtime();
    const calls = [];
    admin.window.QatarOpsApi = { Requests: { list: async (params) => { calls.push(params); return { requests: [{ status: "open" }] }; } } };
    await admin.context.loadHomepageRequests();
    expect(calls).toEqual([{ limit: 500 }]);
    expect(vm.runInContext("state.requests.length", admin.context)).toBe(1);
    expect(vm.runInContext("state.homepageRequestsLoading", admin.context)).toBe(false);

    admin.window.QatarOpsApi.Requests.list = async () => { throw new Error("Requests unavailable"); };
    await admin.context.loadHomepageRequests();
    expect(vm.runInContext("state.homepageRequestsError", admin.context)).toBe("Requests unavailable");

    const viewer = runtime("viewer");
    setState(viewer.context, { requests: [{ status: "open" }], homepageRequestsLoading: true, homepageRequestsError: "Old" });
    await viewer.context.loadHomepageRequests();
    expect(vm.runInContext("state.requests.length", viewer.context)).toBe(0);
    expect(vm.runInContext("state.homepageRequestsLoading", viewer.context)).toBe(false);
    expect(vm.runInContext("state.homepageRequestsError", viewer.context)).toBe("");
  });

  it("loads before Homepage and Sites while preserving the external caller", () => {
    const sources = Array.from(read("index.html").matchAll(/<script\s+src="([^"]+)"/g), (match) => match[1]);
    const componentIndex = sources.indexOf("frontend/pages/homepage/requests-status.js?v=20260818-requests-status-v1");
    expect(componentIndex).toBeGreaterThan(sources.indexOf("js/state.js?v=20260818-fault-lifecycle-v1"));
    expect(componentIndex).toBeGreaterThan(sources.indexOf("js/api-client.js?v=20260818-legacy-content-actions-v3"));
    expect(componentIndex).toBeGreaterThan(sources.indexOf("frontend/pages/homepage/home-shared.js?v=20260818-home-shared-v1"));
    expect(sources.indexOf("frontend/pages/homepage/home-page.js?v=20260818-homepage-kpi-orchestrator-v1")).toBeGreaterThan(componentIndex);
    expect(sources.indexOf("js/sites-page.js?v=20260820-profile-split-v1")).toBeGreaterThan(componentIndex);
    expect(read("js/sites-page.js")).toContain("Promise.resolve().then(loadHomepageRequests).catch");
  });

  it("keeps all four declarations in exactly one production file", () => {
    const sources = [componentPath, homepagePath].map((file) => ({ file, source: read(file) }));
    for (const name of ["renderHomepageRequests", "chartUnavailable", "renderRequestsStatusChart", "loadHomepageRequests"]) {
      const definitions = sources.flatMap(({ file, source }) =>
        Array.from(source.matchAll(new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`, "g")), () => file),
      );
      expect(definitions, `${name} must have one production owner`).toEqual([componentPath]);
    }
  });
});
