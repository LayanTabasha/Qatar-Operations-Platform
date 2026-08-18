import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

const root = path.resolve(process.cwd(), "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

function loadBrowserScript(file, additions = {}) {
  const context = vm.createContext({ console, Map, Set, Date, String, Number, Array, Object, Math, ...additions });
  vm.runInContext(read(file), context, { filename: file });
  return context;
}

describe("frontend search and filter controls", () => {
  it("runs the real Sites render, delegated events, refresh, and second interaction lifecycle", () => {
    const listeners = { input: [], change: [] };
    const siteList = { innerHTML: "" };
    const search = { value: "", closest: (selector) => selector === "#sites .site-header-tools" ? {} : null, matches: (selector) => selector.includes('input[type="search"]') };
    const status = { value: "", innerHTML: "", closest: (selector) => selector === "#sites .site-header-tools" ? {} : null, matches: (selector) => selector.includes("select") };
    const document = {
      documentElement: { dataset: {} },
      addEventListener: (type, handler) => listeners[type]?.push(handler),
      getElementById: (id) => id === "site-list" ? siteList : id === "add-site-button" ? { classList: { toggle() {} } } : null,
      querySelector: (selector) => selector.includes('input[type="search"]') ? search : selector.includes("select") ? status : null,
    };
    const state = {
      backendLoading: false, backendError: "", faults: [], visits: [],
      sites: [
        { id: "1", name: "Al Mana Central", code: "AMC", location: "Doha", status: "Active", chargers: [] },
        { id: "2", name: "Mowasalat Depot", code: "MWD", location: "Industrial Area", status: "Maintenance", chargers: [] },
      ],
    };
    const context = loadBrowserScript("js/sites-page.js", {
      document, state,
      canManageOperations: () => false,
      imageBlock: () => "",
      placeholder: (label, value = "") => `${label}:${value}`,
      valueOrPlaceholder: (value) => value || "--",
      formatDate: (value) => value || "--",
      getRecordDate: (record) => record.visitDate || record.createdAt || "",
      latestVisitForSite: () => "--",
      safeDetailValue: (value) => String(value ?? ""),
      isAdmin: () => false,
    });

    context.buildSites();
    expect(siteList.innerHTML).toContain("Al Mana Central");
    expect(siteList.innerHTML).toContain("Mowasalat Depot");
    search.value = "mana cen";
    listeners.input[0]({ target: search });
    expect(siteList.innerHTML).toContain("Al Mana Central");
    expect(siteList.innerHTML).not.toContain("Mowasalat Depot");

    status.value = "Maintenance";
    listeners.change[0]({ target: status });
    expect(siteList.innerHTML).toContain("No sites match the selected filters");
    search.value = "";
    listeners.input[0]({ target: search });
    expect(siteList.innerHTML).toContain("Mowasalat Depot");
    expect(siteList.innerHTML).not.toContain("Al Mana Central");

    state.sites.push({ id: "3", name: "West Maintenance Hub", location: "Doha", status: "Maintenance", chargers: [] });
    context.buildSites();
    expect(siteList.innerHTML).toContain("Mowasalat Depot");
    expect(siteList.innerHTML).toContain("West Maintenance Hub");
    status.value = "";
    listeners.change[0]({ target: status });
    expect(siteList.innerHTML).toContain("Al Mana Central");
    expect(siteList.innerHTML).toContain("West Maintenance Hub");
    expect(listeners.input).toHaveLength(2);
    expect(listeners.change).toHaveLength(2);
    context.bindSitesFilters();
    expect(listeners.input).toHaveLength(2);
    expect(listeners.change).toHaveLength(2);
  });

  it("filters operational files with partial case-insensitive search and restores on clear", () => {
    const uploads = [
      { id: "1", kind: "document", title: "Commissioning Manual", name: "manual.pdf", siteName: "Al Mana", chargerId: "c1", chargerName: "DC One", documentType: "Manual", uploadedAt: "2026-08-01" },
      { id: "2", kind: "document", title: "Network Diagram", name: "network.pdf", siteName: "Al Mana", chargerId: "c2", chargerName: "AC Two", documentType: "Drawing", uploadedAt: "2026-08-02" },
    ];
    const context = loadBrowserScript("js/sites-page.js", {
      state: { currentSiteName: "Al Mana", currentChargerId: "", faults: [], visits: [] },
      getValidUploads: () => uploads,
      uploadKindForTitle: () => ["document"],
    });

    context.moduleFilters("Documents").search = "MISSION";
    expect(context.filteredFiles("Documents").map((item) => item.id)).toEqual(["1"]);
    context.moduleFilters("Documents").search = "manual";
    expect(context.filteredFiles("Documents").map((item) => item.id)).toEqual(["1"]);
    context.moduleFilters("Documents").search = "missing";
    expect(context.filteredFiles("Documents")).toHaveLength(0);
    context.moduleFilters("Documents").search = "";
    expect(context.filteredFiles("Documents")).toHaveLength(2);
  });

  it("combines dropdown/date filters without resetting unrelated values and survives data refresh", () => {
    let uploads = [
      { id: "1", kind: "document", title: "Manual", siteName: "Al Mana", chargerId: "c1", chargerName: "DC One", documentType: "Manual", uploadedAt: "2026-08-01" },
      { id: "2", kind: "document", title: "Manual", siteName: "Al Mana", chargerId: "c2", chargerName: "AC Two", documentType: "Manual", uploadedAt: "2026-08-02" },
      { id: "3", kind: "document", title: "Drawing", siteName: "Al Mana", chargerId: "c1", chargerName: "DC One", documentType: "Drawing", uploadedAt: "2026-08-01" },
    ];
    const context = loadBrowserScript("js/sites-page.js", {
      state: { currentSiteName: "Al Mana", currentChargerId: "", faults: [], visits: [] },
      getValidUploads: () => uploads,
      uploadKindForTitle: () => ["document"],
    });
    const filters = context.moduleFilters("Documents");
    filters.charger = "c1";
    filters.documentType = "Manual";
    filters.date = "2026-08-01";
    expect(context.filteredFiles("Documents").map((item) => item.id)).toEqual(["1"]);
    filters.documentType = "Drawing";
    expect(filters.charger).toBe("c1");
    expect(context.filteredFiles("Documents").map((item) => item.id)).toEqual(["3"]);
    filters.charger = "";
    filters.documentType = "";
    filters.date = "";
    expect(context.filteredFiles("Documents")).toHaveLength(3);
    uploads = [...uploads, { id: "4", kind: "document", title: "New Record", siteName: "Al Mana", chargerId: "c3", documentType: "Notice", uploadedAt: "2026-08-03" }];
    expect(context.filteredFiles("Documents")).toHaveLength(4);
  });

  it("filters faults and visits with combined search/dropdown criteria", () => {
    const context = loadBrowserScript("js/sites-page.js", {
      state: {
        currentSiteName: "Al Mana", currentChargerId: "",
        faults: [
          { id: "1", faultId: "FLT-100", faultName: "Screen Failure", siteName: "Al Mana", chargerId: "c1", status: "Open", faultCode: "DTC-1", reportedAt: "2026-08-01" },
          { id: "2", faultId: "FLT-200", faultName: "Cable", siteName: "Al Mana", chargerId: "c2", status: "Resolved", faultCode: "DTC-2", reportedAt: "2026-08-02" },
        ],
        visits: [
          { id: "v1", purpose: "Preventive inspection", siteName: "Al Mana", chargerId: "c1", status: "Completed", visitDate: "2026-08-01" },
          { id: "v2", purpose: "Repair", siteName: "Al Mana", chargerId: "c2", status: "Scheduled", visitDate: "2026-08-02" },
        ],
      },
    });
    Object.assign(context.moduleFilters("Faults"), { search: "screen", status: "Open", charger: "c1", faultCode: "DTC-1" });
    expect(context.filteredFaultRecords().map((fault) => fault.id)).toEqual(["1"]);
    context.moduleFilters("Faults").search = "SCREEN";
    expect(context.filteredFaultRecords().map((fault) => fault.id)).toEqual(["1"]);
    context.moduleFilters("Faults").status = "Resolved";
    expect(context.filteredFaultRecords()).toHaveLength(0);
    Object.assign(context.moduleFilters("Site Visits"), { search: "INSPECT", status: "Completed", charger: "c1", date: "2026-08-01" });
    expect(context.filteredVisitRecords().map((visit) => visit.id)).toEqual(["v1"]);
    Object.assign(context.moduleFilters("Site Visits"), { search: "", status: "", charger: "", date: "" });
    expect(context.filteredVisitRecords()).toHaveLength(2);
  });

  it("keeps handlers and empty states for every existing frontend implementation", () => {
    const index = read("index.html");
    const sites = read("js/sites-page.js");
    const requests = read("js/requests-page.js");
    const archive = read("frontend/pages/settings/archive-page.js");
    const home = read("js/home-page.js");
    const contacts = read("frontend/pages/contacts/contacts-page.js");
    for (const id of ["global-search", "sites-search", "sites-status-filter", "fault-trend-range", "visit-activity-mode"]) expect(index).toContain(`id="${id}"`);
    expect(sites).toContain("bindSitesFilters");
    expect(sites).toContain("updateOperationalRecordResults");
    expect(sites).toContain("No sites match the selected filters");
    expect(requests).toContain("filteredRequests()");
    expect(requests).toContain("No requests match the selected filters");
    expect(archive).toContain("filteredArchiveItems()");
    expect(home).toContain("globalSearchRecords");
    expect(home).toContain("No matching records");
    expect(contacts).toContain("filterContacts");
  });
});
