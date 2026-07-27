function buildSites() {
  const siteList = document.getElementById("site-list");
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

  siteList.innerHTML = state.sites.map((site) => `
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
        <div class="card-actions split-actions">
          <button class="secondary-button" data-modal="site" data-mode="edit" data-site-context="${site.name}" type="button">Edit</button>
          <button class="primary-button open-site" data-site="${site.name}" type="button">Open Site</button>
        </div>
      </div>
    </article>`).join("");
}

function imagePathWithVersion(imagePath, updatedAt) {
  if (!imagePath || !imagePath.startsWith("/uploads/") || !updatedAt) return imagePath || "";
  const separator = imagePath.includes("?") ? "&" : "?";
  return `${imagePath}${separator}v=${encodeURIComponent(updatedAt)}`;
}

function statusLabel(status) {
  const labels = {
    active: "Active",
    archived: "Archived",
    maintenance: "Maintenance",
    faulted: "Faulted",
  };
  return labels[status] || valueOrPlaceholder(status);
}

function mapBackendCharger(charger) {
  const powerValue = charger.power_kw === null || charger.power_kw === undefined ? "" : Number(charger.power_kw);
  const formattedPower = Number.isFinite(powerValue) ? (Number.isInteger(powerValue) ? String(powerValue) : powerValue.toFixed(1)) : "";
  return {
    id: charger.id,
    siteId: charger.site_id,
    siteName: charger.site_name,
    name: charger.name,
    code: charger.code,
    type: charger.type,
    manufacturer: charger.manufacturer || "",
    model: charger.model || "",
    serialNumber: charger.serial_number || "",
    capacity: formattedPower ? `${formattedPower} kW` : "",
    powerKw: charger.power_kw,
    firmwareVersion: charger.firmware_version || "",
    description: charger.description || "",
    image: charger.image_path || "",
    status: statusLabel(charger.status),
    backendStatus: charger.status,
    openFaultCount: charger.open_fault_count ?? 0,
    lastSiteVisit: charger.last_site_visit,
    createdAt: charger.created_at,
    updatedAt: charger.updated_at,
    previousStatus: statusLabel(charger.previous_status),
    archivedAt: charger.archived_at,
    archivedBy: charger.archived_by_name || "",
    restoredAt: charger.restored_at,
    restoredBy: charger.restored_by_name || "",
  };
}

function chargerDisplayRank(type) {
  if (type === "DC") return 0;
  if (type === "AC") return 1;
  return 2;
}

function compareChargersForDisplay(a, b) {
  const siteCompare = String(a.siteName || "").localeCompare(String(b.siteName || ""), undefined, { sensitivity: "base" });
  if (siteCompare !== 0) return siteCompare;

  const typeCompare = chargerDisplayRank(a.type) - chargerDisplayRank(b.type);
  if (typeCompare !== 0) return typeCompare;

  const codeA = a.code || a.name || "";
  const codeB = b.code || b.name || "";
  const codeCompare = String(codeA).localeCompare(String(codeB), undefined, { numeric: true, sensitivity: "base" });
  if (codeCompare !== 0) return codeCompare;

  return String(a.name || "").localeCompare(String(b.name || ""), undefined, { numeric: true, sensitivity: "base" });
}

function mapBackendSite(site, chargers) {
  const siteChargers = chargers
    .filter((charger) => charger.siteId === site.id || charger.siteName === site.name)
    .sort(compareChargersForDisplay);
  return {
    id: site.id,
    name: site.name,
    code: site.code,
    location: site.location || site.address || "To Be Updated",
    address: site.address || "",
    client: site.address || "Not Available Yet",
    status: statusLabel(site.status),
    backendStatus: site.status,
    description: site.description || "",
    notes: "",
    image: imagePathWithVersion(site.image_path, site.updated_at),
    chargers: siteChargers,
    chargerCount: site.charger_count ?? siteChargers.length,
    openFaultCount: site.open_fault_count ?? 0,
    lastSiteVisit: site.last_site_visit,
    createdAt: site.created_at,
    updatedAt: site.updated_at,
  };
}

