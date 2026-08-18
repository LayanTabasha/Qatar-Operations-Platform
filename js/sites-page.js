async function loadOperationalData() {
  state.backendLoading = true;
  state.backendError = "";
  buildSites();
  const homepageRequestsPromise = Promise.resolve().then(loadHomepageRequests).catch((error) => {
    console.error("Homepage Requests loading failed", error);
  });

  try {
    const [sitesResponse, activeChargersResponse, maintenanceChargersResponse, faultedChargersResponse, siteVisitsResponse, faultsResponse, dtcResponse, documentsResponse, weeklyReportsResponse, troubleshootingResponse, contactsResponse] = await Promise.all([
      window.QatarOpsApi.Sites.list({ status: "active", limit: 100 }),
      window.QatarOpsApi.Chargers.list({ status: "active", limit: 100 }),
      window.QatarOpsApi.Chargers.list({ status: "maintenance", limit: 100 }),
      window.QatarOpsApi.Chargers.list({ status: "faulted", limit: 100 }),
      window.QatarOpsApi.SiteVisits.list({ limit: 100 }),
      window.QatarOpsApi.Faults.list({ limit: 500 }),
      window.QatarOpsApi.Dtc.list({ status: "all", limit: 100 }),
      window.QatarOpsApi.ContentRecords.list("documents"), window.QatarOpsApi.ContentRecords.list("weekly-reports"), window.QatarOpsApi.ContentRecords.list("troubleshooting"), window.QatarOpsApi.Contacts.list({ limit: 500 }),
    ]);
    const chargers = sortChargersForDisplay((activeChargersResponse.chargers || []).map(mapBackendCharger));
    state.dashboardChargers = sortChargersForDisplay([activeChargersResponse, maintenanceChargersResponse, faultedChargersResponse]
      .flatMap((response) => response.chargers || [])
      .map(mapBackendCharger));
    state.sites = (sitesResponse.sites || []).map((site) => mapBackendSite(site, chargers));
    state.visits = (siteVisitsResponse.site_visits || []).map(mapBackendSiteVisit);
    state.faults = (faultsResponse.faults || []).map(normalizeFaultRecord);
    state.faultCatalogue = (dtcResponse.dtc_records || []).map(normalizeFaultCatalogueRecord);
    state.contacts = contactsResponse.contacts || [];
    const backendContentUploads = [
      ...(documentsResponse.records || []).map((record) => mapContentRecord(record, "document")),
      ...(weeklyReportsResponse.records || []).map((record) => mapContentRecord(record, "weeklyReport")),
      ...(troubleshootingResponse.records || []).map((record) => mapContentRecord(record, "guide")),
    ];
    const faultUploads = state.faults.flatMap((fault) => (fault.attachmentRecords || []).map((attachment) => mapBackendAttachment(attachment, { module: "fault", kind: "fault", faultId: fault.faultId, parentId: fault.id, siteName: fault.siteName, chargerId: fault.chargerId, chargerName: fault.chargerName })));
    const legacyContentUploads = state.uploads.filter((file) => !file.persisted && !file.recordPersisted && file.module !== "siteVisit" && file.module !== "fault" && !["siteVisit", "visitReport", "fault"].includes(file.kind));
    const nonVisitUploads = reconcileLegacyContentUploads(backendContentUploads, legacyContentUploads);
    state.uploads = deduplicateSiteVisitAttachments(state.visits.flatMap((visit) => visit.attachmentRecords || []), "")
      .concat(faultUploads, backendContentUploads, nonVisitUploads);
    state.counts.chargers = chargers.length || null;
    state.counts.faults = state.faults.filter((fault) => ["Open", "In Progress"].includes(fault.status)).length;
    state.backendLoading = false;
    buildSites();
    renderContactsPage();
    renderCounts();
    renderDashboardCharts();
    refreshOpenProfiles();
    await homepageRequestsPromise;
    return true;
  } catch (err) {
    state.backendLoading = false;
    state.backendError = err.message || "The backend could not be reached.";
    buildSites();
    renderCounts();
    await homepageRequestsPromise;
    return false;
  }
}

async function removeSiteVisitReportAttachment(attachmentId) {
  await window.QatarOpsApi.Attachments.remove(attachmentId);
  let affectedVisit = null;
  state.visits.forEach((visit) => {
    if ((visit.attachmentRecords || []).some((file) => file.id === attachmentId)) affectedVisit = visit;
    visit.attachmentRecords = (visit.attachmentRecords || []).filter((file) => file.id !== attachmentId);
    visit.attachments = (visit.attachments || []).filter((id) => id !== attachmentId);
  });
  state.uploads = state.uploads.filter((file) => file.id !== attachmentId);
  refreshOpenProfiles();
  const modalType = document.getElementById("modal-form")?.dataset.type;
  if (modalType === "siteVisitDetail" && affectedVisit) openSiteVisitDetail(affectedVisit.id);
  if (modalType === "siteVisit") renderCurrentAttachment("siteVisit");
}

