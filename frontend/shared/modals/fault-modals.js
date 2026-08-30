let faultCatalogueSearchTimer = null;
let pendingFaultVisitLinks = new Map();
let faultVisitPickerSnapshot = new Map();
function faultFormSection(title, body) {
  return `<section class="fault-form-section full"><h3>${title}</h3><div class="fault-form-grid">${body}</div></section>`;
}
function faultFormMarkup() {
  const siteOptions = state.sites.map((site) => `<option value="${site.id}">${safeDetailValue(site.name)}</option>`).join("");
  const categories = ["Connectivity / Wi-Fi", "Screen or interface", "Charging issue", "Connector or cable", "Power or electrical", "Physical damage", "Software or system", "DTC / technical alarm", "Other"];
  const now = new Date();
  const location = `<label><span>Site <b>Required</b></span><select id="site" data-required="true">${siteOptions}</select></label>${chargerSelectMarkup("Charger", "charger", ' data-required="true"')}`;
  const happened = `<label><span>Fault date <b>Required</b></span><input id="date-reported" type="date" value="${now.toISOString().slice(0, 10)}" data-required="true" /></label><label><span>Fault time <b>Required</b></span><input id="time-reported" type="time" value="${now.toTimeString().slice(0, 5)}" data-required="true" /></label><label><span>Reported by <b>Required</b></span><input id="reported-by" value="${safeDetailValue(state.currentUser)}" data-required="true" /></label><label><span>Fault category <b>Required</b></span><select id="fault-category" data-required="true">${categories.map((item) => `<option>${item}</option>`).join("")}</select></label><label class="full"><span>Short fault title <b>Required</b></span><input id="fault-title" placeholder="Example: Charger screen flickering" data-required="true" /></label><label class="full"><span>Description / what happened <b>Required</b></span><textarea id="description" rows="4" data-required="true"></textarea></label>`;
  const impact = `<label><span>Current charger status</span><select id="current-charger-status"><option>Active</option><option>Offline</option><option>Faulted</option><option>Maintenance</option><option>Inactive</option></select></label><label><span>Priority</span><select id="priority"><option>Low</option><option selected>Medium</option><option>High</option><option>Critical</option></select></label><label><span>Severity</span><select id="severity"><option>Low</option><option selected>Medium</option><option>High</option><option>Critical</option><option>Not Classified</option></select><small>Select the technical impact of the fault.</small></label><label><span>Site visit required</span><select id="site-visit-required"><option selected>No</option><option>Yes</option></select></label>`;
  const photos = `<label class="full"><span>Photos <small>Optional</small></span><input id="photo-evidence" type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" multiple /><small>JPG, PNG, or WebP. Existing photos are preserved when editing.</small></label>`;
  const technical = `<details class="fault-technical-details full"><summary>Technical Details <small>Optional</small></summary><div class="fault-form-grid"><label><span>Is a DTC or technical error code available?</span><select id="has-technical-code"><option selected>No</option><option>Yes</option></select></label><div id="technical-code-fields" class="fault-form-grid full hidden">${fieldMarkup("DTC Catalogue", "fault-catalogue-search")}<label><span>DTC code</span><input id="dtc-code" /></label><label><span>FTB code</span><input id="ftb-code" /></label><label><span>Component / ECU</span><input id="component-ecu" /></label><label><span>Technical category</span><input id="technical-category" /></label><label class="full"><span>Technical fault description</span><textarea id="catalogue-description" rows="3"></textarea></label><label class="full"><span>Possible causes</span><textarea id="catalogue-possible-causes" rows="3"></textarea></label><label class="full"><span>Recommended repair action</span><textarea id="catalogue-recommended-actions" rows="3"></textarea></label></div></div></details>`;
  const followUp = `<label><span>Fault status</span><select id="fault-status">${FAULT_STATUS_OPTIONS.map((status) => `<option>${status}</option>`).join("")}</select></label><label class="full"><span>Possible Causes <small>Optional</small></span><textarea id="possible-causes" rows="3" placeholder="Enter suspected cause(s) of the fault..."></textarea></label><label class="full"><span>Recommended Actions <small>Optional</small></span><textarea id="recommended-actions" rows="3" placeholder="Enter recommended troubleshooting or repair actions..."></textarea></label><label class="full"><span>Follow-up Notes <small>Optional</small></span><textarea id="comments" rows="3"></textarea></label><div id="fault-resolution-details" class="fault-form-grid full hidden"><div class="full"><h4>Resolution Details</h4></div><label class="full"><span>Confirmed Cause <b>Required</b></span><textarea id="confirmed-cause" rows="3" placeholder="Enter the confirmed cause of the fault..."></textarea></label><label class="full"><span>Resolution / Action Taken <b>Required</b></span><textarea id="resolution-action-taken" rows="3" placeholder="Describe the action taken to resolve the fault..."></textarea></label><label class="full"><span>Resolution Notes <small>Optional</small></span><textarea id="resolution-notes" rows="3"></textarea></label></div><input id="generated-fault-id" type="hidden" value="${nextFaultId()}" />`;
  const relatedVisits = `<div class="fault-related-visits-head"><div><h3>Related Site Visits</h3><p>Link existing visits related to this fault.</p></div><button class="secondary-button" id="select-fault-site-visits" type="button">+ Select Site Visits</button></div><div id="fault-related-visits-summary" class="fault-related-visits-summary full"></div><div id="fault-site-visit-picker" class="fault-site-visit-picker full hidden"></div>`;
  return faultFormSection("A. Fault Location", location) + faultFormSection("B. What Happened?", happened) + faultFormSection("C. Impact and Priority", impact) + faultFormSection("D. Photos", photos) + faultFormSection("E. Technical Details — optional", technical) + faultFormSection("F. Follow-up and Resolution", followUp) + `<section class="fault-form-section fault-related-visits-section full">${relatedVisits}</section>`;
}