async function loadOperationalData() {
  state.backendLoading = true;
  state.backendError = "";
  buildSites();

  try {
    const [sitesResponse, chargersResponse, archivedChargersResponse, siteVisitsResponse, dtcResponse] = await Promise.all([
      SitesApi.list({ status: "active", limit: 100 }),
      ChargersApi.list({ status: "active", limit: 100 }),
      ChargersApi.list({ status: "archived", limit: 100 }),
      SiteVisitsApi.list({ limit: 100 }),
      DtcApi.list({ status: "all", limit: 100 }),
    ]);
    const chargers = (chargersResponse.chargers || []).map(mapBackendCharger).sort(compareChargersForDisplay);
    state.archivedChargers = (archivedChargersResponse.chargers || []).map(mapBackendCharger).sort(compareChargersForDisplay);
    state.sites = (sitesResponse.sites || []).map((site) => mapBackendSite(site, chargers));
    state.visits = (siteVisitsResponse.site_visits || []).map(mapBackendSiteVisit);
    state.faultCatalogue = (dtcResponse.dtc_records || []).map(normalizeFaultCatalogueRecord);
    state.counts.chargers = chargers.length || null;
    state.counts.faults = state.sites.reduce((total, site) => total + (Number(site.openFaultCount) || 0), 0) || null;
    state.backendLoading = false;
    buildSites();
    renderCounts();
    renderDashboardCharts();
    refreshOpenProfiles();
    return true;
  } catch (err) {
    state.backendLoading = false;
    state.backendError = err.message || "The backend could not be reached.";
    buildSites();
    renderCounts();
    return false;
  }
}

function mapBackendSiteVisit(visit) {
  return {
    id: visit.id,
    siteId: visit.site_id,
    siteName: visit.site_name,
    chargerId: visit.charger_id || "",
    chargerName: visit.charger_name || "",
    visitDate: visit.visit_date,
    status: siteVisitStatusLabel(visit.status || (visit.follow_up_required ? "follow_up_required" : "completed")),
    backendStatus: visit.status || (visit.follow_up_required ? "follow_up_required" : "completed"),
    timeIn: visit.time_in || "",
    timeOut: visit.time_out || "",
    duration: calculateVisitDuration(visit.time_in || "", visit.time_out || ""),
    purpose: visit.purpose || "",
    notes: visit.observations || "",
    workCompleted: visit.actions_taken || "",
    attachments: [],
    createdBy: visit.visited_by || "",
    recordedOn: visit.created_at || "",
    recordedBy: visit.recorded_by_name || "",
    lastModified: visit.updated_at || "",
    lastModifiedBy: visit.last_modified_by_name || "",
    createdAt: visit.created_at,
    updatedAt: visit.updated_at,
  };
}

function siteVisitStatusLabel(status) {
  return {
    scheduled: "Scheduled",
    ongoing: "Ongoing",
    completed: "Completed",
    cancelled: "Cancelled",
    follow_up_required: "Follow-Up Required",
  }[status] || valueOrPlaceholder(status);
}

function backendSiteVisitStatus(status) {
  return {
    Scheduled: "scheduled",
    Ongoing: "ongoing",
    Completed: "completed",
    Cancelled: "cancelled",
    "Follow-Up Required": "follow_up_required",
  }[status] || "completed";
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
  return type === "download"
    ? `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v11m0 0 4-4m-4 4-4-4M5 19h14"/></svg>`
    : `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="3"/></svg>`;
}

