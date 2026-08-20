import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

const root = path.resolve(process.cwd(), "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const utilityPath = "frontend/shared/utils/display-utils.js";
const callerPaths = [
  "frontend/pages/homepage/fault-trend.js",
  "frontend/pages/sites/sites-shared.js",
  "frontend/pages/sites/site-profile.js",
  "js/modals.js",
];

function productionJavaScriptFiles(directory = root) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if ([".git", "backend", "node_modules"].includes(entry.name)) return [];
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? productionJavaScriptFiles(fullPath) : entry.name.endsWith(".js") ? [fullPath] : [];
  });
}

describe("shared display utilities", () => {
  it("loads the shared utility before Homepage with the dedicated cache token", () => {
    const index = read("index.html");
    const sources = Array.from(index.matchAll(/<script\s+src="([^"]+)"/g), (match) => match[1]);
    const utility = "frontend/shared/utils/display-utils.js?v=20260818-display-utils-v2";
    const homepage = "frontend/pages/homepage/home-page.js?v=20260818-homepage-kpi-orchestrator-v1";
    expect(sources).toContain(utility);
    expect(sources.indexOf(utility)).toBeLessThan(sources.indexOf(homepage));
  });

  it("keeps one production definition shared by Homepage, Sites, and Modals", () => {
    const definitions = productionJavaScriptFiles().flatMap((file) =>
      Array.from(fs.readFileSync(file, "utf8").matchAll(/function\s+safeDetailValue\s*\(/g), () => file),
    );
    expect(definitions).toEqual([path.join(root, utilityPath)]);
    for (const caller of callerPaths) expect(read(caller), `${caller} must use the shared utility`).toContain("safeDetailValue(");
    expect(read("js/modals.js")).not.toContain("function safeDetailValue(");
  });

  it("preserves escaping behavior for Homepage, Sites, and Modal renderers", () => {
    const context = vm.createContext({ console, valueOrPlaceholder: (value) => value ?? "Pending Data" });
    vm.runInContext(read(utilityPath), context, { filename: utilityPath });
    expect(context.safeDetailValue(`<A & B's "detail">`)).toBe("&lt;A &amp; B&#039;s &quot;detail&quot;&gt;");

    for (const caller of callerPaths) vm.runInContext(read(caller), context, { filename: caller });
    expect(context.faultTrendSparkline([0, 1], "#fff", "<Site>")).toContain('aria-label="&lt;Site&gt; fault trend"');
    expect(context.filterOption("<Site>", "")).toContain('value="&lt;Site&gt;"');
    expect(context.detailRow("Site", "<Site>")).toContain("&lt;Site&gt;");
  });

  it("owns the one production file-size formatter before every consumer without changing output", () => {
    const definitions = productionJavaScriptFiles().flatMap((file) =>
      Array.from(fs.readFileSync(file, "utf8").matchAll(/function\s+formatFileSize\s*\(/g), () => file),
    );
    expect(definitions).toEqual([path.join(root, utilityPath)]);

    const callers = ["js/requests-page.js", "js/modals.js", "frontend/shared/files/file-preview.js"];
    for (const caller of callers) expect(read(caller), caller).toContain("formatFileSize(");
    expect(read("js/sites-page.js")).not.toContain("function formatFileSize(");

    const context = vm.createContext({ valueOrPlaceholder: (value) => value ?? "Pending Data" });
    vm.runInContext(read(utilityPath), context, { filename: utilityPath });
    expect(context.formatFileSize(0)).toBe("--");
    expect(context.formatFileSize(null)).toBe("--");
    expect(context.formatFileSize(1024)).toBe("1 KB");
    expect(context.formatFileSize(1536)).toBe("2 KB");
    expect(context.formatFileSize(1024 * 1024)).toBe("1.0 MB");
    expect(context.formatFileSize(1.25 * 1024 * 1024)).toBe("1.3 MB");

    const index = read("index.html");
    const sources = Array.from(index.matchAll(/<script\s+src="([^"]+)"/g), (match) => match[1].split("?")[0]);
    const utilityIndex = sources.indexOf(utilityPath);
    for (const consumer of callers) {
      expect(sources.indexOf(consumer), consumer).toBeGreaterThan(utilityIndex);
    }
  });
});