function initializeFaultRelatedVisits(mode) {
  pendingFaultVisitLinks = new Map();
  if (mode !== "create") {
    const fault = state.faults.find((item) => item.id === state.currentFaultId);
    (fault?.relatedSiteVisits || []).forEach((link) => pendingFaultVisitLinks.set(link.site_visit_id, {
      site_visit_id: link.site_visit_id, progress_update: link.progress_update || "", status_after_visit: link.status_after_visit || "open", existing: true, dirty: false,
    }));
  }
  renderFaultRelatedVisitsSummary();
}

function faultVisitLabel(visitId) {
  const visit = state.visits.find((item) => item.id === visitId);
  const linked = state.faults.find((item) => item.id === state.currentFaultId)?.relatedSiteVisits?.find((item) => item.site_visit_id === visitId);
  return { date: visit?.visitDate || linked?.visit_date, type: visit?.purpose || linked?.visit_type || "Site Visit", charger: visit?.chargerName || "" };
}

function renderFaultRelatedVisitsSummary() {
  const target = document.getElementById("fault-related-visits-summary");
  if (!target) return;
  const links = [...pendingFaultVisitLinks.values()].sort((a, b) => parseDateValue(faultVisitLabel(a.site_visit_id).date).getTime() - parseDateValue(faultVisitLabel(b.site_visit_id).date).getTime());
  target.innerHTML = links.length ? links.map((link) => { const info = faultVisitLabel(link.site_visit_id); return `<div class="fault-related-visit-chip"><div><strong>${formatMediumDate(info.date)} · ${safeDetailValue(info.type)}</strong><small>${info.charger ? `${safeDetailValue(info.charger)} · ` : ""}Status after visit: ${safeDetailValue(String(link.status_after_visit).replace(/_/g, " "))}</small></div></div>`; }).join("") : `<p class="detail-muted">No Site Visits selected.</p>`;
}