function siteTab(tab, site) {
  const siteRecord = getSite(site);
  if (tab === "Overview") {
    return `<div class="overview-grid compact-overview">${imageBlock(siteRecord?.image, site, "compact-image")}<div class="panel flat"><h2>Site Snapshot</h2><div class="data-list">${placeholder("Location", valueOrPlaceholder(siteRecord?.location))}${placeholder("Client / Organization", valueOrPlaceholder(siteRecord?.client))}${placeholder("Site Status", valueOrPlaceholder(siteRecord?.status))}${placeholder("Description", valueOrPlaceholder(siteRecord?.description))}${placeholder("Chargers at this site", siteRecord?.chargers?.length ? String(siteRecord.chargers.length) : "Not Available Yet")}${placeholder("Latest Activity", "To Be Updated")}${placeholder("Notes", valueOrPlaceholder(siteRecord?.notes))}</div></div></div>
      <div class="summary-grid"><article>${placeholder("Chargers", siteRecord?.chargers?.length ? String(siteRecord.chargers.length) : "Not Available Yet")}</article><article>${placeholder("Open Faults", String(state.faults.filter((fault) => fault.siteName === site && ["Open", "In Progress"].includes(fault.status)).length))}</article><article>${placeholder("Last Visit", latestVisitForSite(site))}</article><article>${placeholder("Uploaded Files", String(getValidUploads().filter((file) => file.siteName === site).length))}</article></div>`;
  }
  if (tab === "Chargers") {
    const chargers = sortChargersForDisplay(siteRecord?.chargers || []);
    const addCharger = isAdmin() && siteRecord?.id
      ? `<button class="primary-button" data-modal="charger" data-mode="create" data-site-context="${site}" data-site-id="${siteRecord.id}" data-lock-site="true" type="button">+ Add Charger</button>`
      : "";
    if (!chargers.length) {
      return `<div class="empty-state"><h2>No active chargers added yet</h2><p>Use Add Charger to create editable charger records for ${site}.</p>${addCharger}</div>`;
    }
    return `<div class="module-header"><div><h2>Chargers</h2></div><div class="quick-actions compact">${addCharger}</div></div><div class="charger-grid">${chargers.map((charger) => `<article class="charger-card">${imageBlock(charger.image, valueOrPlaceholder(charger.name), "charger-photo")}<h2>${valueOrPlaceholder(charger.name)}</h2><div class="data-list">${placeholder("Charger Type", valueOrPlaceholder(charger.type))}${placeholder("Status", valueOrPlaceholder(charger.status))}${placeholder("Manufacturer", valueOrPlaceholder(charger.manufacturer))}${placeholder("Capacity", valueOrPlaceholder(charger.capacity))}${placeholder("Operator", valueOrPlaceholder(charger.operator))}${placeholder("Administrator", valueOrPlaceholder(charger.administrator))}${placeholder("Model", valueOrPlaceholder(charger.model))}${placeholder("Serial Number", valueOrPlaceholder(charger.serialNumber))}${placeholder("Installation Date", formatDate(charger.installationDate))}${placeholder("Faults")}${placeholder("Last Visit")}</div><div class="card-actions split-actions"><button class="primary-button open-charger" data-site="${site}" data-charger="${charger.id}" type="button">Open Charger</button>${isAdmin() ? `<button class="danger-button" data-archive-active="charger" data-archive-id="${charger.id}" data-archive-name="${formatSettingValue(charger.name)}" type="button">Archive</button>` : ""}</div></article>`).join("")}</div>`;
  }
  const siteContext = { siteId: siteRecord?.id || "" };
  if (tab === "Site Visits") return recordsModule("Site Visits", [["Add new site visit", "siteVisit"]], ["Date", "Time in", "Time out", "Site", "Charger", "Purpose", "Notes", "Report file"], ["Search visits", "Filter by charger", "Filter by date"], "", siteContext);
  if (tab === "Faults") return recordsModule("Faults", [["Report fault", "fault"]], ["Fault ID", "Date", "Site", "Charger", "Fault Code", "Fault Name", "Severity", "Status", "Photos"], ["Search by Fault ID", "Filter by charger", "Filter by fault code", "Filter by status"], "Fault records support photo evidence only. General documents and reports belong in their own modules.", siteContext);
  if (tab === "Documents") return recordsModule("Documents", [["Upload charger document", "document"]], ["Document title", "Category", "Related site", "Related charger", "Uploaded by", "Upload date", "Actions"], ["Search charger documents", "Filter by document type", "Filter by charger"], "", siteContext);
  if (tab === "Weekly Reports") return recordsModule("Weekly Reports", [["Upload weekly report", "weeklyReport"]], ["Week number", "Date range", "Related site", "Related charger", "Uploaded by", "Upload date", "Summary", "Attachment", "Actions"], ["View reports by week", "Filter by charger"], "", siteContext);
  return recordsModule("Troubleshooting", [["Add troubleshooting guide", "guide"]], ["Guide title", "Category", "Version", "Related charger", "Uploaded by", "Upload date", "Actions"], ["Search guides", "Filter by charger", "Filter by category"], "", siteContext);
}