function formatFileSize(bytes) {
  if (!bytes) return "--";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileRows(title) {
  const allowedKinds = uploadKindForTitle(title);
  const files = getValidUploads().filter((file) => allowedKinds.includes(file.kind) && (!state.currentSiteName || file.siteName === state.currentSiteName) && (!state.currentChargerId || file.chargerId === state.currentChargerId));
  if (!files.length) return `<tr><td colspan="7">No ${title.toLowerCase()} uploaded yet.</td></tr>`;
  if (title === "Weekly Reports") {
    return files.map((file) => `<tr><td>${valueOrPlaceholder(file.title)}</td><td>${formatDate(file.weekStart)} - ${formatDate(file.weekEnd)}</td><td>${valueOrPlaceholder(file.chargerName)}</td><td>${valueOrPlaceholder(file.name)}</td><td>${formatDate(file.uploadedAt)}</td><td>${valueOrPlaceholder(file.uploadedBy)}</td><td>${fileActionButtons(file, "weekly report")}</td></tr>`).join("");
  }
  if (title === "Troubleshooting") {
    return files.map((file) => `<tr><td>${valueOrPlaceholder(file.title)}</td><td>${valueOrPlaceholder(file.guideCategory)}</td><td>${valueOrPlaceholder(file.guideVersion)}</td><td>${valueOrPlaceholder(file.chargerName)}</td><td>${valueOrPlaceholder(file.name)}</td><td>${formatDate(file.uploadedAt)}</td><td>${fileActionButtons(file, "troubleshooting guide")}</td></tr>`).join("");
  }
  return files.map((file) => `<tr><td>${valueOrPlaceholder(file.title)}</td><td>${valueOrPlaceholder(file.category)}</td><td>${valueOrPlaceholder(file.documentType)}</td><td>${valueOrPlaceholder(file.name)}</td><td>${valueOrPlaceholder(file.chargerName)}</td><td>${formatDate(file.uploadedAt)}</td><td>${fileActionButtons(file, file.category || "file")}</td></tr>`).join("");
}

function fileActionButtons(file, label = "file") {
  return `<div class="file-actions"><button class="file-icon-button" data-file-preview="${file.id}" aria-label="Preview ${label}" data-tooltip="Preview" type="button">${fileIcon("preview")}</button><button class="file-icon-button" data-file-download="${file.id}" aria-label="Download ${label}" data-tooltip="Download" type="button">${fileIcon("download")}</button></div>`;
}

function faultRecordRows() {
  const records = state.faults.filter((fault) => (!state.currentSiteName || fault.siteName === state.currentSiteName) && (!state.currentChargerId || fault.chargerId === state.currentChargerId));
  if (!records.length) return `<tr><td colspan="9">No fault records entered yet.</td></tr>`;
  return records.map((fault) => `<tr>
    <td>${valueOrPlaceholder(fault.faultId)}</td>
    <td>${formatDate(fault.reportedAt)}</td>
    <td>${valueOrPlaceholder(fault.siteName)}</td>
    <td>${valueOrPlaceholder(fault.chargerName)}</td>
    <td>${valueOrPlaceholder(fault.faultCode)}</td>
    <td>${valueOrPlaceholder(fault.faultName)}</td>
    <td>${valueOrPlaceholder(fault.severity)}</td>
    <td><select class="inline-select" data-fault-status="${fault.id}">${["Open", "In Progress", "Resolved", "Closed"].map((status) => `<option${status === fault.status ? " selected" : ""}>${status}</option>`).join("")}</select></td>
    <td>${faultPhotosMarkup(fault)}</td>
  </tr>`).join("");
}

function faultPhotosMarkup(fault) {
  const files = getValidUploads().filter((file) => file.faultId === fault.faultId && file.module === "fault");
  if (!files.length) return "No photos attached";
  return `<div class="fault-photo-strip">${files.map((file) => `<button class="fault-photo-thumb" data-file-preview="${file.id}" aria-label="Preview fault photo" data-tooltip="Preview" type="button"><img src="${file.dataUrl}" alt="${file.name}" /></button>`).join("")}</div>`;
}

function visitRecordRows() {
  const records = state.visits.filter((visit) => (!state.currentSiteName || visit.siteName === state.currentSiteName) && (!state.currentChargerId || visit.chargerId === state.currentChargerId));
  if (!records.length) return `<tr><td colspan="10">No site visits entered yet.</td></tr>`;
  return records.map((visit) => `<tr>
    <td>${formatMediumDate(visit.visitDate)}</td>
    <td>${visit.timeIn ? visit.timeIn : "Not Available Yet"}</td>
    <td>${visit.timeOut ? visit.timeOut : "Not Available Yet"}</td>
    <td>${valueOrPlaceholder(visit.siteName)}</td>
    <td>${valueOrPlaceholder(visit.createdBy)}</td>
    <td>${valueOrPlaceholder(visit.purpose)}</td>
    <td>${valueOrPlaceholder(visit.status)}</td>
    <td>${formatMediumDate(visit.recordedOn)}</td>
    <td>${valueOrPlaceholder(visit.recordedBy)}</td>
    <td><div class="file-actions"><button class="secondary-button" data-visit-detail="${visit.id}" type="button">View</button>${canManageOperations() ? `<button class="secondary-button" data-modal="siteVisit" data-mode="edit" data-visit-id="${visit.id}" type="button">Edit</button>` : ""}</div></td>
  </tr>`).join("");
}

function visitAttachmentsMarkup(visit) {
  const files = getValidUploads().filter((file) => file.siteVisitId === visit.id && file.documentType === "site_visit_report");
  if (!files.length) return "No report attached";
  return `<div class="attached-files">${files.map((file) => `<div class="attached-file"><span>${valueOrPlaceholder(file.name)}</span>${fileActionButtons(file, file.category === "Site Visit Report" ? "site visit report" : "site visit attachment")}</div>`).join("")}</div>`;
}

function archivedChargerRows(siteName) {
  const archivedChargers = state.archivedChargers.filter((charger) => charger.siteName === siteName);
  if (!archivedChargers.length) return `<tr><td colspan="8">No archived chargers for this site.</td></tr>`;
  return archivedChargers.map((charger) => `<tr>
    <td>${valueOrPlaceholder(charger.name)}</td>
    <td>${valueOrPlaceholder(charger.code)}</td>
    <td>${valueOrPlaceholder(charger.siteName)}</td>
    <td>${valueOrPlaceholder(charger.type)}</td>
    <td>${valueOrPlaceholder(charger.previousStatus)}</td>
    <td>${formatMediumDate(charger.archivedAt)}</td>
    <td>${valueOrPlaceholder(charger.archivedBy)}</td>
    <td><div class="file-actions"><button class="secondary-button" data-charger-restore="${charger.id}" type="button">Restore</button>${isAdmin() ? `<button class="danger-button" data-charger-delete="${charger.id}" data-charger-name="${charger.name}" data-charger-code="${charger.code}" type="button">Permanently Delete</button>` : ""}</div></td>
  </tr>`).join("");
}

function archivedChargersSection(siteName) {
  const archivedCount = state.archivedChargers.filter((charger) => charger.siteName === siteName).length;
  return `<div class="module-header"><div><h2>Archived Chargers</h2><p>Archived Chargers: ${archivedCount}</p></div></div>
    <div class="table-wrap"><table><thead><tr><th>Charger Name</th><th>Code</th><th>Site</th><th>Type</th><th>Previous Status</th><th>Archived Date</th><th>Archived By</th><th>Actions</th></tr></thead><tbody>${archivedChargerRows(siteName)}</tbody></table></div>`;
}

function recordsModule(title, actions, columns, filters, note = "") {
  const uploadActions = actions.filter(([label]) => !/preview|download/i.test(label));
  const isFaults = title === "Faults";
  const isVisits = title === "Site Visits";
  const headers = isFaults
    ? ["Fault ID", "Reported", "Site", "Charger", "Fault Code", "Fault Name", "Severity", "Status", "Fault Photos"]
    : isVisits
      ? ["Visit Date", "Time In", "Time Out", "Site", "Engineer", "Purpose", "Status", "Recorded On", "Recorded By", "Actions"]
      : title === "Weekly Reports"
        ? ["Report Title", "Week", "Charger", "File name", "Uploaded", "Uploaded by", "Actions"]
        : title === "Troubleshooting"
          ? ["Guide Title", "Category", "Version", "Charger", "File name", "Uploaded", "Actions"]
          : ["Title", "Module Category", "Document Type", "File name", "Charger", "Uploaded", "Actions"];
  const body = isFaults ? faultRecordRows() : isVisits ? visitRecordRows() : fileRows(title);
  return `<div class="module-header"><div><h2>${title}</h2>${note ? `<p>${note}</p>` : ""}</div>
    <div class="quick-actions compact">${uploadActions.map(([label, modal]) => `<button class="secondary-button" data-modal="${modal}" type="button">${label}</button>`).join("")}</div></div>
    <div class="toolbar">${filters.map((filter) => `<input placeholder="${filter}" />`).join("")}</div>
    <div class="table-wrap"><table><thead><tr>${headers.map((header) => `<th>${header}</th>`).join("")}</tr></thead>
    <tbody>${body}</tbody></table></div>`;
}

function siteTab(tab, site) {
  const siteRecord = getSite(site);
  if (tab === "Overview") {
    return `<div class="overview-grid compact-overview">${imageBlock(siteRecord?.image, site, "compact-image")}<div class="panel flat"><h2>Site Snapshot</h2><div class="data-list">${placeholder("Location", valueOrPlaceholder(siteRecord?.location))}${placeholder("Client / Organization", valueOrPlaceholder(siteRecord?.client))}${placeholder("Site Status", valueOrPlaceholder(siteRecord?.status))}${placeholder("Description", valueOrPlaceholder(siteRecord?.description))}${placeholder("Chargers at this site", siteRecord?.chargers?.length ? String(siteRecord.chargers.length) : "Not Available Yet")}${placeholder("Latest Activity", "To Be Updated")}${placeholder("Notes", valueOrPlaceholder(siteRecord?.notes))}</div></div></div>
      <div class="summary-grid"><article>${placeholder("Chargers", siteRecord?.chargers?.length ? String(siteRecord.chargers.length) : "Not Available Yet")}</article><article>${placeholder("Open Faults", String(state.faults.filter((fault) => fault.siteName === site && ["Open", "In Progress"].includes(fault.status)).length))}</article><article>${placeholder("Last Visit", latestVisitForSite(site))}</article><article>${placeholder("Uploaded Files", String(getValidUploads().filter((file) => file.siteName === site).length))}</article></div>`;
  }
  if (tab === "Chargers") {
    const chargers = siteRecord?.chargers?.length ? siteRecord.chargers : [];
    const archivedSection = archivedChargersSection(site);
    if (!chargers.length) {
      return `<div class="empty-state"><h2>No active chargers added yet</h2><p>Use Add Charger to create editable charger records for ${site}.</p><button class="primary-button" data-modal="charger" data-mode="create" type="button">Add Charger</button></div>${archivedSection}`;
    }
    return `<div class="charger-grid">${chargers.map((charger) => `<article class="charger-card">${imageBlock(charger.image, valueOrPlaceholder(charger.name), "charger-photo")}<h2>${valueOrPlaceholder(charger.name)}</h2><div class="data-list">${placeholder("Charger Type", valueOrPlaceholder(charger.type))}${placeholder("Status", valueOrPlaceholder(charger.status))}${placeholder("Manufacturer", valueOrPlaceholder(charger.manufacturer))}${placeholder("Capacity", valueOrPlaceholder(charger.capacity))}${placeholder("Operator", valueOrPlaceholder(charger.operator))}${placeholder("Administrator", valueOrPlaceholder(charger.administrator))}${placeholder("Model", valueOrPlaceholder(charger.model))}${placeholder("Serial Number", valueOrPlaceholder(charger.serialNumber))}${placeholder("Installation Date", formatDate(charger.installationDate))}${placeholder("Faults")}${placeholder("Last Visit")}</div><button class="primary-button open-charger" data-site="${site}" data-charger="${charger.id}" type="button">Open Charger</button></article>`).join("")}</div>${archivedSection}`;
  }
  if (tab === "Site Visits") return recordsModule("Site Visits", [["Add new site visit", "siteVisit"], ["Upload visit report", "visitReport"]], ["Date", "Time in", "Time out", "Site", "Charger", "Purpose", "Notes", "Report file"], ["Search visits", "Filter by charger", "Filter by date"]);
  if (tab === "Faults") return recordsModule("Faults", [["Report fault", "fault"]], ["Fault ID", "Date", "Site", "Charger", "Fault Code", "Fault Name", "Severity", "Status", "Photos"], ["Search by Fault ID", "Filter by charger", "Filter by fault code", "Filter by status"], "Fault records support photo evidence only. General documents and reports belong in their own modules.");
  if (tab === "Documents") return recordsModule("Documents", [["Upload charger document", "document"]], ["Document title", "Category", "Related site", "Related charger", "Uploaded by", "Upload date", "Actions"], ["Search charger documents", "Filter by document type", "Filter by charger"]);
  if (tab === "Weekly Reports") return recordsModule("Weekly Reports", [["Upload weekly report", "weeklyReport"]], ["Week number", "Date range", "Related site", "Related charger", "Uploaded by", "Upload date", "Summary", "Attachment", "Actions"], ["View reports by week", "Filter by charger"]);
  return recordsModule("Troubleshooting", [["Add troubleshooting guide", "guide"]], ["Guide title", "Category", "Version", "Related charger", "Uploaded by", "Upload date", "Actions"], ["Search guides", "Filter by charger", "Filter by category"]);
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
  profile.innerHTML = `<div class="profile-head compact-profile-head">
    <div><p class="eyebrow">Site Profile</p><h1>${site}</h1></div>
    <div class="profile-meta">
      <span>Status: ${valueOrPlaceholder(siteRecord?.status)}</span><span>Location: ${valueOrPlaceholder(siteRecord?.location)}</span><span>Last updated: To Be Updated</span>
    </div>
    <div class="charger-profile-actions"><button class="secondary-button" data-modal="site" data-mode="edit" data-site-context="${site}" type="button">Edit Site</button></div>
  </div><div class="subtabs">${tabs.map((tab) => `<button class="${tab === initialTab ? "active" : ""}" data-tab="${tab}" type="button">${tab}</button>`).join("")}</div><div class="tab-body">${siteTab(initialTab, site)}</div>`;
  profile.querySelector(".subtabs").addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    profile.querySelectorAll(".subtabs button").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    state.currentSiteTab = button.dataset.tab;
    profile.querySelector(".tab-body").innerHTML = siteTab(button.dataset.tab, site);
    saveViewContext({ route: "sites", siteName: state.currentSiteName, chargerId: "", siteTab: state.currentSiteTab });
  });
  saveViewContext({ route: "sites", siteName: state.currentSiteName, chargerId: "", siteTab: state.currentSiteTab });
  profile.scrollIntoView({ behavior: "smooth", block: "start" });
}

