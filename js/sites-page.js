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
