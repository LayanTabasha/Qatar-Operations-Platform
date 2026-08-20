import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

const root = path.resolve(process.cwd(), "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const index = read("index.html");
const mapperSource = read("frontend/pages/sites/sites-data-mappers.js");
const sitesSharedSource = read("frontend/pages/sites/sites-shared.js");
const sitesListSource = read("frontend/pages/sites/sites-list.js");
const siteVisitsSource = read("frontend/pages/sites/site-visits.js");
const faultsSource = read("frontend/pages/sites/faults.js");
const operationalRecordsSource = read("frontend/pages/sites/operational-records.js");
const siteProfileSource = read("frontend/pages/sites/site-profile.js");
const chargerProfileSource = read("frontend/pages/sites/charger-profile.js");
const chargerLifecycleSource = read("frontend/pages/sites/charger-lifecycle.js");
const sitesSource = read("frontend/pages/sites/sites-data.js");
const modalFiles = ["frontend/shared/modals/modal-files.js", "frontend/shared/modals/fault-modals.js", "frontend/shared/modals/modal-core.js", "frontend/shared/modals/modal-submit.js"];
const appSource = read("app.js");
const siteId = "807c17a6-4a93-4882-8aec-5066d5d80cb8";
const chargerId = "ede42290-5155-4ba9-b91f-56fda870964d";

function runtime() {
  const dom = new JSDOM(index, { url: "https://zdoperations.zdenergyqatar.com/#sites", runScripts: "outside-only" });
  const { window } = dom;
  window.HTMLElement.prototype.scrollIntoView = () => {};
  window.HTMLElement.prototype.scrollTo = () => {};
  window.alert = (message) => { throw new Error(String(message)); };
  window.QatarOpsApi = {
    Dtc: { list: async () => ({ dtc_records: [] }) },
    ContentRecords: { update: async () => ({}), remove: async () => ({}) },
  };
  const context = dom.getInternalVMContext();
  const run = (source, filename = "runtime.js") => vm.runInContext(source, context, { filename });
  run(read("js/state.js"), "js/state.js");
  run(read("frontend/shared/utils/display-utils.js"), "frontend/shared/utils/display-utils.js");
  run(`
    state.authenticated = true;
    state.currentUser = "Runtime Tester";
    state.currentUserRoleKey = "admin";
    state.sites = [{ id: "${siteId}", name: "Msheireb", status: "Active", chargers: [{
      id: "${chargerId}", siteId: "${siteId}", name: "Msheireb DC Charger 02", status: "Active", type: "DC"
    }] }];
    let activePreview = { fileId: "", zoom: 1, rotation: 0, mode: "fit-screen", objectUrl: "" };
    function requireAuth() { return true; }
    function saveViewContext() {}
    function formatSettingValue(value) { return String(value || ""); }
  `);
  run(mapperSource, "frontend/pages/sites/sites-data-mappers.js");
  run(sitesSharedSource, "frontend/pages/sites/sites-shared.js");
  run(sitesListSource, "frontend/pages/sites/sites-list.js");
  run(siteVisitsSource, "frontend/pages/sites/site-visits.js");
  run(faultsSource, "frontend/pages/sites/faults.js");
  run(operationalRecordsSource, "frontend/pages/sites/operational-records.js");
  run(siteProfileSource, "frontend/pages/sites/site-profile.js");
  run(chargerProfileSource, "frontend/pages/sites/charger-profile.js");
  run(chargerLifecycleSource, "frontend/pages/sites/charger-lifecycle.js");
  run(sitesSource, "frontend/pages/sites/sites-data.js");
  for (const file of modalFiles) run(read(file), file);
  run(`
    function renderSettings() {}
    function setRoute() {}
    function logout() {}
    function loadArchiveData() {}
    function showArchiveDetails() {}
    function closeArchiveModal() {}
    function openFilePreview() {}
    function handlePreviewAction() {}
    function downloadFile() {}
    function replaceLegacyFile() {}
    function confirmArchiveActive() {}
    function confirmArchiveRestore() {}
    function confirmArchiveDelete() {}
    function submitRequestForm() {}
    function loadPlatformHealth() {}
    function renderCounts() {}
    function renderDashboardCharts() {}
    function changeSettingsPassword() {}
    function renderRoute() {}
  `);
  run(appSource.replace("\nbootstrapApp();", ""), "app.js");
  return { dom, window, run };
}

function openSiteAction(tab, modal) {
  const instance = runtime();
  instance.run(`openSite("Msheireb", ${JSON.stringify(tab)})`);
  instance.run("refreshOpenProfiles()", "late-refresh.js");
  const button = instance.window.document.querySelector(`#site-profile [data-modal="${modal}"][data-mode="create"]`);
  expect(button).not.toBeNull();
  button.click();
  return { ...instance, button };
}

function openChargerAction(tab, modal) {
  const instance = runtime();
  instance.run('openSite("Msheireb", "Chargers")');
  instance.window.document.querySelector("#site-profile .open-charger").click();
  instance.window.document.querySelector(`#charger-profile [data-tab="${tab}"]`).click();
  instance.run("refreshOpenProfiles()", "late-refresh.js");
  const button = instance.window.document.querySelector(`#charger-profile [data-modal="${modal}"][data-mode="create"]`);
  expect(button).not.toBeNull();
  button.click();
  return { ...instance, button };
}

function expectSiteContext(instance, expectedCharger = false) {
  const { document } = instance.window;
  const form = document.getElementById("modal-form");
  const site = document.getElementById("site") || document.getElementById("related-site");
  expect(instance.button.dataset.siteId).toBe(siteId);
  expect(form.dataset.siteId).toBe(siteId);
  expect(site.value).toBe(form.dataset.type === "fault" ? siteId : "Msheireb");
  expect(site.disabled).toBe(true);
  const charger = document.getElementById("charger");
  if (expectedCharger) {
    expect(instance.button.dataset.chargerId).toBe(chargerId);
    expect(form.dataset.chargerId).toBe(chargerId);
    expect(charger.value).toBe(chargerId);
    expect(charger.selectedOptions[0].textContent).toBe("Msheireb DC Charger 02");
    expect(charger.disabled).toBe(true);
  } else if (charger) {
    expect(instance.button.dataset.chargerId).toBeUndefined();
    expect(charger.value).toBe("");
    expect(charger.disabled).toBe(false);
  }
  instance.dom.window.close();
}

describe("real operational form context lifecycle", () => {
  it("opens Site Visit from a Site profile with the Site inherited after a late refresh", () => {
    expectSiteContext(openSiteAction("Site Visits", "siteVisit"));
  });

  it("opens Site Visit from a Charger profile with Site and Charger inherited after a late refresh", () => {
    expectSiteContext(openChargerAction("Site Visits", "siteVisit"), true);
  });

  it("opens Fault from the real Charger Faults action with both UUIDs locked", () => {
    expectSiteContext(openChargerAction("Faults", "fault"), true);
  });

  it("opens Document with Site-only context from Site and Site+Charger context from Charger", () => {
    expectSiteContext(openSiteAction("Documents", "document"));
    expectSiteContext(openChargerAction("Documents", "document"), true);
  });

  it("opens Weekly Report as Site-only from either profile", () => {
    const site = openSiteAction("Weekly Reports", "weeklyReport");
    expect(site.window.document.getElementById("charger")).toBeNull();
    expectSiteContext(site);
    const charger = openChargerAction("Weekly Reports", "weeklyReport");
    expect(charger.button.dataset.chargerId).toBeUndefined();
    expect(charger.window.document.getElementById("charger")).toBeNull();
    expectSiteContext(charger);
  });

  it("opens Troubleshooting with Site-only context from Site and Site+Charger context from Charger", () => {
    expectSiteContext(openSiteAction("Troubleshooting", "guide"));
    expectSiteContext(openChargerAction("Troubleshooting", "guide"), true);
  });

  it("keeps global Fault creation selectable with Chargers filtered to the selected Site", () => {
    const instance = runtime();
    instance.window.document.querySelector('#home [data-modal="fault"][data-mode="create"]').click();
    const site = instance.window.document.getElementById("site");
    const charger = instance.window.document.getElementById("charger");
    expect(site.disabled).toBe(false);
    expect(charger.disabled).toBe(false);
    expect([...charger.options].map((option) => option.value)).toContain(chargerId);
    instance.dom.window.close();
  });

  it("opens the Homepage Document action in global create mode with selectable location", () => {
    const instance = runtime();
    instance.window.document.querySelector('#home [data-modal="document"][data-mode="create"]').click();
    expect(instance.window.document.getElementById("modal-form").dataset.mode).toBe("create");
    expect(instance.window.document.getElementById("related-site").disabled).toBe(false);
    expect(instance.window.document.getElementById("charger").disabled).toBe(false);
    instance.dom.window.close();
  });

  it("preserves a second Site Charger and active tab across operational refresh", () => {
    const instance = runtime();
    instance.run(`
      state.sites.push({ id: "al-mana-site", name: "Al Mana", status: "Active", chargers: [{
        id: "al-mana-charger", siteId: "al-mana-site", name: "Al Mana AC Charger 01", status: "Active", type: "AC"
      }] });
      openCharger("Al Mana", "al-mana-charger", "Documents");
      refreshOpenProfiles();
    `);
    expect(instance.window.state?.currentSiteName || instance.run("state.currentSiteName")).toBe("Al Mana");
    expect(instance.run("state.currentChargerId")).toBe("al-mana-charger");
    expect(instance.run("state.currentChargerTab")).toBe("Documents");
    expect(instance.window.document.getElementById("charger-profile").classList.contains("hidden")).toBe(false);
    instance.dom.window.close();
  });

  it("refreshes a Site-only profile without creating Charger context", () => {
    const instance = runtime();
    instance.run('openSite("Msheireb", "Faults"); refreshOpenProfiles();');
    expect(instance.run("state.currentSiteName")).toBe("Msheireb");
    expect(instance.run("state.currentChargerId")).toBe("");
    expect(instance.run("state.currentSiteTab")).toBe("Faults");
    instance.dom.window.close();
  });
});

const contentCases = [
  { tab: "Documents", kind: "document", type: "documents", id: "document-record", title: "Operations Manual", extra: "documentType: 'Manual', documentDate: '2026-08-01'" },
  { tab: "Weekly Reports", kind: "weeklyReport", type: "weekly-reports", id: "weekly-record", title: "Weekly Report 31", extra: "weekStart: '2026-07-27', weekEnd: '2026-08-02'" },
  { tab: "Troubleshooting", kind: "guide", type: "troubleshooting", id: "guide-record", title: "Reset Guide", extra: "guideCategory: 'Reset Procedure'" },
];

function renderPersistedContentProfile(item, role = "admin", chargerProfile = false) {
  const instance = runtime();
  instance.run(`
    state.currentUserRoleKey = ${JSON.stringify(role)};
    state.currentUserRole = ${JSON.stringify(role)};
    state.authUser = { roleKey: ${JSON.stringify(role)}, role: ${JSON.stringify(role)} };
    state.uploads = [normalizeUploadRecord({
      id: '${item.id}-attachment', recordId: '${item.id}', recordPersisted: true,
      attachmentPersisted: true, persisted: true, kind: '${item.kind}', title: ${JSON.stringify(item.title)},
      weeklyReportId: '${item.kind === "weeklyReport" ? item.id : ""}',
      troubleshootingGuideId: '${item.kind === "guide" ? item.id : ""}',
      siteName: 'Msheireb', chargerId: '${chargerId}', chargerName: 'Msheireb DC Charger 02',
      name: '${item.id}.pdf', fileName: '${item.id}.pdf', uploadedAt: '2026-08-01T00:00:00Z',
      uploadedBy: 'Runtime Tester', ${item.extra}
    })];
    ${chargerProfile ? `openCharger('Msheireb', '${chargerId}', '${item.tab}')` : `openSite('Msheireb', '${item.tab}')`};
  `, "content-profile-render.js");
  const profile = instance.window.document.querySelector(chargerProfile ? "#charger-profile" : "#site-profile");
  return { ...instance, profile };
}

describe("production Site and Charger content Actions lifecycle", () => {
  it("uses the exact authenticated Admin state and shared management permission", () => {
    const instance = runtime();
    instance.run(`
      state.currentUser = "Live Admin";
      state.currentUserRole = "Administrator";
      state.currentUserRoleKey = "admin";
      state.authUser = { name: "Live Admin", role: "Administrator", roleKey: "admin" };
    `);
    expect(instance.run("state.currentUser")).toBe("Live Admin");
    expect(instance.run("state.currentUserRole")).toBe("Administrator");
    expect(instance.run("state.currentUserRoleKey")).toBe("admin");
    expect(instance.run("canManageOperations()")).toBe(true);
    instance.dom.window.close();
  });

  for (const item of contentCases) {
    it(`renders and wires all four ${item.tab} actions in the actual Site profile table`, () => {
      const instance = renderPersistedContentProfile(item);
      const labels = [...instance.profile.querySelectorAll("tbody .file-actions button")].map((button) => button.getAttribute("aria-label"));
      expect(labels).toEqual([
        `View ${item.kind === "weeklyReport" ? "weekly report" : item.kind === "guide" ? "troubleshooting guide" : "document"}`,
        `Download ${item.kind === "weeklyReport" ? "weekly report" : item.kind === "guide" ? "troubleshooting guide" : "document"}`,
        `Edit ${item.kind === "weeklyReport" ? "weekly report" : item.kind === "guide" ? "troubleshooting guide" : "document"}`,
        `Delete ${item.kind === "weeklyReport" ? "weekly report" : item.kind === "guide" ? "troubleshooting guide" : "document"}`,
      ]);
      instance.profile.querySelector(`[data-content-edit="${item.id}"]`).click();
      expect(instance.window.document.getElementById("modal-form").dataset.mode).toBe("edit");
      expect(instance.window.document.getElementById("modal-form").dataset.type).toBe(item.kind === "document" ? "document" : item.kind === "weeklyReport" ? "weeklyReport" : "guide");
      instance.run("closeModal()");
      instance.profile.querySelector(`[data-content-delete="${item.id}"]`).click();
      expect(instance.window.document.getElementById("modal-form").dataset.type).toBe("contentDelete");
      expect(instance.window.document.getElementById("modal-form").dataset.recordId).toBe(item.id);
      instance.dom.window.close();
    });

    it(`renders the same ${item.tab} management actions in the Charger profile and hides them from Viewer`, () => {
      const manager = renderPersistedContentProfile(item, "operations_staff", true);
      expect(manager.profile.querySelector(`[data-content-edit="${item.id}"]`)).not.toBeNull();
      expect(manager.profile.querySelector(`[data-content-delete="${item.id}"]`)).not.toBeNull();
      manager.dom.window.close();
      const viewer = renderPersistedContentProfile(item, "viewer");
      expect(viewer.profile.querySelector(`[data-content-view="${item.id}"]`)).not.toBeNull();
      expect(viewer.profile.querySelector(`[data-file-download="${item.id}-attachment"]`)).not.toBeNull();
      expect(viewer.profile.querySelector("[data-content-edit]")).toBeNull();
      expect(viewer.profile.querySelector("[data-content-delete]")).toBeNull();
      viewer.dom.window.close();
    });
  }

  for (const item of contentCases) {
    it(`renders four actions and safely mutates the real legacy ${item.tab} shape`, async () => {
      const instance = runtime();
      instance.run(`
        state.currentUserRole = "Administrator";
        state.currentUserRoleKey = "admin";
        state.uploads = [normalizeUploadRecord({
          id: 'legacy-${item.id}', kind: '${item.kind}', title: ${JSON.stringify(item.title)},
          persisted: false, recordPersisted: false, siteName: 'Msheireb', chargerId: '${chargerId}',
          chargerName: 'Msheireb DC Charger 02', name: 'legacy-${item.id}.pdf', dataUrl: 'data:application/pdf;base64,JVBERi0=',
          weeklyReportId: '${item.kind === "weeklyReport" ? `legacy-${item.id}` : ""}',
          troubleshootingGuideId: '${item.kind === "guide" ? `legacy-${item.id}` : ""}', ${item.extra}
        })];
        openSite('Msheireb', '${item.tab}');
      `);
      const labels = [...instance.window.document.querySelectorAll("#site-profile tbody .file-actions button")].map((button) => button.getAttribute("aria-label"));
      expect(labels.map((label) => label.split(" ")[0])).toEqual(["View", "Download", "Edit", "Delete"]);
      instance.window.document.querySelector(`[data-legacy-content-edit="legacy-${item.id}"]`).click();
      expect(instance.window.document.getElementById("modal-form").dataset.mode).toBe("edit");
      expect(instance.run("state.currentContentRecordId")).toBe("");
      expect(instance.run("state.currentLegacyContentId")).toBe(`legacy-${item.id}`);
      const titleField = instance.window.document.getElementById(item.kind === "document" ? "document-title" : item.kind === "weeklyReport" ? "report-title" : "guide-title");
      titleField.value = `${item.title} Updated`;
      await instance.run(`simulateUpdate('${item.kind === "document" ? "document" : item.kind === "weeklyReport" ? "weeklyReport" : "guide"}', 'edit')`);
      expect(instance.run("state.uploads[0].title")).toBe(`${item.title} Updated`);
      expect(instance.run("state.uploads[0].recordId || ''")).toBe("");
      instance.run("closeModal()");
      instance.window.document.querySelector(`[data-legacy-content-delete="legacy-${item.id}"]`).click();
      expect(instance.window.document.getElementById("modal-form").dataset.type).toBe("legacyContentDelete");
      instance.window.document.getElementById("content-delete-confirmation").value = "DELETE";
      await instance.run('simulateUpdate("legacyContentDelete", "edit")');
      expect(instance.run("state.uploads.length")).toBe(0);
      instance.dom.window.close();
    });
  }
});
