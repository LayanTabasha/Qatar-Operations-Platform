const siteListFilters = { search: "", status: "" };
const operationalRecordFilters = new Map();

function normalizedFilterText(value) {
  return String(value ?? "").trim().toLowerCase();
}

function includesFilterText(values, query) {
  const normalizedQuery = normalizedFilterText(query);
  return !normalizedQuery || values.some((value) => normalizedFilterText(value).includes(normalizedQuery));
}

function sitesFilterControl(target) {
  if (!target?.closest?.("#sites .site-header-tools")) return "";
  if (target.matches?.('#sites .site-header-tools input[type="search"]')) return "search";
  if (target.matches?.("#sites .site-header-tools select")) return "status";
  return "";
}

function handleSitesFilterEvent(event) {
  const filterName = sitesFilterControl(event.target);
  if (!filterName) return;
  siteListFilters[filterName] = event.target.value;
  buildSites();
}

function bindSitesFilters() {
  if (typeof document === "undefined" || document.documentElement?.dataset.sitesFiltersBound === "true") return;
  if (document.documentElement) document.documentElement.dataset.sitesFiltersBound = "true";
  document.addEventListener("input", (event) => {
    if (sitesFilterControl(event.target) === "search") handleSitesFilterEvent(event);
  });
  document.addEventListener("change", (event) => {
    if (sitesFilterControl(event.target) === "status") handleSitesFilterEvent(event);
  });
}

bindSitesFilters();

function buildSites() {
  const siteList = document.getElementById("site-list");
  const searchInput = document.querySelector('#sites .site-header-tools input[type="search"]');
  const statusFilter = document.querySelector("#sites .site-header-tools select");
  if (searchInput && searchInput.value !== siteListFilters.search) searchInput.value = siteListFilters.search;
  if (statusFilter) {
    const selectedStatus = siteListFilters.status;
    const statuses = Array.from(new Set(state.sites.map((site) => site.status).filter(Boolean))).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
    statusFilter.innerHTML = `<option value="">Filter by status</option>${statuses.map((status) => filterOption(status, selectedStatus)).join("")}`;
  }
  document.getElementById("add-site-button")?.classList.toggle("hidden", !isAdmin());
  if (state.backendLoading) {
    siteList.innerHTML = `<div class="empty-state"><h2>Loading sites...</h2><p>Fetching sites and chargers from the Qatar Operations backend.</p></div>`;
    return;
  }
  if (state.backendError) {
    siteList.innerHTML = `<div class="empty-state"><h2>Could not load sites</h2><p>${state.backendError}</p><button class="primary-button" id="retry-operational-data" type="button">Retry</button></div>`;
    return;
  }
  if (!state.sites.length) {
    siteList.innerHTML = `<div class="empty-state"><h2>No sites found</h2><p>No active site records are available from the backend yet.</p></div>`;
    return;
  }

  const filteredSites = state.sites.filter((site) => {
    const matchesSearch = includesFilterText([site.name, site.code, site.location, site.address, site.client, site.description], siteListFilters.search);
    const matchesStatus = !siteListFilters.status || normalizedFilterText(site.status) === normalizedFilterText(siteListFilters.status);
    return matchesSearch && matchesStatus;
  });
  if (!filteredSites.length) {
    siteList.innerHTML = `<div class="empty-state"><h2>No sites match the selected filters</h2><p>Try a different search or status.</p></div>`;
    return;
  }

  siteList.innerHTML = filteredSites.map((site) => `
    <article class="site-card">
      ${imageBlock(site.image, site.name)}
      <div class="site-content">
        <div class="card-heading"><h2>${site.name}</h2><span class="status-pill warning">${site.status}</span></div>
        <div class="data-list">
          ${placeholder("Location", site.location || "To Be Updated")}
          ${placeholder("Site Status", site.status || "Pending Data")}
          ${placeholder("Number of Chargers", valueOrPlaceholder(String(site.chargerCount ?? site.chargers?.length ?? "")))}
          ${placeholder("Open Faults", String(site.openFaultCount ?? state.faults.filter((fault) => fault.siteName === site.name && ["Open", "In Progress"].includes(fault.status)).length))}
          ${placeholder("Last Visit", site.lastSiteVisit ? formatDate(site.lastSiteVisit) : latestVisitForSite(site.name))}
        </div>
        <div class="card-actions site-card-actions">
          ${isAdmin() ? `<button class="secondary-button" data-modal="site" data-mode="edit" data-site-context="${site.name}" type="button">Edit</button>` : ""}
          <button class="primary-button open-site" data-site="${site.name}" type="button">Open Site</button>
          ${isAdmin() ? `<button class="danger-button" data-archive-active="site" data-archive-id="${site.id}" data-archive-name="${formatSettingValue(site.name)}" type="button">Archive</button>` : ""}
        </div>
      </div>
    </article>`).join("");
}

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

