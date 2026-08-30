import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../..");
const configs = fs.readFileSync(path.join(root, "frontend/shared/modals/modal-configs.js"), "utf8");
const core = fs.readFileSync(path.join(root, "frontend/shared/modals/modal-core.js"), "utf8");
const submit = fs.readFileSync(path.join(root, "frontend/shared/modals/modal-submit.js"), "utf8");

function statusContext() {
  const context = vm.createContext({});
  vm.runInContext(`${submit}\nthis.backendSiteStatus = backendSiteStatus;`, context);
  return context;
}

describe("site status edit flow", () => {
  it("renders exactly the three normal operational statuses and never Archived", () => {
    expect(configs).toContain('["Status", "select:Active,Inactive,Under Maintenance"]');
    expect(configs).not.toContain("select:Active,Archived");
  });

  it.each([
    ["Active", "Inactive", "inactive"],
    ["Inactive", "Active", "active"],
    ["Active", "Under Maintenance", "maintenance"],
    ["Under Maintenance", "Active", "active"],
    ["Inactive", "Under Maintenance", "maintenance"],
    ["Under Maintenance", "Inactive", "inactive"],
  ])("maps %s to %s through the normal status API", (_from, selected, expected) => {
    expect(statusContext().backendSiteStatus(selected)).toBe(expected);
    expect(submit).toContain("QatarOpsApi.Sites.updateStatus");
    expect(submit).not.toContain("updateSiteLifecycleStatus");
  });

  it("does not write when the selected status is unchanged", () => {
    expect(submit).toContain('if (requestedStatus !== (response.site?.status || "active"))');
  });

  it.each(["Active", "Inactive", "Under Maintenance"])("prefills a saved %s status after reopening", (savedStatus) => {
    const dom = new JSDOM(`<select id="status"><option>Active</option><option>Inactive</option><option>Under Maintenance</option></select>`);
    const start = core.indexOf("function setFieldValue");
    const end = core.indexOf("function prefillModal", start);
    const context = vm.createContext({ document: dom.window.document, Option: dom.window.Option });
    vm.runInContext(core.slice(start, end), context);
    context.setFieldValue("status", savedStatus);
    expect(dom.window.document.getElementById("status").value).toBe(savedStatus);
  });

  it("keeps archive and restore on their dedicated APIs", () => {
    const api = fs.readFileSync(path.join(root, "js/api-client.js"), "utf8");
    expect(api).toContain('apiRequest(`/sites/${id}/archive`');
    expect(api).toContain('apiRequest(`/sites/${id}/restore`');
  });

  it("loads inactive and maintenance sites as normal operational sites", () => {
    const data = fs.readFileSync(path.join(root, "frontend/pages/sites/sites-data.js"), "utf8");
    const repositories = [
      "backend/src/modules/sites/sites.repository.js",
      "backend/src/modules/chargers/chargers.repository.js",
      "backend/src/modules/faults/faults.repository.js",
      "backend/src/modules/operational-relations/operational-relations.repository.js",
    ].map((file) => fs.readFileSync(path.join(root, file), "utf8"));
    expect(data).toContain('QatarOpsApi.Sites.list({ status: "all"');
    repositories.forEach((source) => expect(source).toContain("sites.status <> 'archived'"));
  });
});
