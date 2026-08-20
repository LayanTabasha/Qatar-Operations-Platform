import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

describe("Platform Health frontend", () => {
  const settings = ["frontend/pages/settings/settings-shared.js", "frontend/pages/settings/platform-health.js", "frontend/pages/settings/settings-page.js"].map(read).join("\n");
  const api = read("js/api-client.js");
  const state = read("js/state.js");

  it("keeps Platform Health in the administrator-only system menu", () => {
    expect(state).toContain('const systemSettingsItems = ["Platform Health"]');
    expect(settings).toContain("const systemButtons = isAdmin()");
    expect(settings).toContain('if (selected === "Platform Health" && isAdmin())');
  });

  it("uses the shared API client and correct endpoint", () => {
    expect(api).toContain('return apiRequest("/health/platform", { method: "GET" })');
    expect(settings).toContain("window.QatarOpsApi.PlatformHealth.platform()");
  });

  it("renders loading, retry, refresh, and required statuses", () => {
    ["Loading platform status", "platform-health-retry", "Refresh Status", "Operational", "Degraded", "Unavailable", "Not configured", "Retrieved"].forEach((text) => expect(settings).toContain(text));
  });
});