function latestVisitForSite(siteName) {
  const visit = state.visits.filter((item) => item.siteName === siteName).sort((a, b) => new Date(getRecordDate(b)).getTime() - new Date(getRecordDate(a)).getTime())[0];
  return visit ? formatDate(visit.visitDate || visit.createdAt) : "Not Available Yet";
}

function uploadKindForTitle(title) {
  if (title === "Site Visits") return ["siteVisit", "visitReport"];
  if (title === "Faults") return ["fault"];
  if (title === "Documents") return ["document"];
  if (title === "Weekly Reports") return ["weeklyReport"];
  return ["guide"];
}

function fileIcon(type) {
  const paths = {
    download: `<path d="M12 3v11m0 0 4-4m-4 4-4-4M5 19h14"/>`,
    edit: `<path d="m4 16-.8 4 4-.8L18.5 7.9l-3.4-3.4L4 16Z"/><path d="m13.8 5.8 3.4 3.4"/>`,
    delete: `<path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5"/>`,
    preview: `<path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="3"/>`,
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[type] || paths.preview}</svg>`;
}

function moduleFilterKey(title) {
  return [state.currentSiteName || "all-sites", state.currentChargerId || "all-chargers", title].join("::");
}

function moduleFilters(title) {
  const key = moduleFilterKey(title);
  if (!operationalRecordFilters.has(key)) operationalRecordFilters.set(key, { search: "", charger: "", date: "", status: "", faultCode: "", documentType: "", category: "" });
  return operationalRecordFilters.get(key);
}

function baseFilesForTitle(title) {
  const allowedKinds = uploadKindForTitle(title);
  return getValidUploads().filter((file) => allowedKinds.includes(file.kind) && (!state.currentSiteName || file.siteName === state.currentSiteName) && (!state.currentChargerId || file.chargerId === state.currentChargerId));
}

function filteredFiles(title) {
  const filters = moduleFilters(title);
  return baseFilesForTitle(title).filter((file) => {
    const matchesSearch = includesFilterText([file.title, file.name, file.category, file.documentType, file.guideCategory, file.guideVersion, file.siteName, file.chargerName, file.uploadedBy, file.weekStart, file.weekEnd], filters.search);
    const matchesCharger = !filters.charger || String(file.chargerId || file.chargerName || "") === filters.charger;
    const matchesDate = !filters.date || String(file.uploadedAt || file.weekStart || "").slice(0, 10) === filters.date;
    const matchesStatus = !filters.status || normalizedFilterText(file.status) === normalizedFilterText(filters.status);
    const matchesDocumentType = !filters.documentType || normalizedFilterText(file.documentType || file.category) === normalizedFilterText(filters.documentType);
    const matchesCategory = !filters.category || normalizedFilterText(file.guideCategory || file.category) === normalizedFilterText(filters.category);
    return matchesSearch && matchesCharger && matchesDate && matchesStatus && matchesDocumentType && matchesCategory;
  });
}

function fileRows(title) {
  const files = filteredFiles(title);
  if (!files.length) return `<tr><td colspan="7">No ${title.toLowerCase()} uploaded yet.</td></tr>`;
  if (title === "Weekly Reports") {
    return files.map((file) => `<tr><td>${valueOrPlaceholder(file.title)}</td><td>${formatDate(file.weekStart)} - ${formatDate(file.weekEnd)}</td><td>${valueOrPlaceholder(file.chargerName)}</td><td>${valueOrPlaceholder(file.name)}</td><td>${formatDate(file.uploadedAt)}</td><td>${valueOrPlaceholder(file.uploadedBy)}</td><td>${fileActionButtons(file, "weekly report")}</td></tr>`).join("");
  }
  if (title === "Troubleshooting") {
    return files.map((file) => `<tr><td>${valueOrPlaceholder(file.title)}</td><td>${valueOrPlaceholder(file.guideCategory)}</td><td>${valueOrPlaceholder(file.guideVersion)}</td><td>${valueOrPlaceholder(file.chargerName)}</td><td>${valueOrPlaceholder(file.name)}</td><td>${formatDate(file.uploadedAt)}</td><td>${fileActionButtons(file, "troubleshooting guide")}</td></tr>`).join("");
  }
  return files.map((file) => `<tr><td>${valueOrPlaceholder(file.title)}</td><td>${valueOrPlaceholder(file.category)}</td><td>${valueOrPlaceholder(file.documentType)}</td><td>${valueOrPlaceholder(file.name)}</td><td>${valueOrPlaceholder(file.chargerName)}</td><td>${formatDate(file.uploadedAt)}</td><td>${fileActionButtons(file, "document")}</td></tr>`).join("");
}

function fileActionButtons(file, label = "file") {
  const hasPersistedRecord = Boolean(file.recordId) && file.recordPersisted === true;
  if (hasPersistedRecord) {
    const type = file.kind === "document" ? "documents" : file.kind === "weeklyReport" ? "weekly-reports" : "troubleshooting";
    const hasAttachment = file.attachmentPersisted === true && file.persisted === true;
    const view = `<button class="file-icon-button" data-content-view="${file.recordId}" data-content-type="${type}" aria-label="View ${label}" title="View" type="button">${fileIcon("preview")}</button>${hasAttachment ? `<button class="file-icon-button" data-file-download="${file.id}" aria-label="Download ${label}" title="Download" type="button">${fileIcon("download")}</button>` : ""}`;
    const manage = canManageOperations() ? `<button class="file-icon-button" data-content-edit="${file.recordId}" data-content-type="${type}" aria-label="Edit ${label}" title="Edit" type="button">${fileIcon("edit")}</button><button class="file-icon-button danger-button" data-content-delete="${file.recordId}" data-content-type="${type}" aria-label="Delete ${label}" title="Delete" type="button">${fileIcon("delete")}</button>` : "";
    return `<div class="file-actions">${view}${manage}</div>`;
  }
  const remove = file.persisted && file.siteVisitId && canManageOperations()
    ? `<button class="file-icon-button danger-button" data-attachment-remove="${file.id}" aria-label="Remove ${label}" data-tooltip="Remove" type="button">×</button>` : "";
  const legacyKind = file.kind === "document" ? "document" : file.kind === "weeklyReport" ? "weeklyReport" : file.kind === "guide" ? "guide" : "";
  const legacyManage = legacyKind && canManageOperations()
    ? `<button class="file-icon-button" data-legacy-content-edit="${file.id}" data-legacy-content-kind="${legacyKind}" aria-label="Edit ${label}" title="Edit" type="button">${fileIcon("edit")}</button><button class="file-icon-button danger-button" data-legacy-content-delete="${file.id}" aria-label="Delete ${label}" title="Delete" type="button">${fileIcon("delete")}</button>`
    : "";
  return `<div class="file-actions"><button class="file-icon-button" data-file-preview="${file.id}" aria-label="View ${label}" title="View" type="button">${fileIcon("preview")}</button><button class="file-icon-button" data-file-download="${file.id}" aria-label="Download ${label}" title="Download" type="button">${fileIcon("download")}</button>${legacyManage}${remove}</div>`;
}

function contentRecord(type, recordId) {
  return state.uploads.find((file) => file.recordId === recordId && ({ document: "documents", weeklyReport: "weekly-reports", guide: "troubleshooting" })[file.kind] === type);
}

function contentTypeLabel(type) {
  return ({ documents: "Document", "weekly-reports": "Weekly Report", troubleshooting: "Troubleshooting Record" })[type] || "Record";
}

function openContentRecordDetail(type, recordId) {
  const record = contentRecord(type, recordId);
  if (!record) return alert("This record is no longer available.");
  const attachment = record.persisted
    ? `<div class="attached-file"><span>${safeDetailValue(record.name)}</span><div class="file-actions"><button class="secondary-button" data-file-preview="${record.id}" type="button">Preview</button><button class="secondary-button" data-file-download="${record.id}" type="button">Download</button></div></div>`
    : "—";
  const moduleRows = type === "documents"
    ? detailRow("Category / type", record.documentType) + detailRow("Document date", record.documentDate) + detailRow("Description", record.description)
    : type === "weekly-reports"
      ? detailRow("Week start", record.weekStart) + detailRow("Week end", record.weekEnd) + detailRow("Summary / notes", record.notes || record.description)
      : detailRow("Category", record.guideCategory) + detailRow("Symptoms", record.symptoms) + detailRow("Possible cause", record.possibleCause) + detailRow("Troubleshooting steps", record.troubleshootingSteps) + detailRow("Resolution", record.resolution) + detailRow("Notes", record.notes);
  document.querySelector(".modal")?.classList.remove("preview-modal");
  document.getElementById("modal-title").textContent = record.title || contentTypeLabel(type);
  document.getElementById("modal-eyebrow").textContent = `${contentTypeLabel(type)} Details`;
  document.getElementById("modal-form").innerHTML = `<div class="data-list">${detailRow("Title", record.title)}${detailRow("Related site", record.siteName)}${type === "weekly-reports" ? "" : detailRow("Charger", record.chargerName)}${moduleRows}<div class="data-row"><span>Attachment</span><strong>${attachment}</strong></div></div><div class="modal-actions"><button class="secondary-button" type="button" id="cancel-modal">Close</button>${canManageOperations() ? `<button class="primary-button" data-content-edit="${recordId}" data-content-type="${type}" type="button">Edit</button>` : ""}</div>`;
  document.getElementById("modal-backdrop").classList.remove("hidden");
  resetModalScroll();
}

function openContentDeleteConfirmation(type, recordId) {
  if (!canManageOperations()) return alert("Your account cannot delete this record.");
  const record = contentRecord(type, recordId);
  if (!record) return alert("This record is no longer available.");
  const form = document.getElementById("modal-form");
  document.querySelector(".modal")?.classList.remove("preview-modal");
  document.getElementById("modal-title").textContent = `Delete ${contentTypeLabel(type)}`;
  document.getElementById("modal-eyebrow").textContent = "Permanent deletion";
  form.dataset.type = "contentDelete";
  form.dataset.contentType = type;
  form.dataset.recordId = recordId;
  form.innerHTML = `<p class="modal-note">This permanently deletes the record${record.persisted ? " and its managed attachment" : ""}. This action cannot be undone.</p><div class="data-list">${detailRow("Record title", record.title)}${detailRow("Record type", contentTypeLabel(type))}${detailRow("Related site", record.siteName)}${detailRow("Attachment removed", record.persisted ? `Yes — ${record.name}` : "No attachment")}</div><label class="full"><span>Type DELETE to confirm</span><input id="content-delete-confirmation" autocomplete="off" data-required="true" /></label><div class="modal-actions"><button class="secondary-button" type="button" id="cancel-modal">Cancel</button><button class="danger-button" type="submit" data-loading-text="Deleting...">Permanently Delete</button></div>`;
  document.getElementById("modal-backdrop").classList.remove("hidden");
  resetModalScroll();
}

function openLegacyContentDeleteConfirmation(fileId) {
  if (!canManageOperations()) return alert("Your account cannot delete this record.");
  const record = state.uploads.find((file) => file.id === fileId && !file.recordPersisted);
  if (!record) return alert("This record is no longer available.");
  const form = document.getElementById("modal-form");
  document.querySelector(".modal")?.classList.remove("preview-modal");
  document.getElementById("modal-title").textContent = `Delete ${record.kind === "weeklyReport" ? "Weekly Report" : record.kind === "guide" ? "Troubleshooting Record" : "Document"}`;
  document.getElementById("modal-eyebrow").textContent = "Legacy browser record";
  form.dataset.type = "legacyContentDelete";
  form.dataset.fileId = fileId;
  form.innerHTML = `<div class="modal-error" id="modal-error"></div><p class="modal-note">This permanently removes this early-testing record and its browser-stored file from this browser. It has no backend record ID, so no server record or server file will be deleted.</p><div class="data-list">${detailRow("Record title", record.title)}${detailRow("File", record.name)}${detailRow("Related site", record.siteName)}</div><label class="full"><span>Type DELETE to confirm</span><input id="content-delete-confirmation" autocomplete="off" data-required="true" /></label><div class="modal-actions"><button class="secondary-button" type="button" id="cancel-modal">Cancel</button><button class="danger-button" type="submit" data-loading-text="Deleting...">Delete</button></div>`;
  document.getElementById("modal-backdrop").classList.remove("hidden");
  resetModalScroll();
}

function openOperationalDeleteConfirmation(type, recordId) {
  if (!canManageOperations()) return alert("Your account cannot delete this record.");
  const record = type === "siteVisit" ? state.visits.find((item) => item.id === recordId) : state.faults.find((item) => item.id === recordId);
  if (!record) return alert("This record is no longer available.");
  const title = type === "siteVisit" ? record.purpose : record.faultId || record.faultName;
  const attachments = type === "siteVisit" ? deduplicateSiteVisitAttachments(record.attachmentRecords || [], record.id) : record.attachmentRecords || [];
  const form = document.getElementById("modal-form");
  document.querySelector(".modal")?.classList.remove("preview-modal");
  document.getElementById("modal-title").textContent = `Delete ${type === "siteVisit" ? "Site Visit" : "Fault"}`;
  document.getElementById("modal-eyebrow").textContent = type === "fault" ? "Archive operational record" : "Permanent deletion";
  form.dataset.type = "operationalDelete";
  form.dataset.deleteType = type;
  form.dataset.recordId = recordId;
  form.innerHTML = `<p class="modal-note">${type === "fault" ? "This removes the fault from normal operational views while preserving audit history." : "This permanently deletes the Site Visit and its managed report."}</p><div class="data-list">${detailRow("Record type", type === "siteVisit" ? "Site Visit" : "Fault")}${detailRow("Record title / reference", title)}${detailRow("Related site", record.siteName)}${detailRow("Related charger", record.chargerName || "No charger")}${detailRow("Attachment removed", attachments.length ? `Yes — ${attachments.length} managed file(s)` : type === "fault" ? "Photos retained with archived history and hidden from normal access" : "No attachment")}</div><label class="full"><span>Type DELETE to confirm</span><input id="operational-delete-confirmation" autocomplete="off" data-required="true" /></label><div class="modal-actions"><button class="secondary-button" type="button" id="cancel-modal">Cancel</button><button class="danger-button" type="submit" data-loading-text="Deleting...">Delete</button></div>`;
  document.getElementById("modal-backdrop").classList.remove("hidden");
  resetModalScroll();
}

if (typeof document !== "undefined") document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-operational-delete]");
  if (button) openOperationalDeleteConfirmation(button.dataset.deleteType, button.dataset.operationalDelete);
});

function hasBackendAttachmentId(file) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(file?.id || ""));
}

function canRemoveSiteVisitAttachment(file) {
  return hasBackendAttachmentId(file) && canManageOperations();
}

function siteVisitRemoveControl(file, label = "Remove") {
  if (canRemoveSiteVisitAttachment(file)) return `<button class="danger-button" data-site-visit-report-remove="${file.id}" type="button">${label}</button>`;
  const reason = hasBackendAttachmentId(file) ? "Your account cannot remove Site Visit reports" : "Remove unavailable: backend attachment ID is missing";
  return `<button class="danger-button" type="button" disabled title="${reason}">${label}</button>`;
}

function baseFaultRecords() {
  return state.faults.filter((fault) => (!state.currentSiteName || fault.siteName === state.currentSiteName) && (!state.currentChargerId || fault.chargerId === state.currentChargerId));
}

function filteredFaultRecords() {
  const filters = moduleFilters("Faults");
  return baseFaultRecords().filter((fault) => includesFilterText([fault.faultId, fault.faultCode, fault.faultName, fault.title, fault.description, fault.siteName, fault.chargerName, fault.severity, fault.status], filters.search)
    && (!filters.charger || String(fault.chargerId || fault.chargerName || "") === filters.charger)
    && (!filters.date || String(fault.reportedAt || "").slice(0, 10) === filters.date)
    && (!filters.status || normalizedFilterText(fault.status) === normalizedFilterText(filters.status))
    && (!filters.faultCode || normalizedFilterText(fault.faultCode) === normalizedFilterText(filters.faultCode)));
}

function faultRecordRows() {
  const records = filteredFaultRecords();
  if (!records.length) return `<tr><td colspan="10">No fault records entered yet.</td></tr>`;
  return records.map((fault) => `<tr>
    <td>${valueOrPlaceholder(fault.faultId)}</td>
    <td>${formatDate(fault.reportedAt)}</td>
    <td>${valueOrPlaceholder(fault.siteName)}</td>
    <td>${valueOrPlaceholder(fault.chargerName)}</td>
    <td>${fault.faultCode ? safeDetailValue(fault.faultCode) : "—"}</td>
    <td>${valueOrPlaceholder(fault.faultName)}</td>
    <td>${normalizedFaultSeverity(fault.severity)}</td>
    <td>${canManageOperations() ? `<select class="inline-select" data-fault-status="${fault.id}">${FAULT_STATUS_OPTIONS.map((status) => `<option${status === fault.status ? " selected" : ""}>${status}</option>`).join("")}</select>` : safeDetailValue(fault.status)}</td>
    <td>${faultPhotosMarkup(fault)}</td>
    <td><div class="file-actions"><button class="secondary-button" data-fault-detail="${fault.id}" type="button">View Details</button>${canManageOperations() ? `<button class="secondary-button" data-modal="fault" data-mode="edit" data-fault-id="${fault.id}" type="button">Edit</button><button class="danger-button" data-operational-delete="${fault.id}" data-delete-type="fault" type="button">Delete</button>` : ""}</div></td>
  </tr>`).join("");
}

function faultPhotosMarkup(fault) {
  const files = getValidUploads().filter((file) => file.faultId === fault.faultId && file.module === "fault");
  if (!files.length) return "No photos attached";
  return `<div class="fault-photo-list">${files.map((file) => `<div class="fault-photo-item">${file.dataUrl ? `<img src="${file.dataUrl}" alt="${safeDetailValue(file.name || "Fault photo")}" />` : ""}<span>${safeDetailValue(file.name || "Fault photo")}</span><div class="file-actions"><button class="secondary-button" data-file-preview="${file.id}" type="button">View</button><button class="secondary-button" data-file-download="${file.id}" type="button">Download</button></div></div>`).join("")}</div>`;
}

function baseVisitRecords() {
  return state.visits.filter((visit) => (!state.currentSiteName || visit.siteName === state.currentSiteName) && (!state.currentChargerId || visit.chargerId === state.currentChargerId));
}

function filteredVisitRecords() {
  const filters = moduleFilters("Site Visits");
  return baseVisitRecords().filter((visit) => includesFilterText([visit.id, visit.siteName, visit.chargerName, visit.createdBy, visit.purpose, visit.notes, visit.status, visit.recordedBy], filters.search)
    && (!filters.charger || String(visit.chargerId || visit.chargerName || "") === filters.charger)
    && (!filters.date || String(visit.visitDate || "").slice(0, 10) === filters.date)
    && (!filters.status || normalizedFilterText(visit.status) === normalizedFilterText(filters.status)));
}

function visitRecordRows() {
  const records = filteredVisitRecords();
  if (!records.length) return `<tr><td colspan="11">No site visits entered yet.</td></tr>`;
  return records.map((visit) => `<tr>
    <td>${formatMediumDate(visit.visitDate)}</td>
    <td>${visit.timeIn ? visit.timeIn : "Not Available Yet"}</td>
    <td>${visit.timeOut ? visit.timeOut : "Not Available Yet"}</td>
    <td>${valueOrPlaceholder(visit.siteName)}</td>
    <td>${valueOrPlaceholder(visit.createdBy)}</td>
    <td>${valueOrPlaceholder(visit.purpose)}</td>
    <td>${valueOrPlaceholder(visit.status)}</td>
    <td>${visitAttachmentsMarkup(visit)}</td>
    <td>${formatMediumDate(visit.recordedOn)}</td>
    <td>${valueOrPlaceholder(visit.recordedBy)}</td>
    <td><div class="file-actions"><button class="secondary-button" data-visit-detail="${visit.id}" type="button">View</button>${canManageOperations() ? `<button class="secondary-button" data-modal="siteVisit" data-mode="edit" data-visit-id="${visit.id}" type="button">Edit</button><button class="danger-button" data-operational-delete="${visit.id}" data-delete-type="siteVisit" type="button">Delete</button>` : ""}</div></td>
  </tr>`).join("");
}

function visitAttachmentsMarkup(visit) {
  const files = deduplicateSiteVisitAttachments(visit.attachmentRecords || [], visit.id);
  if (!files.length) return "No report attached";
  return `<div class="attached-files">${files.map((file) => `<div class="attached-file"><span>${valueOrPlaceholder(file.name)} <small>${valueOrPlaceholder(file.type)}</small></span><div class="file-actions"><button class="secondary-button" data-file-preview="${file.id}" type="button">View</button><button class="secondary-button" data-file-download="${file.id}" type="button">Download</button>${siteVisitRemoveControl(file)}</div></div>`).join("")}</div>`;
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

function uniqueFilterOptions(values) {
  return Array.from(new Map(values.filter(Boolean).map((value) => [normalizedFilterText(value), String(value)])).values()).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));
}

function filterOption(value, selected) {
  return `<option value="${safeDetailValue(value)}"${String(value) === String(selected) ? " selected" : ""}>${safeDetailValue(value)}</option>`;
}

function moduleFilterControls(title, requestedFilters) {
  const filters = moduleFilters(title);
  const records = title === "Faults" ? baseFaultRecords() : title === "Site Visits" ? baseVisitRecords() : baseFilesForTitle(title);
  const chargerOptions = Array.from(new Map(records.filter((item) => item.chargerId || item.chargerName).map((item) => [String(item.chargerId || item.chargerName), String(item.chargerName || item.chargerId)])).entries()).sort((left, right) => left[1].localeCompare(right[1], undefined, { numeric: true, sensitivity: "base" }));
  const statusOptions = title === "Faults" ? FAULT_STATUS_OPTIONS : uniqueFilterOptions(records.map((item) => item.status));
  const faultCodeOptions = uniqueFilterOptions(records.map((item) => item.faultCode));
  const documentTypeOptions = uniqueFilterOptions(records.map((item) => item.documentType || item.category));
  const categoryOptions = uniqueFilterOptions(records.map((item) => item.guideCategory || item.category));
  return requestedFilters.map((label) => {
    const lower = label.toLowerCase();
    if (lower.includes("charger")) return `<select data-record-filter="charger" aria-label="${label}"><option value="">${label}</option>${chargerOptions.map(([value, optionLabel]) => `<option value="${safeDetailValue(value)}"${value === filters.charger ? " selected" : ""}>${safeDetailValue(optionLabel)}</option>`).join("")}</select>`;
    if (lower.includes("fault code")) return `<select data-record-filter="faultCode" aria-label="${label}"><option value="">${label}</option>${faultCodeOptions.map((value) => filterOption(value, filters.faultCode)).join("")}</select>`;
    if (lower.includes("document type")) return `<select data-record-filter="documentType" aria-label="${label}"><option value="">${label}</option>${documentTypeOptions.map((value) => filterOption(value, filters.documentType)).join("")}</select>`;
    if (lower.includes("category")) return `<select data-record-filter="category" aria-label="${label}"><option value="">${label}</option>${categoryOptions.map((value) => filterOption(value, filters.category)).join("")}</select>`;
    if (lower.includes("status")) return `<select data-record-filter="status" aria-label="${label}"><option value="">${title === "Faults" ? "All Statuses" : label}</option>${statusOptions.map((value) => filterOption(value, filters.status)).join("")}</select>`;
    if (lower.includes("date")) return `<input data-record-filter="date" type="date" value="${safeDetailValue(filters.date)}" aria-label="${label}" />`;
    return `<input data-record-filter="search" type="search" value="${safeDetailValue(filters.search)}" placeholder="${label}" />`;
  }).join("");
}

function moduleTableBody(title) {
  return title === "Faults" ? faultRecordRows() : title === "Site Visits" ? visitRecordRows() : fileRows(title);
}

function recordsModule(title, actions, columns, filters, note = "", context = {}) {
  const uploadActions = actions.filter(([label]) => !/preview|download/i.test(label));
  const isFaults = title === "Faults";
  const isVisits = title === "Site Visits";
  const headers = isFaults
    ? ["Fault ID", "Reported", "Site", "Charger", "Fault Code", "Fault Name", "Severity", "Status", "Fault Photos", "Actions"]
    : isVisits
      ? ["Visit Date", "Time In", "Time Out", "Site", "Engineer", "Purpose", "Status", "Report / Attachment", "Recorded On", "Recorded By", "Actions"]
      : title === "Weekly Reports"
        ? ["Report Title", "Week", "Charger", "File name", "Uploaded", "Uploaded by", "Actions"]
        : title === "Troubleshooting"
          ? ["Guide Title", "Category", "Version", "Charger", "File name", "Uploaded", "Actions"]
          : ["Title", "Module Category", "Document Type", "File name", "Charger", "Uploaded", "Actions"];
  const body = moduleTableBody(title);
  const actionContext = (modal) => {
    if (!context.siteId) return "";
    const supportsCharger = ["siteVisit", "fault", "document", "guide"].includes(modal);
    const chargerId = supportsCharger ? context.chargerId || "" : "";
    return ` data-site-id="${context.siteId}"${chargerId ? ` data-charger-id="${chargerId}" data-lock-location="true"` : " data-lock-site=\"true\""}`;
  };
  return `<div class="module-header"><div><h2>${title}</h2>${note ? `<p>${note}</p>` : ""}</div>
    <div class="quick-actions compact">${uploadActions.map(([label, modal]) => `<button class="secondary-button" data-modal="${modal}" data-mode="create"${actionContext(modal)} type="button">${label}</button>`).join("")}</div></div>
    <div class="toolbar" data-record-module="${title}">${moduleFilterControls(title, filters)}</div>
    <div class="table-wrap"><table><thead><tr>${headers.map((header) => `<th>${header}</th>`).join("")}</tr></thead>
    <tbody data-record-results="${title}">${body}</tbody></table></div>`;
}

function updateOperationalRecordResults(control) {
  const toolbar = control.closest("[data-record-module]");
  if (!toolbar) return;
  const title = toolbar.dataset.recordModule;
  const filterName = control.dataset.recordFilter;
  if (!filterName) return;
  moduleFilters(title)[filterName] = control.value;
  const results = toolbar.parentElement.querySelector(`[data-record-results="${title}"]`);
  if (results) results.innerHTML = moduleTableBody(title);
}

if (typeof document !== "undefined") {
  document.addEventListener("input", (event) => {
    if (event.target.matches('[data-record-filter="search"], [data-record-filter="date"]')) updateOperationalRecordResults(event.target);
  });
  document.addEventListener("change", (event) => {
    if (event.target.matches("select[data-record-filter], input[data-record-filter='date']")) updateOperationalRecordResults(event.target);
  });
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

async function restoreArchivedCharger(chargerId) {
  try {
    await window.QatarOpsApi.Chargers.restore(chargerId);
    await loadOperationalData();
    if (state.currentSiteName) openSite(state.currentSiteName, "Chargers");
  } catch (err) {
    alert(err.message || "The charger could not be restored.");
  }
}

async function permanentlyDeleteArchivedCharger(chargerId, chargerName, chargerCode) {
  if (!isAdmin()) {
    alert("Only Administrator accounts can permanently delete archived chargers.");
    return;
  }
  const confirmation = window.prompt(`Permanently delete this charger? This action cannot be undone.\n\nType ${chargerCode || chargerName} to confirm.`);
  if (confirmation !== (chargerCode || chargerName)) return;
  try {
    await window.QatarOpsApi.Chargers.deleteArchived(chargerId);
    await loadOperationalData();
    if (state.currentSiteName) openSite(state.currentSiteName, "Chargers");
  } catch (err) {
    alert(err.message || "The archived charger could not be permanently deleted.");
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