function chargerTab(tab, site) {
  const charger = getCharger(site);
  if (tab === "Overview") {
    return `<div class="overview-grid compact-overview">${imageBlock(charger?.image, "Charger Photo", "compact-image charger-overview-image")}<div class="panel flat"><h2>Charger Snapshot</h2><div class="data-list">${placeholder("Site", site)}${placeholder("Charger Name", valueOrPlaceholder(charger?.name))}${placeholder("Charger Type", valueOrPlaceholder(charger?.type))}${placeholder("Status", valueOrPlaceholder(charger?.status))}${placeholder("Manufacturer", valueOrPlaceholder(charger?.manufacturer))}${placeholder("Capacity", valueOrPlaceholder(charger?.capacity))}${placeholder("Installation Date", formatDate(charger?.installationDate))}${placeholder("Operator", valueOrPlaceholder(charger?.operator))}${placeholder("Administrator", valueOrPlaceholder(charger?.administrator))}${placeholder("Model", valueOrPlaceholder(charger?.model))}${placeholder("Serial Number", valueOrPlaceholder(charger?.serialNumber))}${placeholder("Notes", valueOrPlaceholder(charger?.notes))}${placeholder("Faults")}${placeholder("Last Visit")}</div></div></div>`;
  }
  const modal = tab === "Faults" ? "fault" : tab === "Documents" ? "document" : tab === "Weekly Reports" ? "weeklyReport" : tab === "Troubleshooting" ? "guide" : "siteVisit";
  const label = tab === "Faults" ? "Report fault" : tab === "Site Visits" ? "Add site visit" : "Upload";
  return recordsModule(tab, [[label, modal]], ["Date", "Site", "Charger", "Uploaded by", "Status", "Attachments", "Actions"], ["Search", "Filter by date", "Filter by status"]);
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
  profile.innerHTML = `<div class="profile-head compact-profile-head"><div><p class="eyebrow">Charger Profile</p><h1>${valueOrPlaceholder(charger?.name)}</h1></div><div class="profile-meta"><span>Site: ${site}</span><span>Status: ${valueOrPlaceholder(charger?.status)}</span><span>Type: ${valueOrPlaceholder(charger?.type)}</span></div><div class="charger-profile-actions"><button class="secondary-button" data-modal="charger" type="button">Edit Charger Information</button><button class="danger-button" data-modal="deleteCharger" type="button">Remove Charger</button></div></div><div class="subtabs">${tabs.map((tab) => `<button class="${tab === initialTab ? "active" : ""}" data-tab="${tab}" type="button">${tab}</button>`).join("")}</div><div class="tab-body">${chargerTab(initialTab, site)}</div>`;
  profile.querySelector(".subtabs").addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    profile.querySelectorAll(".subtabs button").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    state.currentChargerTab = button.dataset.tab;
    profile.querySelector(".tab-body").innerHTML = chargerTab(button.dataset.tab, site);
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
    await ChargersApi.restore(chargerId);
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
    await ChargersApi.deleteArchived(chargerId);
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
  if (!siteProfile.classList.contains("hidden")) {
    openSite(state.currentSiteName);
    const tabButton = Array.from(siteProfile.querySelectorAll(".subtabs button")).find((button) => button.dataset.tab === siteTab);
    if (tabButton) tabButton.click();
  }
  if (state.currentChargerId && !chargerProfile.classList.contains("hidden")) {
    openCharger(state.currentSiteName, state.currentChargerId);
    const tabButton = Array.from(chargerProfile.querySelectorAll(".subtabs button")).find((button) => button.dataset.tab === chargerTab);
    if (tabButton) tabButton.click();
  }
}