function openSite(site, initialTab = "Overview") {
  if (!requireAuth()) return;
  const profile = document.getElementById("site-profile");
  document.getElementById("charger-profile").classList.add("hidden");
  const tabs = ["Overview", "Chargers", "Site Visits", "Faults", "Documents", "Weekly Reports", "Troubleshooting"];
  if (!tabs.includes(initialTab)) initialTab = "Overview";
  state.currentSiteName = site;
  state.currentChargerId = "";
  state.currentSiteTab = initialTab;
  const siteRecord = getSite(site);
  profile.classList.remove("hidden");
  if (initialTab === "Site Visits") closeModal();
  profile.innerHTML = `<div class="profile-head compact-profile-head">
    <div><p class="eyebrow">Site Profile</p><h1>${site}</h1></div>
    <div class="profile-meta">
      <span>Status: ${valueOrPlaceholder(siteRecord?.status)}</span><span>Location: ${valueOrPlaceholder(siteRecord?.location)}</span><span>Last updated: To Be Updated</span>
    </div>
    <div class="charger-profile-actions">${isAdmin() ? `<button class="secondary-button" data-modal="site" data-mode="edit" data-site-context="${site}" type="button">Edit Site</button>` : ""}${isAdmin() ? `<button class="danger-button" data-archive-active="site" data-archive-id="${siteRecord?.id}" data-archive-name="${formatSettingValue(site)}" type="button">Archive</button>` : ""}</div>
  </div><div class="subtabs">${tabs.map((tab) => `<button class="${tab === initialTab ? "active" : ""}" data-tab="${tab}" type="button">${tab}</button>`).join("")}</div><div class="tab-body">${siteTab(initialTab, site)}</div>`;
  profile.querySelector(".subtabs").addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    profile.querySelectorAll(".subtabs button").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    state.currentSiteTab = button.dataset.tab;
    const tabBody = profile.querySelector(".tab-body");
    try {
      if (button.dataset.tab === "Site Visits") closeModal();
      tabBody.innerHTML = siteTab(button.dataset.tab, site);
    } catch (error) {
      console.error("Site tab render failed", error);
      tabBody.innerHTML = `<div class="empty-state"><h2>Site Visits could not be displayed</h2><p>${safeDetailValue(error.message || "Unexpected rendering error")}</p></div>`;
    } finally {
      if (button.dataset.tab === "Site Visits") {
        document.getElementById("modal-backdrop")?.classList.add("hidden");
        document.body.classList.remove("modal-open", "is-loading");
      }
    }
    saveViewContext({ route: "sites", siteName: state.currentSiteName, chargerId: "", siteTab: state.currentSiteTab });
  });
  saveViewContext({ route: "sites", siteName: state.currentSiteName, chargerId: "", siteTab: state.currentSiteTab });
  profile.scrollIntoView({ behavior: "smooth", block: "start" });
}

function chargerTab(tab, site, chargerId = state.currentChargerId) {
  const charger = getCharger(site, chargerId);
  if (tab === "Overview") {
    return `<div class="overview-grid compact-overview">${imageBlock(charger?.image, "Charger Photo", "compact-image charger-overview-image")}<div class="panel flat"><h2>Charger Snapshot</h2><div class="data-list">${placeholder("Site", site)}${placeholder("Charger Name", valueOrPlaceholder(charger?.name))}${placeholder("Charger Type", valueOrPlaceholder(charger?.type))}${placeholder("Status", valueOrPlaceholder(charger?.status))}${placeholder("Manufacturer", valueOrPlaceholder(charger?.manufacturer))}${placeholder("Capacity", valueOrPlaceholder(charger?.capacity))}${placeholder("Installation Date", formatDate(charger?.installationDate))}${placeholder("Operator", valueOrPlaceholder(charger?.operator))}${placeholder("Administrator", valueOrPlaceholder(charger?.administrator))}${placeholder("Model", valueOrPlaceholder(charger?.model))}${placeholder("Serial Number", valueOrPlaceholder(charger?.serialNumber))}${placeholder("Notes", valueOrPlaceholder(charger?.notes))}${placeholder("Faults")}${placeholder("Last Visit")}</div></div></div>`;
  }
  const modal = tab === "Faults" ? "fault" : tab === "Documents" ? "document" : tab === "Weekly Reports" ? "weeklyReport" : tab === "Troubleshooting" ? "guide" : "siteVisit";
  const label = tab === "Faults" ? "Report fault" : tab === "Site Visits" ? "Add site visit" : "Upload";
  return recordsModule(tab, [[label, modal]], ["Date", "Site", "Charger", "Uploaded by", "Status", "Attachments", "Actions"], ["Search", "Filter by date", "Filter by status"], "", {
    siteId: getSite(site)?.id || "",
    chargerId: charger?.id || chargerId,
  });
}