async function openFaultSiteVisitPicker() {
  const siteId = document.getElementById("site")?.value;
  const picker = document.getElementById("fault-site-visit-picker");
  if (!siteId || !picker) return;
  faultVisitPickerSnapshot = new Map([...pendingFaultVisitLinks].map(([id, link]) => [id, { ...link }]));
  picker.classList.remove("hidden"); picker.innerHTML = `<p class="detail-muted">Loading Site Visits…</p>`;
  const response = await window.QatarOpsApi.SiteVisits.list({ site_id: siteId, limit: 100 });
  const visits = (response.site_visits || []).map(mapBackendSiteVisit).filter((visit) => visit.siteId === siteId).sort((a, b) => parseDateValue(b.visitDate) - parseDateValue(a.visitDate));
  visits.forEach((visit) => { const index = state.visits.findIndex((item) => item.id === visit.id); if (index >= 0) state.visits.splice(index, 1, visit); else state.visits.push(visit); });
  const fault = state.faults.find((item) => item.id === state.currentFaultId);
  const faultReference = fault?.faultId || document.getElementById("generated-fault-id")?.value || "New Fault";
  const siteName = state.sites.find((site) => site.id === siteId)?.name || "Selected site";
  picker.innerHTML = `<div class="fault-visit-picker-head"><div><h4>Link Site Visits</h4><strong>${safeDetailValue(faultReference)} <span>•</span> ${safeDetailValue(siteName)}</strong><p>Select one or more existing visits.</p></div></div><label class="fault-visit-search"><span class="sr-only">Search visits</span><input id="fault-visit-search" type="search" placeholder="Search visits..." autocomplete="off" /></label><div class="fault-visit-picker-list" id="fault-visit-picker-list">${visits.length ? visits.map((visit) => {
    const link = pendingFaultVisitLinks.get(visit.id); const checked = Boolean(link);
    const description = visit.notes || visit.workCompleted || "";
    const searchText = [visit.visitDate, formatMediumDate(visit.visitDate), visit.purpose, visit.chargerName, visit.status].filter(Boolean).join(" ").toLowerCase();
    if (link?.existing) return `<article class="fault-visit-picker-card is-linked" data-fault-visit-search="${safeDetailValue(searchText)}"><div class="fault-visit-card-main"><div class="fault-visit-card-copy"><div class="fault-visit-card-top"><time>${formatMediumDate(visit.visitDate)}</time><span class="fault-visit-linked-badge">Linked</span></div><strong>${safeDetailValue(visit.purpose || "Site Visit")}</strong>${visit.chargerName ? `<small>${safeDetailValue(visit.chargerName)}</small>` : ""}${description ? `<p>${safeDetailValue(description)}</p>` : ""}</div></div></article>`;
    return `<article class="fault-visit-picker-card${checked ? " is-selected" : ""}" data-fault-visit-card="${visit.id}" data-fault-visit-search="${safeDetailValue(searchText)}"><label class="fault-visit-picker-choice"><input type="checkbox" data-fault-form-visit="${visit.id}"${checked ? " checked" : ""} /><span class="fault-visit-card-copy"><time>${formatMediumDate(visit.visitDate)}</time><strong>${safeDetailValue(visit.purpose || "Site Visit")}</strong>${visit.chargerName ? `<small>${safeDetailValue(visit.chargerName)}</small>` : ""}${description ? `<p>${safeDetailValue(description)}</p>` : ""}</span></label><div class="fault-visit-link-fields${checked ? "" : " hidden"}" data-fault-form-visit-fields="${visit.id}"><label><span>Progress Update</span><textarea data-fault-form-progress="${visit.id}" rows="2">${link?.progress_update ? safeDetailValue(link.progress_update) : ""}</textarea></label><label><span>Status After Visit</span><select data-fault-form-status="${visit.id}">${FAULT_STATUS_OPTIONS.map((status) => `<option value="${status.toLowerCase().replace(/\s+/g, "_")}"${status.toLowerCase().replace(/\s+/g, "_") === link?.status_after_visit ? " selected" : ""}>${status}</option>`).join("")}</select></label></div></article>`;
  }).join("") : `<p class="detail-muted">No Site Visits are available for the selected site.</p>`}<p class="detail-muted hidden" id="fault-visit-search-empty">No visits match your search.</p></div><div class="fault-visit-picker-footer"><span id="fault-visit-selected-count">0 visits selected</span><div><button class="secondary-button" id="cancel-fault-site-visit-picker" type="button">Cancel</button><button id="apply-fault-site-visit-picker" type="button">Use Selected Visits</button></div></div>`;
  updateFaultVisitPickerSelectionState();
}

function updateFaultVisitPickerSelectionState() {
  const selected = [...pendingFaultVisitLinks.values()].filter((link) => !link.existing).length;
  const count = document.getElementById("fault-visit-selected-count");
  const apply = document.getElementById("apply-fault-site-visit-picker");
  if (count) count.textContent = `${selected} visit${selected === 1 ? "" : "s"} selected`;
  if (apply) apply.disabled = selected === 0;
}

function cancelFaultSiteVisitPicker() {
  pendingFaultVisitLinks = new Map([...faultVisitPickerSnapshot].map(([id, link]) => [id, { ...link }]));
  document.getElementById("fault-site-visit-picker")?.classList.add("hidden");
  renderFaultRelatedVisitsSummary();
}

function clearFaultVisitSelections() {
  pendingFaultVisitLinks.clear();
  document.getElementById("fault-site-visit-picker")?.classList.add("hidden");
  renderFaultRelatedVisitsSummary();
}

function siteFromFaultSelection(value) {
  return state.sites.find((site) => site.id === value || site.name === value);
}

function toggleFaultTechnicalDetails() {
  const enabled = document.getElementById("has-technical-code")?.value === "Yes";
  document.getElementById("technical-code-fields")?.classList.toggle("hidden", !enabled);
  if (!enabled) {
    const selectedId = document.getElementById("fault-catalogue-id");
    if (selectedId) selectedId.value = "";
  }
}

function toggleFaultResolutionDetails() {
  const resolved = document.getElementById("fault-status")?.value === "Resolved";
  document.getElementById("fault-resolution-details")?.classList.toggle("hidden", !resolved);
}

function nextFaultId() {
  const year = new Date().getFullYear();
  const maxForYear = state.faults
    .map((fault) => fault.faultId || "")
    .filter((id) => id.startsWith(`FLT-${year}-`))
    .map((id) => Number(id.split("-").pop()))
    .filter((number) => Number.isFinite(number))
    .reduce((max, number) => Math.max(max, number), 0);
  return `FLT-${year}-${String(maxForYear + 1).padStart(4, "0")}`;
}

