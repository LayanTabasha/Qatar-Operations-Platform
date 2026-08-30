import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { JSDOM } from "jsdom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const root = path.resolve(process.cwd(), "..");
const source = fs.readFileSync(path.join(root, "frontend/shared/platform-health-alert.js"), "utf8");

function runtime(role = "admin") {
  const dom = new JSDOM('<div id="global-platform-health-alert" class="global-health-alert hidden" role="status" aria-live="polite"></div>');
  const intervals = new Map();
  let nextInterval = 1;
  const platform = vi.fn();
  const setRoute = vi.fn();
  const renderSettings = vi.fn();
  const context = vm.createContext({
    document: dom.window.document,
    window: { QatarOpsApi: { PlatformHealth: { platform } } },
    state: { authenticated: true, currentUserRoleKey: role },
    isAdmin() { return context.state.currentUserRoleKey === "admin"; },
    formatSettingValue(value) { return String(value); },
    setRoute,
    renderSettings,
    setInterval(callback, delay) { const id = nextInterval++; intervals.set(id, { callback, delay }); return id; },
    clearInterval(id) { intervals.delete(id); },
  });
  vm.runInContext(source, context, { filename: "platform-health-alert.js" });
  return { context, dom, intervals, platform, setRoute, renderSettings, alert: dom.window.document.getElementById("global-platform-health-alert") };
}

const healthy = { status: "healthy", message: "All critical platform services are operational", components: {} };
const degraded = { status: "degraded", message: "One or more platform services are degraded", components: { storage: { status: "degraded", message: "File previews are unavailable" } } };
const unavailable = { status: "unavailable", message: "A critical platform dependency is unavailable", components: { database: { status: "unavailable", message: "Database connection is unavailable" } } };

describe("global Admin Platform Health alert", () => {
  let instance;
  beforeEach(() => { instance = runtime(); });

  it("shows nothing for a healthy Admin result", async () => {
    instance.platform.mockResolvedValue(healthy);
    await vm.runInContext("checkGlobalPlatformHealth()", instance.context);
    expect(instance.alert.classList.contains("hidden")).toBe(true);
    expect(instance.alert.textContent).toBe("");
  });

  it("shows an amber alert with the backend reason for degraded health", async () => {
    instance.platform.mockResolvedValue(degraded);
    await vm.runInContext("checkGlobalPlatformHealth()", instance.context);
    expect(instance.alert.classList.contains("global-health-alert-degraded")).toBe(true);
    expect(instance.alert.textContent).toContain("Platform Health Degraded");
    expect(instance.alert.textContent).toContain("File previews are unavailable");
  });

  it("shows a red alert with the backend reason for unavailable health", async () => {
    instance.platform.mockResolvedValue(unavailable);
    await vm.runInContext("checkGlobalPlatformHealth()", instance.context);
    expect(instance.alert.classList.contains("global-health-alert-unavailable")).toBe(true);
    expect(instance.alert.textContent).toContain("Database connection is unavailable");
  });

  it("shows a critical alert when the health request fails", async () => {
    instance.platform.mockRejectedValue(new Error("network unavailable"));
    await vm.runInContext("checkGlobalPlatformHealth()", instance.context);
    expect(instance.alert.classList.contains("global-health-alert-unavailable")).toBe(true);
    expect(instance.alert.textContent).toContain("Platform Health Check Unavailable");
  });

  it("automatically removes the alert after recovery", async () => {
    instance.platform.mockResolvedValueOnce(degraded).mockResolvedValueOnce(healthy);
    await vm.runInContext("checkGlobalPlatformHealth()", instance.context);
    await vm.runInContext("checkGlobalPlatformHealth()", instance.context);
    expect(instance.alert.classList.contains("hidden")).toBe(true);
    expect(instance.alert.textContent).toBe("");
  });

  it.each(["hq_user", "operations_staff", "viewer"])("does not poll or show an alert for %s", (role) => {
    instance = runtime(role);
    vm.runInContext("startPlatformHealthMonitoring()", instance.context);
    expect(instance.platform).not.toHaveBeenCalled();
    expect(instance.intervals.size).toBe(0);
    expect(instance.alert.classList.contains("hidden")).toBe(true);
  });

  it("navigates View Health to Settings and Platform Health", async () => {
    instance.platform.mockResolvedValue(degraded);
    await vm.runInContext("checkGlobalPlatformHealth()", instance.context);
    instance.alert.querySelector("#global-health-view").click();
    expect(instance.setRoute).toHaveBeenCalledWith("settings");
    expect(instance.renderSettings).toHaveBeenCalledWith("Platform Health");
  });

  it("maintains only one 60-second polling interval", () => {
    instance.platform.mockResolvedValue(healthy);
    vm.runInContext("startPlatformHealthMonitoring(); startPlatformHealthMonitoring();", instance.context);
    expect(instance.intervals.size).toBe(1);
    expect([...instance.intervals.values()][0].delay).toBe(60000);
  });

  it("does not recreate an unchanged alert", async () => {
    instance.platform.mockResolvedValue(degraded);
    await vm.runInContext("checkGlobalPlatformHealth()", instance.context);
    const button = instance.alert.querySelector("#global-health-view");
    await vm.runInContext("checkGlobalPlatformHealth()", instance.context);
    expect(instance.alert.querySelector("#global-health-view")).toBe(button);
  });
});