function openCharger(site, chargerId, initialTab = "Overview") {
  if (!requireAuth()) return;
  const profile = document.getElementById("charger-profile");
  const tabs = ["Overview", "Site Visits", "Faults", "Documents", "Weekly Reports", "Troubleshooting"];
  if (!tabs.includes(initialTab)) initialTab = "Overview";
  state.currentSiteName = site;
  state.currentChargerId = chargerId;
  state.currentChargerTab = initialTab;
  const charger = getCharger(site, chargerId);
  profile.classList.remove("hidden");
  profile.innerHTML = `<div class="profile-head compact-profile-head"><div><p class="eyebrow">Charger Profile</p><h1>${valueOrPlaceholder(charger?.name)}</h1></div><div class="profile-meta"><span>Site: ${site}</span><span>Status: ${valueOrPlaceholder(charger?.status)}</span><span>Type: ${valueOrPlaceholder(charger?.type)}</span></div><div class="charger-profile-actions">${isAdmin() ? `<button class="secondary-button" data-modal="charger" type="button">Edit Charger Information</button>` : ""}${isAdmin() ? `<button class="danger-button" data-archive-active="charger" data-archive-id="${charger?.id}" data-archive-name="${formatSettingValue(charger?.name)}" type="button">Archive</button>` : ""}</div></div><div class="subtabs">${tabs.map((tab) => `<button class="${tab === initialTab ? "active" : ""}" data-tab="${tab}" type="button">${tab}</button>`).join("")}</div><div class="tab-body">${chargerTab(initialTab, site, chargerId)}</div>`;
  profile.querySelector(".subtabs").addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    profile.querySelectorAll(".subtabs button").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    state.currentChargerTab = button.dataset.tab;
    profile.querySelector(".tab-body").innerHTML = chargerTab(button.dataset.tab, site, chargerId);
    saveViewContext({ route: "sites", siteName: state.currentSiteName, chargerId: state.currentChargerId, chargerTab: state.currentChargerTab });
  });
  saveViewContext({ route: "sites", siteName: state.currentSiteName, chargerId: state.currentChargerId, chargerTab: state.currentChargerTab });
  profile.scrollIntoView({ behavior: "smooth", block: "start" });
}

function removeCurrentCharger() {
  const site = getSite(state.currentSiteName);
  if (!site || !state.currentChargerId) return;
  site.chargers = site.chargers.filter((charger) => charger.id !== state.currentChargerId);
  state.currentChargerId = "";
  state.counts.chargers = state.sites.reduce((total, item) => total + (item.chargers?.length || 0), 0) || null;
  renderCounts();
  buildSites();
  document.getElementById("charger-profile").classList.add("hidden");
  if (!document.getElementById("site-profile").classList.contains("hidden")) {
    const siteTabBeforeDelete = state.currentSiteTab === "Chargers" ? "Chargers" : state.currentSiteTab;
    openSite(state.currentSiteName);
    const tabButton = Array.from(document.querySelectorAll("#site-profile .subtabs button")).find((button) => button.dataset.tab === siteTabBeforeDelete);
    if (tabButton) tabButton.click();
  }
}


function refreshOpenProfiles() {
  if (!state.currentSiteName) return;
  const siteProfile = document.getElementById("site-profile");
  const chargerProfile = document.getElementById("charger-profile");
  const siteTab = state.currentSiteTab;
  const chargerTab = state.currentChargerTab;
  if (state.currentChargerId && !chargerProfile.classList.contains("hidden")) {
    openCharger(state.currentSiteName, state.currentChargerId);
    const tabButton = Array.from(chargerProfile.querySelectorAll(".subtabs button")).find((button) => button.dataset.tab === chargerTab);
    if (tabButton) tabButton.click();
    return;
  }
  if (!siteProfile.classList.contains("hidden")) {
    openSite(state.currentSiteName);
    const tabButton = Array.from(siteProfile.querySelectorAll(".subtabs button")).find((button) => button.dataset.tab === siteTab);
    if (tabButton) tabButton.click();
  }
}