function selectedFaultCatalogueItem(selectId = "fault-code") {
  const selectedId = document.getElementById("fault-catalogue-id")?.value || document.getElementById(selectId)?.value || "";
  return state.faultCatalogue.find((item) => item.id === selectedId);
}

function renderFaultCodeDetails(selectId = "fault-code") {
  const panel = document.getElementById("fault-code-details");
  if (!panel) return;
  const item = selectedFaultCatalogueItem(selectId);
  panel.innerHTML = item
    ? `<span>DTC / FTB</span><strong>${valueOrPlaceholder(item.faultCode)}${item.ftbCode ? ` / ${safeDetailValue(item.ftbCode)}` : ""}</strong><span>Fault Title</span><strong>${valueOrPlaceholder(item.faultName)}</strong><span>ECU / Component</span><p>${valueOrPlaceholder(item.component)}</p><span>Category / Severity</span><p>${valueOrPlaceholder(item.category)} / ${valueOrPlaceholder(item.severity)}</p><span>Catalogue Description</span><p>${valueOrPlaceholder(item.meaning)}</p><span>Possible Causes</span><p>${valueOrPlaceholder(item.possibleCauses)}</p><span>Recommended Action</span><p>${valueOrPlaceholder(item.recommendedAction)}</p><span>Manufacturer Data</span><p>${safeDetailValue(JSON.stringify(item.manufacturerData || {}))}</p>`
    : `<span>Fault Title</span><strong>Unknown / No DTC Code</strong><span>Catalogue Description</span><p>No catalogue record selected.</p><span>Possible Causes</span><p>Not Available Yet</p><span>Recommended Action</span><p>Not Available Yet</p>`;
}

function faultCatalogueResultMarkup(records) {
  if (!records.length) return `<p>No matching DTC records found. You can continue recording the fault manually.</p>`;
  return records.slice(0, 20).map((item) => `<button class="dtc-catalogue-result" data-dtc-select="${item.id}" type="button"><strong>${safeDetailValue(item.faultCode)}${item.ftbCode ? ` / ${safeDetailValue(item.ftbCode)}` : ""}</strong><span>${safeDetailValue(item.component || "No ECU")} · ${safeDetailValue(item.faultName)}</span></button>`).join("");
}

async function searchFaultCatalogue(value) {
  const results = document.getElementById("dtc-catalogue-results");
  if (!results) return;
  const query = value.trim();
  if (!query) { results.innerHTML = ""; return; }
  results.innerHTML = `<p>Searching catalogue…</p>`;
  try {
    const response = await window.QatarOpsApi.Dtc.list({ query, status: "active", limit: 100 });
    const records = (response.dtc_records || []).map(normalizeFaultCatalogueRecord);
    const known = new Map(state.faultCatalogue.map((item) => [item.id, item]));
    records.forEach((item) => known.set(item.id, item));
    state.faultCatalogue = Array.from(known.values());
    results.innerHTML = faultCatalogueResultMarkup(records);
  } catch (error) {
    results.innerHTML = `<p>The DTC catalogue is temporarily unavailable. You can continue recording the fault manually.</p>`;
  }
}

function queueFaultCatalogueSearch(value) {
  clearTimeout(faultCatalogueSearchTimer);
  const selectedId = document.getElementById("fault-catalogue-id");
  if (selectedId) selectedId.value = "";
  faultCatalogueSearchTimer = setTimeout(() => searchFaultCatalogue(value), 250);
}

function selectFaultCatalogueRecord(id) {
  const item = state.faultCatalogue.find((record) => record.id === id);
  if (!item) return;
  setFieldValue("fault-catalogue-id", item.id);
  setFieldValue("dtc-catalogue-search", `${item.faultCode}${item.ftbCode ? ` / ${item.ftbCode}` : ""} — ${item.faultName}`);
  setFieldValue("dtc-code", item.faultCode); setFieldValue("ftb-code", item.ftbCode);
  setFieldValue("component-ecu", item.component); setFieldValue("fault-title", item.faultName);
  setFieldValue("catalogue-description", item.meaning); setFieldValue("catalogue-possible-causes", item.possibleCauses);
  setFieldValue("catalogue-recommended-actions", item.recommendedAction); setFieldValue("possible-causes", item.possibleCauses);
  setFieldValue("recommended-actions", item.recommendedAction); setFieldValue("severity", normalizedFaultSeverity(item.severity, "Medium"));
  setFieldValue("technical-category", item.category);
  const results = document.getElementById("dtc-catalogue-results");
  if (results) results.innerHTML = "";
}
