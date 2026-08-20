import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";

const root = path.resolve(process.cwd(), "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const operational = read("frontend/pages/sites/operational-records.js");
const lifecycle = read("frontend/pages/sites/charger-lifecycle.js");
const sites = read("frontend/pages/sites/sites-data.js");
const app = read("app.js");

describe("extracted operational records and charger lifecycle", () => {
  it("preserves external callers, action contracts, and one listener block", () => {
    for (const name of ["openContentRecordDetail", "openContentDeleteConfirmation", "openLegacyContentDeleteConfirmation"]) {
      expect(app).toContain(`${name}(`);
      expect(operational).toContain(`function ${name}(`);
    }
    for (const attribute of ["data-content-view", "data-content-edit", "data-content-delete", "data-legacy-content-edit", "data-legacy-content-delete", "data-file-download", "data-file-preview", "data-operational-delete", "data-record-filter"]) {
      expect(operational).toContain(attribute);
    }
    expect((operational.match(/document\.addEventListener\("input"/g) || [])).toHaveLength(1);
    expect((operational.match(/document\.addEventListener\("change"/g) || [])).toHaveLength(1);
    expect((operational.match(/document\.addEventListener\("click"/g) || [])).toHaveLength(1);
    expect(sites).not.toContain("document.addEventListener(\"input\"");
  });

  it("preserves Site/Charger locking and Weekly Report Site-only context", () => {
    expect(operational).toContain('["siteVisit", "fault", "document", "guide"].includes(modal)');
    expect(operational).toContain('data-charger-id="${chargerId}" data-lock-location="true"');
    expect(operational).toContain('data-lock-site=\\"true\\"');
    expect(operational).not.toContain('["siteVisit", "fault", "document", "guide", "weeklyReport"]');
  });

  it("restores and permanently deletes archived Chargers with existing guards and refresh", async () => {
    const restore = vi.fn(async () => ({}));
    const deleteArchived = vi.fn(async () => ({}));
    const loadOperationalData = vi.fn(async () => true);
    const openSite = vi.fn();
    const alert = vi.fn();
    const context = vm.createContext({
      window: { QatarOpsApi: { Chargers: { restore, deleteArchived } }, prompt: () => "DC-01" },
      state: { currentSiteName: "Al Mana" }, isAdmin: () => true, loadOperationalData, openSite, alert,
    });
    vm.runInContext(lifecycle, context);
    await vm.runInContext('restoreArchivedCharger("charger-1")', context);
    await vm.runInContext('permanentlyDeleteArchivedCharger("charger-1", "DC Charger", "DC-01")', context);
    expect(restore).toHaveBeenCalledWith("charger-1");
    expect(deleteArchived).toHaveBeenCalledWith("charger-1");
    expect(loadOperationalData).toHaveBeenCalledTimes(2);
    expect(openSite).toHaveBeenCalledWith("Al Mana", "Chargers");
    expect(alert).not.toHaveBeenCalled();
  });

  it("keeps permanent deletion Admin-only and respects cancellation", async () => {
    const deleteArchived = vi.fn();
    const alert = vi.fn();
    const context = vm.createContext({
      window: { QatarOpsApi: { Chargers: { deleteArchived } }, prompt: () => null },
      state: {}, isAdmin: () => false, loadOperationalData: vi.fn(), openSite: vi.fn(), alert,
    });
    vm.runInContext(lifecycle, context);
    await vm.runInContext('permanentlyDeleteArchivedCharger("missing", "Unknown", "X")', context);
    expect(deleteArchived).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalledWith("Only Administrator accounts can permanently delete archived chargers.");
  });

  it("keeps API errors on the existing user-facing paths", async () => {
    const alert = vi.fn();
    const context = vm.createContext({
      window: {
        QatarOpsApi: {
          Chargers: {
            restore: async () => { throw new Error("restore failed"); },
            deleteArchived: async () => { throw new Error("delete failed"); },
          },
        },
        prompt: () => "X",
      },
      state: {}, isAdmin: () => true, loadOperationalData: vi.fn(), openSite: vi.fn(), alert,
    });
    vm.runInContext(lifecycle, context);
    await vm.runInContext('restoreArchivedCharger("missing")', context);
    await vm.runInContext('permanentlyDeleteArchivedCharger("missing", "Unknown", "X")', context);
    expect(alert).toHaveBeenCalledWith("restore failed");
    expect(alert).toHaveBeenCalledWith("delete failed");
  });
});
