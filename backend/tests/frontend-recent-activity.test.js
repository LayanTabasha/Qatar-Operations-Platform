import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

const root = path.resolve(process.cwd(), "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const componentPath = "frontend/pages/homepage/recent-activity.js";
const homepagePath = "frontend/pages/homepage/home-page.js";

function runtime(recent) {
  const target = { innerHTML: "" };
  const document = { getElementById: (id) => id === "activity-list" ? target : null };
  const context = vm.createContext({ console, document, window: {} });
  vm.runInContext(read("js/state.js"), context, { filename: "js/state.js" });
  vm.runInContext(`state.recent = ${JSON.stringify(recent)};`, context);
  vm.runInContext(read(componentPath), context, { filename: componentPath });
  return { context, target };
}

describe("Homepage Recent Activity component", () => {
  it("renders the latest five activities in descending order with existing date helpers", () => {
    const now = Date.now();
    const activities = Array.from({ length: 6 }, (_, index) => ({
      actionType: index === 5 ? "fault_created" : "site_updated",
      description: `Activity ${index}`,
      userName: index === 4 ? "" : `User ${index}`,
      occurredAt: new Date(now - index * 60_000).toISOString(),
    })).reverse();
    const { context, target } = runtime(activities);
    context.renderActivity();
    expect(target.innerHTML.match(/class="activity-row"/g)).toHaveLength(5);
    expect(target.innerHTML.indexOf("Activity 0")).toBeLessThan(target.innerHTML.indexOf("Activity 1"));
    expect(target.innerHTML).not.toContain("Activity 5");
    expect(target.innerHTML).toContain(`title="${context.formatDateTime(activities[5].occurredAt)}"`);
    expect(target.innerHTML).toContain(context.relativeTime(activities[5].occurredAt));
    expect(target.innerHTML).toContain("by System");
  });

  it("preserves every activity icon mapping", () => {
    const { context } = runtime([]);
    expect(context.activityIcon("fault_created")).toBe("FLT");
    expect(context.activityIcon("visit_created")).toBe("VIS");
    expect(context.activityIcon("document_uploaded")).toBe("DOC");
    expect(context.activityIcon("charger_updated")).toBe("CHG");
    expect(context.activityIcon("site_updated")).toBe("SITE");
    expect(context.activityIcon("password_changed")).toBe("SEC");
    expect(context.activityIcon("unknown")).toBe("OPS");
  });

  it("preserves the Recent Activity empty state", () => {
    const { context, target } = runtime([]);
    context.renderActivity();
    expect(target.innerHTML).toContain("No recent activity yet.");
    expect(target.innerHTML).toContain("Operational events will appear here after users make changes.");
  });

  it("loads before every external caller and preserves their global calls", () => {
    const sources = Array.from(read("index.html").matchAll(/<script\s+src="([^"]+)"/g), (match) => match[1]);
    const componentIndex = sources.indexOf("frontend/pages/homepage/recent-activity.js?v=20260818-recent-activity-v1");
    for (const caller of ["frontend/pages/homepage/home-page.js?v=20260818-homepage-recent-activity-v1", "js/modals.js?v=20260818-fault-lifecycle-v1", "js/settings-page.js?v=20260816-permanent-user-delete", "app.js?v=20260818-legacy-content-actions-v3"]) {
      expect(sources.indexOf(caller), `${caller} must load after Recent Activity`).toBeGreaterThan(componentIndex);
    }
    expect(read("app.js")).toContain("renderActivity();");
    expect(read("js/modals.js")).toContain("renderActivity();");
    expect(read("js/settings-page.js")).toContain("activityIcon(item.actionType)");
  });

  it("keeps both declarations in exactly one production file", () => {
    const sources = [componentPath, homepagePath].map((file) => ({ file, source: read(file) }));
    for (const name of ["renderActivity", "activityIcon"]) {
      const definitions = sources.flatMap(({ file, source }) =>
        Array.from(source.matchAll(new RegExp(`function\\s+${name}\\s*\\(`, "g")), () => file),
      );
      expect(definitions, `${name} must have one production owner`).toEqual([componentPath]);
    }
  });
});
