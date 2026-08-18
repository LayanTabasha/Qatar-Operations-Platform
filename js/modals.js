const IMAGE_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;
const IMAGE_UPLOAD_TYPES = ["image/jpeg", "image/png", "image/webp"];
let pendingModalImage = null;
let pendingSiteImageFile = null;
let removeExistingSiteImage = false;
let faultCatalogueSearchTimer = null;

function openModal(type, mode = "edit", context = {}) {
  delete document.getElementById("modal-form").dataset.requestMode;
  delete document.getElementById("modal-form").dataset.requestId;
  const config = modalConfigs[type];
  if (!config) return;
  if (!isAdmin() && ["user", "faultCode"].includes(type)) {
    alert("Access denied. This action requires administrator permission.");
    return;
  }
  if (!isAdmin() && ["site", "charger", "deleteCharger"].includes(type)) {
    alert("Access denied. This action requires operations permission.");
    return;
  }
  if (!canManageOperations() && ["siteVisit", "visitReport", "fault", "document", "weeklyReport", "guide", "contact", "confirmDelete"].includes(type)) {
    alert("Access denied. Viewer accounts can view, preview, and download permitted records only.");
    return;
  }
  const form = document.getElementById("modal-form");
  if (mode === "create") {
    if (type === "siteVisit") state.currentVisitId = "";
    if (type === "fault") state.currentFaultId = "";
    if (["document", "weeklyReport", "guide"].includes(type)) { state.currentContentRecordId = ""; state.currentLegacyContentId = ""; }
  }
  document.querySelector(".modal")?.classList.remove("preview-modal", "request-modal");
  pendingModalImage = null;
  pendingSiteImageFile = null;
  removeExistingSiteImage = false;
  document.getElementById("modal-title").textContent = config.title;
  document.getElementById("modal-eyebrow").textContent = type === "confirmDelete" ? "Confirm" : "Operational Form";
  form.dataset.type = type;
  form.dataset.mode = mode;
  form.dataset.site = state.currentSiteName || "";
  form.dataset.siteId = context.siteId || "";
  form.dataset.charger = state.currentChargerId || "";
  form.dataset.chargerId = context.chargerId || "";
  form.dataset.lockSite = context.lockSite ? "true" : "false";
  form.dataset.lockLocation = context.lockLocation ? "true" : "false";
  form.dataset.dtcId = "";
  form.dataset.visit = state.currentVisitId || "";
  const deleteNote = type === "deleteCharger" ? `<p class="modal-note">This archives the current charger. Type REMOVE to confirm.</p>` : "";
  const saveLabel = type === "deleteCharger" ? "Archive Charger" : "Save";
  const saveClass = type === "deleteCharger" ? "danger-button" : "primary-button";
  const contentRequiredFields = {
    document: new Set(["Related site", "Document title", "Document category", "Document date"]),
    weeklyReport: new Set(["Site", "Week start", "Week end", "Report title"]),
    guide: new Set(["Site", "Guide title", "Category"]),
  };
  const formFields = type === "fault" ? faultFormMarkup() : config.fields.map(([label, kind], index) => fieldMarkup(label, kind, contentRequiredFields[type]?.has(label) ?? index < 2)).join("");
  form.innerHTML = `<div class="modal-error" id="modal-error"></div>${deleteNote}${formFields}<div class="modal-actions"><button class="secondary-button" type="button" id="cancel-modal">Cancel</button><button class="${saveClass}" type="submit" data-loading-text="Saving...">${saveLabel}</button></div>`;
  if (mode === "create" && ["siteVisit", "fault", "document", "weeklyReport", "guide"].includes(type)) populateOperationalContext(type, context);
  if (mode !== "create") prefillModal(type);
  if (mode !== "create") renderCurrentAttachment(type);
  if (mode === "create" && type === "charger") {
    setFieldValue("site", state.currentSiteName);
    const siteField = document.getElementById("site");
    if (siteField && context.lockSite && context.siteId) {
      siteField.disabled = true;
      siteField.setAttribute("aria-readonly", "true");
    }
  }
  document.getElementById("modal-backdrop").classList.remove("hidden");
  resetModalScroll();
}

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
  const technical = `<details class="fault-technical-details full"><summary>Technical Details <small>Optional</small></summary><div class="fault-form-grid"><label><span>Is a DTC or technical error code available?</span><select id="has-technical-code"><option selected>No</option><option>Yes</option></select></label><div id="technical-code-fields" class="fault-form-grid full hidden">${fieldMarkup("DTC Catalogue", "fault-catalogue-search")}<label><span>DTC code</span><input id="dtc-code" /></label><label><span>FTB code</span><input id="ftb-code" /></label><label><span>Component / ECU</span><input id="component-ecu" /></label><label><span>Technical category</span><input id="technical-category" /></label><label class="full"><span>Technical fault description</span><textarea id="catalogue-description" rows="3"></textarea></label><label class="full"><span>Possible causes</span><textarea id="possible-causes" rows="3"></textarea></label><label class="full"><span>Recommended repair action</span><textarea id="recommended-actions" rows="3"></textarea></label></div></div></details>`;
  const followUp = `<label><span>Fault status</span><select id="fault-status">${FAULT_STATUS_OPTIONS.map((status) => `<option>${status}</option>`).join("")}</select></label><label class="full"><span>Follow-up / resolution notes <small>Optional</small></span><textarea id="comments" rows="3"></textarea></label><input id="generated-fault-id" type="hidden" value="${nextFaultId()}" />`;
  return faultFormSection("A. Fault Location", location) + faultFormSection("B. What Happened?", happened) + faultFormSection("C. Impact and Priority", impact) + faultFormSection("D. Photos", photos) + faultFormSection("E. Technical Details — optional", technical) + faultFormSection("F. Follow-up and Resolution", followUp);
}

function siteFromFaultSelection(value) {
  return state.sites.find((site) => site.id === value || site.name === value);
}

function populateOperationalContext(type, context = {}) {
  const form = document.getElementById("modal-form");
  const siteField = document.getElementById(type === "document" ? "related-site" : "site");
  const chargerField = document.getElementById("charger");
  const siteLocked = context.lockSite === true || context.lockLocation === true;
  const chargerLocked = context.lockLocation === true && Boolean(context.chargerId);
  const site = siteLocked ? state.sites.find((item) => item.id === context.siteId) : state.sites[0];
  const charger = chargerLocked ? site?.chargers?.find((item) => item.id === context.chargerId) : null;
  if (siteLocked && !site) throw new Error("The selected site context is no longer available. Reopen the profile and try again.");
  if (chargerLocked && !charger) throw new Error("The selected charger context is no longer available. Reopen the charger and try again.");
  setFieldValue(type === "document" ? "related-site" : "site", type === "fault" ? site?.id || "" : site?.name || "");
  refreshChargerSelect();
  setFieldValue("charger", charger?.id || "");
  if (siteField) { siteField.disabled = siteLocked; siteField.setAttribute("aria-readonly", String(siteLocked)); }
  if (chargerField) { chargerField.disabled = chargerLocked || !site?.chargers?.length; chargerField.setAttribute("aria-readonly", String(chargerLocked)); }
  form.dataset.siteId = siteLocked ? site.id : "";
  form.dataset.chargerId = chargerLocked ? charger.id : "";
  form.dataset.lockSite = String(siteLocked);
  form.dataset.lockLocation = String(chargerLocked);
  setFieldValue("current-charger-status", charger?.status || "Active");
}

function toggleFaultTechnicalDetails() {
  const enabled = document.getElementById("has-technical-code")?.value === "Yes";
  document.getElementById("technical-code-fields")?.classList.toggle("hidden", !enabled);
  if (!enabled) {
    const selectedId = document.getElementById("fault-catalogue-id");
    if (selectedId) selectedId.value = "";
  }
}

function renderCurrentAttachment(type) {
  const files = type === "siteVisit" ? deduplicateSiteVisitAttachments(state.visits.find((item) => item.id === state.currentVisitId)?.attachmentRecords || [], state.currentVisitId) : state.currentLegacyContentId ? state.uploads.filter((file) => file.id === state.currentLegacyContentId) : state.uploads.filter((file) => file.recordId === state.currentContentRecordId && file.persisted);
  document.querySelector("#modal-form .current-attachment")?.remove();
  if (!["siteVisit", "document", "weeklyReport", "guide"].includes(type) || !files.length) return;
  const actions = document.querySelector("#modal-form .modal-actions");
  actions?.insertAdjacentHTML("beforebegin", `<div class="full current-attachment"><strong>Current file</strong>${files.map((file) => `<div class="attached-file"><span title="${safeDetailValue(file.name)}">${safeDetailValue(file.name)}</span><div class="file-actions"><button class="secondary-button" data-file-preview="${file.id}" type="button">View</button><button class="secondary-button" data-file-download="${file.id}" type="button">Download</button>${type === "siteVisit" ? siteVisitRemoveControl(file, "Remove Report") : ""}</div></div>`).join("")}<small>Saving without a new file preserves the current file. A selected file replaces it after upload succeeds.</small></div>`);
}

function fieldMarkup(label, kind, required = false) {
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const requiredAttr = required && kind !== "file" ? ` data-required="true"` : "";
  if (kind === "fault-id") {
    return `<label><span>${label}</span><input id="${id}" type="text" value="${nextFaultId()}" readonly data-system-value="true" /></label>`;
  }
  if (kind === "fault-code-select" || kind === "fault-code-select-optional") {
    const activeCodes = state.faultCatalogue.filter((item) => item.active);
    const requiredCode = kind === "fault-code-select" ? requiredAttr : "";
    return `<label><span>${label}</span><select id="${id}"${requiredCode}><option value="">Unknown / No DTC Code</option>${activeCodes.map((item) => `<option value="${item.id}">${item.faultCode}${item.ftbCode ? `/${item.ftbCode}` : ""} - ${item.faultName}</option>`).join("")}</select></label>`;
  }
  if (kind === "fault-catalogue-search") {
    return `<label class="full fault-catalogue-picker"><span>${label}</span><input id="dtc-catalogue-search" type="search" autocomplete="off" placeholder="Search DTC, FTB, ECU, title, or description" /><input id="fault-catalogue-id" type="hidden" /><div id="dtc-catalogue-results" class="dtc-catalogue-results" aria-live="polite"></div><small>Select a catalogue result to copy its values, or leave it blank for a manual fault.</small></label>`;
  }
  if (kind === "fault-code-details") {
    return `<div class="full fault-code-details" id="fault-code-details"><span>Fault Title</span><strong>Unknown / No DTC Code</strong><span>Catalogue Description</span><p>No catalogue record selected.</p><span>Possible Causes</span><p>Not Available Yet</p><span>Recommended Action</span><p>Not Available Yet</p></div>`;
  }
  if (kind.startsWith("select:")) {
    const siteLabels = ["Site", "Related site", "Assigned Site"];
    const options = siteLabels.includes(label)
      ? state.sites.map((site) => site.name)
      : kind.replace("select:", "").split(",");
    const emptySiteOption = label === "Assigned Site" ? '<option value="">Not site-specific</option>' : "";
    return `<label><span>${label}</span><select id="${id}"${requiredAttr}>${emptySiteOption}${options.map((item) => `<option>${item}</option>`).join("")}</select></label>`;
  }
  if (kind === "charger-select") return chargerSelectMarkup(label, id, requiredAttr);
  if (kind === "textarea") return `<label class="full"><span>${label}</span><textarea id="${id}" rows="3"${requiredAttr}></textarea></label>`;
  if (kind === "image-file") return `<label class="full"><span>${label}</span><input id="${id}" type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" multiple${requiredAttr} /><small>JPG, PNG, or WebP images only.</small></label>`;
  if (kind === "file" && label === "Upload site image") {
    return `<label class="full image-upload-field"><span>${label}</span><input id="${id}" type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"${requiredAttr} /><div class="image-upload-preview" id="site-image-preview"><span>No image selected</span></div><div class="quick-actions compact image-upload-actions"><button class="secondary-button" id="replace-site-image" type="button">Replace Image</button><button class="danger-button" id="remove-site-image" type="button">Remove Selected Image</button></div><small>JPG, PNG, or WebP. Maximum 5 MB. The image is previewed before upload and saved after the site details are saved.</small></label>`;
  }
  if (kind === "file" && label === "Site Visit Report upload") {
    return `<label class="full"><span>${label}</span><input id="${id}" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.webp,.gif,.txt,.csv" /><small>Optional. PDF, Office, image, TXT, or CSV; maximum 25 MB. On edit, selecting a file safely replaces the current report.</small></label>`;
  }
  return `<label><span>${label}</span><input id="${id}" type="${kind}"${requiredAttr} /></label>`;
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
  setFieldValue("catalogue-description", item.meaning); setFieldValue("possible-causes", item.possibleCauses);
  setFieldValue("recommended-actions", item.recommendedAction); setFieldValue("severity", normalizedFaultSeverity(item.severity, "Medium"));
  setFieldValue("technical-category", item.category);
  const results = document.getElementById("dtc-catalogue-results");
  if (results) results.innerHTML = "";
}

function chargerSelectMarkup(label, id, requiredAttr = "") {
  const siteSelection = document.getElementById("site")?.value || document.getElementById("related-site")?.value || state.currentSiteName || state.sites[0]?.id;
  const chargers = sortChargersForDisplay(siteFromFaultSelection(siteSelection)?.chargers || []);
  if (!chargers.length) {
    return `<label><span>${label}</span><select id="${id}" disabled${requiredAttr}><option value="">No chargers are available for this site</option></select></label>`;
  }
  return `<label><span>${label}</span><select id="${id}"${requiredAttr}><option value="">Select a charger</option>${chargers.map((charger) => `<option value="${charger.id}">${valueOrPlaceholder(charger.name)}</option>`).join("")}</select></label>`;
}

function refreshChargerSelect() {
  const chargerField = document.getElementById("charger");
  if (!chargerField) return;
  const siteSelection = document.getElementById("site")?.value || document.getElementById("related-site")?.value || state.currentSiteName || state.sites[0]?.id;
  const chargers = sortChargersForDisplay(siteFromFaultSelection(siteSelection)?.chargers || []);
  chargerField.innerHTML = chargers.length
    ? `<option value="">Select a charger</option>${chargers.map((charger) => `<option value="${charger.id}">${valueOrPlaceholder(charger.name)}</option>`).join("")}`
    : `<option value="">No chargers are available for this site</option>`;
  chargerField.disabled = !chargers.length;
  if (chargers.some((charger) => charger.id === state.currentChargerId) && document.getElementById("modal-form")?.dataset.lockLocation === "true") chargerField.value = state.currentChargerId;
}

function closeModal() {
  if (activePreview.objectUrl) URL.revokeObjectURL(activePreview.objectUrl);
  document.getElementById("modal-backdrop").classList.add("hidden");
  document.body.classList.remove("modal-open", "is-loading");
  document.body.style.removeProperty("overflow");
  document.querySelector(".modal")?.classList.remove("preview-modal", "request-modal");
  delete document.getElementById("modal-form").dataset.requestMode;
  delete document.getElementById("modal-form").dataset.requestId;
  activePreview = { fileId: "", zoom: 1, rotation: 0, mode: "fit-screen", objectUrl: "" };
  pendingModalImage = null;
  pendingSiteImageFile = null;
  removeExistingSiteImage = false;
  document.querySelector(".modal")?.scrollTo(0, 0);
}

function resetModalScroll() {
  const modal = document.querySelector(".modal");
  modal?.scrollTo({ top: 0, left: 0, behavior: "auto" });
  document.getElementById("modal-form")?.scrollTo?.({ top: 0, left: 0, behavior: "auto" });
}

function setFieldValue(id, value) {
  const field = document.getElementById(id);
  if (!field || value === undefined || value === null || value === "") return;
  if (field.tagName === "SELECT" && !Array.from(field.options).some((option) => option.value === String(value))) {
    field.add(new Option(String(value), String(value)));
  }
  field.value = value;
}

function prefillModal(type) {
  if (type === "site") {
    const site = getSite();
    setFieldValue("site-name", site?.name);
    setFieldValue("location", site?.location !== "To Be Updated" ? site?.location : "");
    setFieldValue("client-organization", site?.client !== "Not Available Yet" ? site?.client : "");
    setFieldValue("status", site?.status);
    setFieldValue("description", site?.description);
    setFieldValue("notes", site?.notes);
    renderSiteImagePreview(site?.image, site?.name || "Site Image");
  }
  if (type === "charger") {
    const charger = getCharger();
    setFieldValue("charger-name", charger?.name);
    setFieldValue("charger-type", charger?.type);
    setFieldValue("site", state.currentSiteName);
    setFieldValue("operator", charger?.operator);
    setFieldValue("administrator", charger?.administrator);
    setFieldValue("manufacturer", charger?.manufacturer);
    setFieldValue("model", charger?.model);
    setFieldValue("serial-number", charger?.serialNumber);
    setFieldValue("capacity", charger?.capacity);
    setFieldValue("installation-date", charger?.installationDate);
    setFieldValue("status", charger?.status);
    setFieldValue("notes", charger?.notes);
  }
  if (type === "contact") {
    const contact = state.contacts.find((item) => item.id === state.currentContactId);
    if (contact) {
      setFieldValue("name", contact.contact_name);
      setFieldValue("role", contact.job_title);
      setFieldValue("organization-department", contact.organization);
      setFieldValue("phone", contact.phone);
      setFieldValue("email", contact.email);
      setFieldValue("assigned-site", contact.site_name || "");
      setFieldValue("notes", contact.notes);
    }
  }
  if (["siteVisit", "visitReport", "fault", "document", "weeklyReport", "guide"].includes(type)) {
    setFieldValue("site", state.currentSiteName);
    setFieldValue("related-site", state.currentSiteName);
    setFieldValue("charger", state.currentChargerId);
  }
  if (type === "siteVisit") {
    const visit = state.visits.find((item) => item.id === state.currentVisitId);
    if (visit) {
      setFieldValue("site", visit.siteName);
      refreshChargerSelect();
      setFieldValue("charger", visit.chargerId);
      setFieldValue("visit-date", visit.visitDate);
      setFieldValue("visit-status", visit.status);
      setFieldValue("time-in", visit.timeIn);
      setFieldValue("time-out", visit.timeOut);
      setFieldValue("engineer-name", visit.createdBy);
      setFieldValue("purpose", visit.purpose);
      setFieldValue("work-completed", visit.workCompleted);
      setFieldValue("findings", visit.notes);
      setFieldValue("notes", visit.notes);
    }
  }
  if (type === "fault") {
    const fault = state.faults.find((item) => item.id === state.currentFaultId);
    if (fault) {
      const faultSite = state.sites.find((site) => site.id === fault.site_id || site.name === fault.siteName);
      setFieldValue("site", faultSite?.id || fault.siteName); refreshChargerSelect(); setFieldValue("charger", fault.chargerId);
      setFieldValue("generated-fault-id", fault.faultId); setFieldValue("fault-catalogue-id", fault.faultCatalogueId);
      const catalogue = state.faultCatalogue.find((item) => item.id === fault.faultCatalogueId);
      setFieldValue("dtc-catalogue-search", catalogue ? `${catalogue.faultCode}${catalogue.ftbCode ? ` / ${catalogue.ftbCode}` : ""} — ${catalogue.faultName}` : "");
      setFieldValue("reported-by", fault.reportedBy); setFieldValue("fault-category", fault.category);
      setFieldValue("current-charger-status", fault.chargerStatus); setFieldValue("priority", fault.priority);
      setFieldValue("site-visit-required", fault.siteVisitRequired ? "Yes" : "No");
      setFieldValue("dtc-code", fault.faultCode); setFieldValue("ftb-code", fault.ftbCode);
      setFieldValue("component-ecu", fault.component); setFieldValue("fault-title", fault.faultName);
      setFieldValue("catalogue-description", fault.faultDescription); setFieldValue("possible-causes", fault.possibleCauses);
      setFieldValue("recommended-actions", fault.recommendedAction); setFieldValue("severity", normalizedFaultSeverity(fault.severity));
      setFieldValue("technical-category", fault.technicalCategory); setFieldValue("fault-status", fault.status);
      setFieldValue("date-reported", fault.reportedDate || String(fault.reportedAt || "").slice(0, 10));
      setFieldValue("time-reported", fault.reportedTime || String(fault.reportedAt || "").slice(11, 16));
      setFieldValue("description", fault.description); setFieldValue("comments", fault.comments);
      if (fault.faultCatalogueId || fault.faultCode) {
        setFieldValue("has-technical-code", "Yes");
        document.querySelector(".fault-technical-details")?.setAttribute("open", "");
      }
      toggleFaultTechnicalDetails();
    }
  }
  if (["document", "weeklyReport", "guide"].includes(type)) {
    const record = state.currentLegacyContentId
      ? state.uploads.find((file) => file.id === state.currentLegacyContentId && !file.recordPersisted)
      : state.uploads.find((file) => file.recordId === state.currentContentRecordId);
    if (record) {
      setFieldValue(type === "document" ? "related-site" : "site", record.siteName); refreshChargerSelect(); setFieldValue("charger", record.chargerId);
      setFieldValue("document-title", record.title); setFieldValue("document-category", record.documentType);
      setFieldValue("document-date", record.documentDate); setFieldValue("description", record.description);
      setFieldValue("report-title", record.title); setFieldValue("week-start", record.weekStart); setFieldValue("week-end", record.weekEnd); setFieldValue("summary", record.notes || record.description);
      setFieldValue("guide-title", record.title); setFieldValue("category", record.guideCategory); setFieldValue("symptoms", record.symptoms);
      setFieldValue("possible-cause", record.possibleCause); setFieldValue("troubleshooting-steps", record.troubleshootingSteps);
      setFieldValue("resolution", record.resolution); setFieldValue("notes", record.notes);
    }
  }
}

function renderSiteImagePreview(image, label = "Site Image") {
  const preview = document.getElementById("site-image-preview");
  if (!preview) return;
  const imageSource = typeof image === "object" ? image?.display || image?.original : image;
  const resolvedImageSource = typeof apiAssetUrl === "function" ? apiAssetUrl(imageSource) : imageSource;
  preview.innerHTML = imageSource
    ? `<img src="${resolvedImageSource}" alt="${label}" />`
    : `<span>No image selected</span>`;
}

function validateImageFile(file) {
  if (!file) return "Choose an image file first.";
  if (!IMAGE_UPLOAD_TYPES.includes(file.type)) return "Site cover image must be JPG, PNG, or WebP.";
  if (file.size > IMAGE_UPLOAD_MAX_BYTES) return "Site cover image must be 5 MB or smaller.";
  return "";
}

function loadImageFromDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to load image."));
    image.src = dataUrl;
  });
}

async function readAndOptimizeSiteImage(file) {
  const error = validateImageFile(file);
  if (error) throw new Error(error);
  const original = await readFileAsDataUrl("upload-site-image");
  const image = await loadImageFromDataUrl(original);
  const targetWidth = 1280;
  const targetHeight = 720;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  context.fillStyle = "#081827";
  context.fillRect(0, 0, targetWidth, targetHeight);

  const isSmall = image.naturalWidth < 640 || image.naturalHeight < 360;
  const scale = isSmall
    ? Math.min(targetWidth / image.naturalWidth, targetHeight / image.naturalHeight)
    : Math.max(targetWidth / image.naturalWidth, targetHeight / image.naturalHeight);
  const drawWidth = Math.round(image.naturalWidth * scale);
  const drawHeight = Math.round(image.naturalHeight * scale);
  const drawX = Math.round((targetWidth - drawWidth) / 2);
  const drawY = Math.round((targetHeight - drawHeight) / 2);
  context.drawImage(image, drawX, drawY, drawWidth, drawHeight);

  return {
    original,
    display: canvas.toDataURL("image/webp", 0.82),
    name: file.name,
    type: file.type,
    size: file.size,
    width: image.naturalWidth,
    height: image.naturalHeight,
    displayWidth: targetWidth,
    displayHeight: targetHeight,
    optimizedAt: new Date().toISOString(),
  };
}

async function handleSiteImageSelection() {
  const input = document.getElementById("upload-site-image");
  const file = input?.files?.[0];
  const errorBox = document.getElementById("modal-error");
  if (errorBox) errorBox.textContent = "";
  if (!file) return;
  try {
    pendingModalImage = await readAndOptimizeSiteImage(file);
    pendingSiteImageFile = file;
    removeExistingSiteImage = false;
    renderSiteImagePreview(pendingModalImage, pendingModalImage.name);
  } catch (error) {
    pendingModalImage = null;
    pendingSiteImageFile = null;
    if (input) input.value = "";
    if (errorBox) errorBox.textContent = error.message;
    renderSiteImagePreview(null);
  }
}

function removeSiteImageSelection() {
  pendingModalImage = null;
  pendingSiteImageFile = null;
  removeExistingSiteImage = false;
  const input = document.getElementById("upload-site-image");
  if (input) input.value = "";
  renderSiteImagePreview(null);
}

function detailRow(label, value) {
  return `<div class="data-row"><span>${label}</span><strong>${safeDetailValue(value)}</strong></div>`;
}

function openSiteVisitDetail(visitId) {
  const visit = state.visits.find((item) => item.id === visitId);
  if (!visit) return;
  state.currentVisitId = visit.id;
  const form = document.getElementById("modal-form");
  document.querySelector(".modal")?.classList.remove("preview-modal");
  document.getElementById("modal-title").textContent = "Site Visit Details";
  document.getElementById("modal-eyebrow").textContent = "Read-only Record";
  form.dataset.type = "siteVisitDetail";
  form.innerHTML = `
    <div class="settings-section">
      <div>
        <h2>Visit Information</h2>
        <p>${safeDetailValue(visit.siteName)}${visit.chargerName ? ` - ${safeDetailValue(visit.chargerName)}` : ""}</p>
      </div>
      <div class="data-list">
        ${detailRow("Visit Date", formatMediumDate(visit.visitDate))}
        ${detailRow("Time In", visit.timeIn || "Not Available Yet")}
        ${detailRow("Time Out", visit.timeOut || "Not Available Yet")}
        ${detailRow("Site", visit.siteName)}
        ${detailRow("Engineer / Technician", visit.createdBy)}
        ${detailRow("Purpose", visit.purpose)}
        ${detailRow("Status", visit.status)}
        ${detailRow("Visit Notes", visit.notes)}
        ${detailRow("Work Completed", visit.workCompleted)}
      </div>
    </div>
    <div class="settings-section">
      <div><h2>Audit Information</h2></div>
      <div class="data-list">
        ${detailRow("Recorded On", formatMediumDateTime(visit.recordedOn))}
        ${detailRow("Recorded By", visit.recordedBy)}
        ${detailRow("Last Modified", formatMediumDateTime(visit.lastModified))}
        ${detailRow("Last Modified By", visit.lastModifiedBy)}
      </div>
    </div>
    <div class="settings-section">
      <div><h2>Report / Attachment</h2></div>
      ${deduplicateSiteVisitAttachments(visit.attachmentRecords || [], visit.id).length ? `<div class="attached-files">${deduplicateSiteVisitAttachments(visit.attachmentRecords || [], visit.id).map((file) => `<div class="attached-file"><span title="${safeDetailValue(file.name)}">${safeDetailValue(file.name)} · ${safeDetailValue(file.type || "File")} · ${formatFileSize(file.size)} · uploaded ${formatMediumDateTime(file.uploadedAt)}</span><div class="file-actions"><button class="secondary-button" data-file-preview="${file.id}" type="button">View</button><button class="secondary-button" data-file-download="${file.id}" type="button">Download</button>${siteVisitRemoveControl(file, "Remove Report")}</div></div>`).join("")}</div>` : `<p>No report attached.</p>`}
    </div>
    <div class="modal-actions">${canManageOperations() ? `<button class="secondary-button" data-modal="siteVisit" data-mode="edit" data-visit-id="${visit.id}" type="button">Edit Visit / Replace Report</button><button class="danger-button" data-operational-delete="${visit.id}" data-delete-type="siteVisit" type="button">Delete</button>` : ""}<button class="secondary-button" type="button" id="cancel-modal">Close</button></div>
  `;
  document.getElementById("modal-backdrop").classList.remove("hidden");
  resetModalScroll();
}

function openFaultDetail(faultId) {
  const fault = state.faults.find((item) => item.id === faultId);
  if (!fault) return;
  state.currentFaultId = fault.id;
  const form = document.getElementById("modal-form");
  document.querySelector(".modal")?.classList.remove("preview-modal");
  document.getElementById("modal-title").textContent = "Fault Details";
  document.getElementById("modal-eyebrow").textContent = "Operational Record";
  form.dataset.type = "faultDetail";
  form.innerHTML = `<div class="settings-section"><div><h2>${safeDetailValue(fault.faultId)}</h2></div><div class="data-list">
    ${detailRow("Site", fault.siteName)}${detailRow("Charger", fault.chargerName)}${detailRow("Status", fault.status)}
    ${fault.faultCode ? detailRow("Fault Code / DTC", fault.faultCode) : ""}${fault.ftbCode ? detailRow("FTB Code", fault.ftbCode) : ""}${fault.component ? detailRow("Component / ECU", fault.component) : ""}
    ${detailRow("Fault Title", fault.faultName)}${detailRow("Catalogue Description", fault.faultDescription)}
    ${detailRow("Possible Causes", fault.possibleCauses)}${detailRow("Recommended Actions", fault.recommendedAction)}
    ${detailRow("Priority (response urgency)", fault.priority || "Medium")}${detailRow("Severity (technical impact)", normalizedFaultSeverity(fault.severity))}${detailRow("Category", fault.category)}${detailRow("Technician Description", fault.description)}
  </div></div><div class="settings-section"><div><h2>Photo Evidence</h2></div>${faultPhotosMarkup(fault)}</div>
  <div class="modal-actions">${canManageOperations() ? `<button class="secondary-button" data-modal="fault" data-mode="edit" data-fault-id="${fault.id}" type="button">Edit Fault</button><button class="danger-button" data-operational-delete="${fault.id}" data-delete-type="fault" type="button">Delete</button>` : ""}<button class="secondary-button" id="cancel-modal" type="button">Close</button></div>`;
  document.getElementById("modal-backdrop").classList.remove("hidden");
  resetModalScroll();
}

function readFileAsDataUrl(fileInputId) {
  const input = document.getElementById(fileInputId);
  const file = input?.files?.[0];
  if (!file) return Promise.resolve("");
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result || "");
    reader.onerror = () => resolve("");
    reader.readAsDataURL(file);
  });
}

function readSingleFileAsDataUrl(file) {
  if (!file) return Promise.resolve("");
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result || "");
    reader.onerror = () => resolve("");
    reader.readAsDataURL(file);
  });
}

function getSelectedCharger() {
  const form = document.getElementById("modal-form");
  const siteLocked = form?.dataset.lockSite === "true" || form?.dataset.lockLocation === "true";
  const chargerLocked = form?.dataset.lockLocation === "true";
  const siteSelection = siteLocked ? form.dataset.siteId : (document.getElementById("site")?.value || document.getElementById("related-site")?.value || "");
  const site = siteFromFaultSelection(siteSelection);
  const chargerId = chargerLocked ? form.dataset.chargerId : (document.getElementById("charger")?.value || "");
  const charger = site?.chargers?.find((item) => item.id === chargerId);
  return { site, siteName: site?.name || "", chargerId, chargerName: charger?.name || "", charger };
}

async function collectUploadedFiles(type, relationships = {}) {
  const fileInputs = Array.from(document.querySelectorAll("#modal-form input[type='file']")).filter((input) => input.files?.length && input.id !== "upload-site-image" && input.id !== "upload-charger-image");
  const { siteName, chargerId, chargerName } = getSelectedCharger();
  const records = [];
  for (const input of fileInputs) {
    for (const file of Array.from(input.files)) {
      validateModuleFile(type, input.id, file);
      const moduleName = moduleNameForUpload(type);
      const category = uploadCategoryForType(type, input.id);
      const parentType = { document: "documents", fault: "faults", guide: "troubleshooting" }[type];
      const parentId = relationships.parentId || relationships.faultId || relationships.troubleshootingGuideId || `record-${crypto.randomUUID()}`;
      const common = {
        kind: type,
        module: moduleName,
        category,
        siteVisitId: relationships.siteVisitId || "",
        faultId: relationships.faultId || "",
        weeklyReportId: relationships.weeklyReportId || "",
        troubleshootingGuideId: relationships.troubleshootingGuideId || "",
        siteName,
        chargerId,
        chargerName,
        name: file.name,
        fileName: file.name,
        originalFileName: file.name,
        title: document.getElementById("document-title")?.value.trim() || document.getElementById("report-title")?.value.trim() || document.getElementById("guide-title")?.value.trim() || file.name,
        documentType: documentTypeForNewUpload(type, input.id),
        weekStart: document.getElementById("week-start")?.value || "",
        weekEnd: document.getElementById("week-end")?.value || "",
        guideCategory: document.getElementById("category")?.value || "",
        guideVersion: document.getElementById("version")?.value.trim() || "",
        faultCatalogueId: document.getElementById("relevant-fault-code")?.value || "",
        description: document.getElementById("description")?.value.trim() || "",
        type: file.type || "application/octet-stream",
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        fileSize: file.size,
        uploadedBy: state.currentUser,
        uploadedAt: new Date().toISOString(),
        storagePath: `prototype-storage/${siteName || "unassigned"}/${relationships.siteVisitId || relationships.faultId || relationships.weeklyReportId || relationships.troubleshootingGuideId || "general"}/${file.name}`,
      };
      if (parentType) {
        const response = await window.QatarOpsApi.Attachments.upload(parentType, parentId, file);
        records.push(mapBackendAttachment(response.attachment, common));
      } else {
        const dataUrl = await readSingleFileAsDataUrl(file);
        if (!dataUrl) throw new Error("The selected file could not be saved. Please choose the file again and retry.");
        records.push(normalizeUploadRecord({ ...common, id: `file-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, dataUrl }));
      }
    }
  }
  return records;
}

function selectedOperationalFiles() {
  return Array.from(document.querySelectorAll("#modal-form input[type='file']"))
    .filter((input) => !["upload-site-image", "upload-charger-image"].includes(input.id))
    .flatMap((input) => Array.from(input.files || []).map((file) => ({ input, file })));
}

async function persistOperationalFiles(parentType, parentId, type, existingAttachments = []) {
  const selected = selectedOperationalFiles();
  const saved = [];
  for (let index = 0; index < selected.length; index += 1) {
    const { input, file } = selected[index];
    validateModuleFile(type, input.id, file);
    const response = index === 0 && existingAttachments[0]
      ? await window.QatarOpsApi.Attachments.replace(existingAttachments[0].id, file)
      : await window.QatarOpsApi.Attachments.upload(parentType, parentId, file);
    saved.push(response.attachment);
  }
  return saved;
}

function uploadCategoryForType(type, inputId = "") {
  if (type === "siteVisit" && inputId === "site-visit-report-upload") return "Site Visit Report";
  if (type === "visitReport") return "Site Visit Report";
  if (type === "weeklyReport") return "Weekly Report";
  if (type === "fault") return "Fault Photo";
  if (type === "guide") return "Troubleshooting Guide";
  if (type === "document") return "Charger Document";
  return "Needs Classification";
}

function documentTypeForNewUpload(type, inputId = "") {
  if (type === "siteVisit" && inputId === "site-visit-report-upload") return "site_visit_report";
  if (type === "visitReport") return "site_visit_report";
  if (type === "fault") return "fault_photo";
  if (type === "weeklyReport") return "weekly_report";
  if (type === "guide") return "troubleshooting_guide";
  if (type === "document") return document.getElementById("document-category")?.value || "charger_document";
  return "needs_classification";
}

function moduleNameForUpload(type) {
  if (type === "siteVisit" || type === "visitReport") return "siteVisit";
  if (type === "fault") return "fault";
  if (type === "weeklyReport") return "weeklyReport";
  if (type === "guide") return "troubleshooting";
  if (type === "document") return "chargerDocument";
  return "needsClassification";
}

function validateModuleFile(type, inputId, file) {
  if (type === "fault") {
    if (!IMAGE_UPLOAD_TYPES.includes(file.type)) throw new Error("Fault evidence must be JPG, PNG, or WebP.");
    if (file.size > IMAGE_UPLOAD_MAX_BYTES) throw new Error("Fault evidence must be 5 MB or smaller.");
    return;
  }
  if (!/\.(pdf|doc|docx|xls|xlsx|ppt|pptx|jpe?g|png|webp|gif|txt|csv)$/i.test(file.name)) throw new Error("Supported files are PDF, Office documents, images, TXT, and CSV.");
  if (!file.size) throw new Error("Empty files cannot be uploaded.");
  if (file.size > 25 * 1024 * 1024) throw new Error("Files must be 25 MB or smaller.");
}

function calculateVisitDuration(timeIn, timeOut) {
  if (!timeIn || !timeOut || timeOut < timeIn) return "";
  const [inHours, inMinutes] = timeIn.split(":").map(Number);
  const [outHours, outMinutes] = timeOut.split(":").map(Number);
  const totalMinutes = (outHours * 60 + outMinutes) - (inHours * 60 + inMinutes);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (!hours) return `${minutes}m`;
  if (!minutes) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

async function handleModalSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const required = Array.from(form.querySelectorAll("[data-required='true']")).filter((input) => !input.value.trim());
  if (required.length) {
    document.getElementById("modal-error").textContent = "Please complete the visible form fields before saving.";
    return;
  }
  if (form.dataset.type === "siteVisit" && !validateVisitTimes()) return;
  const siteImageInput = document.getElementById("upload-site-image");
  if (form.dataset.type === "site" && siteImageInput?.files?.[0] && !pendingModalImage) {
    await handleSiteImageSelection();
    if (!pendingModalImage) return;
  }
  const button = form.querySelector("button[type='submit']");
  button.classList.add("is-loading");
  button.disabled = true;
  button.textContent = button.dataset.loadingText;
  setTimeout(async () => {
    try {
      await simulateUpdate(form.dataset.type, form.dataset.mode);
      button.textContent = "Saved";
      setTimeout(closeModal, 300);
    } catch (error) {
      console.error("Save failed", error);
      document.getElementById("modal-error").textContent = error.message || "The record could not be saved.";
      button.textContent = "Save";
    } finally {
      button.classList.remove("is-loading");
      button.disabled = false;
    }
  }, 350);
}

function validateVisitTimes() {
  const error = document.getElementById("modal-error");
  if (error) error.textContent = "";
  const visitDate = document.getElementById("visit-date")?.value || "";
  const timeIn = document.getElementById("time-in")?.value || "";
  const timeOut = document.getElementById("time-out")?.value || "";
  const engineer = document.getElementById("engineer-name")?.value.trim() || document.getElementById("technician-name")?.value.trim() || "";
  const status = document.getElementById("visit-status")?.value || "";
  if (!visitDate || !timeIn || !engineer) {
    if (error) error.textContent = "Visit Date, Time In, and Engineer / Technician are required.";
    return false;
  }
  if (!timeOut && status !== "Ongoing") {
    if (error) error.textContent = "Time Out is required unless the visit status is Ongoing.";
    return false;
  }
  if (timeIn && timeOut && timeOut < timeIn) {
    if (error) error.textContent = "Time Out cannot be earlier than Time In.";
    return false;
  }
  return true;
}

function backendCodeFromName(name, fallback = "RECORD") {
  const code = String(name || fallback)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 50);
  return code.length >= 2 ? code : `${code || fallback}_1`;
}

function backendSiteStatus(status) {
  return String(status || "").toLowerCase() === "archived" ? "archived" : "active";
}

function backendChargerStatus(status) {
  const normalized = String(status || "").toLowerCase();
  if (["maintenance", "faulted", "archived"].includes(normalized)) return normalized;
  if (["warning", "critical"].includes(normalized)) return "faulted";
  return "active";
}

function parsePowerKw(value) {
  const match = String(value || "").match(/\d+(\.\d+)?/);
  return match ? Number(match[0]) : 0;
}

function userFriendlyApiError(error) {
  if (error?.status === 409) return "A record with the same code or name already exists.";
  if (error?.status === 400) return error.message || "Please check the form values and try again.";
  if (error?.status === 403) return "You do not have permission to save this record.";
  return error?.message || "The backend could not save this record.";
}

async function simulateUpdate(type, mode = "edit") {
  let activity = null;
  if (type === "contentDelete") {
    const form = document.getElementById("modal-form");
    if (document.getElementById("content-delete-confirmation")?.value.trim() !== "DELETE") throw new Error("Type DELETE exactly to confirm permanent deletion.");
    await window.QatarOpsApi.ContentRecords.remove(form.dataset.contentType, form.dataset.recordId);
    state.uploads = state.uploads.filter((file) => file.recordId !== form.dataset.recordId);
    await loadOperationalData();
    return;
  }
  if (type === "legacyContentDelete") {
    const form = document.getElementById("modal-form");
    if (document.getElementById("content-delete-confirmation")?.value.trim() !== "DELETE") throw new Error("Type DELETE exactly to confirm permanent deletion.");
    const existing = state.uploads.find((file) => file.id === form.dataset.fileId && !file.recordPersisted);
    if (!existing) throw new Error("This record is no longer available.");
    state.uploads = state.uploads.filter((file) => file.id !== form.dataset.fileId);
    saveState();
    refreshOpenProfiles();
    renderCounts();
    return;
  }
  if (type === "operationalDelete") {
    const form = document.getElementById("modal-form");
    if (document.getElementById("operational-delete-confirmation")?.value.trim() !== "DELETE") throw new Error("Type DELETE exactly to confirm deletion.");
    if (form.dataset.deleteType === "siteVisit") await window.QatarOpsApi.SiteVisits.remove(form.dataset.recordId);
    else await window.QatarOpsApi.Faults.remove(form.dataset.recordId);
    await loadOperationalData();
    return;
  }
  if (type === "site") {
    const name = document.getElementById("site-name")?.value.trim();
    const location = document.getElementById("location")?.value.trim();
    const client = document.getElementById("client-organization")?.value.trim();
    const status = document.getElementById("status")?.value || "Pending Data";
    const description = document.getElementById("description")?.value.trim();
    const notes = document.getElementById("notes")?.value.trim();
    if (!name) throw new Error("Site name is required.");
    const existing = mode !== "create" ? getSite(state.currentSiteName) : null;
    const payload = {
      name,
      code: existing?.code || backendCodeFromName(name),
      location: location || null,
      address: client || null,
      description: [description, notes].filter(Boolean).join("\n\n") || null,
    };
    try {
      const response = existing?.id
        ? await window.QatarOpsApi.Sites.update(existing.id, payload)
        : await window.QatarOpsApi.Sites.create(payload);
      if (backendSiteStatus(status) !== (response.site?.status || "active")) {
        await window.QatarOpsApi.Sites.updateStatus(response.site.id, backendSiteStatus(status));
      }
      if (pendingSiteImageFile) {
        try {
          const imageResponse = await window.QatarOpsApi.Sites.uploadImage(response.site.id, pendingSiteImageFile);
          response.site = imageResponse.site || response.site;
        } catch (uploadError) {
          await loadOperationalData();
          throw new Error(`Site details were saved, but the image upload failed: ${userFriendlyApiError(uploadError)}`);
        }
      }
      state.currentSiteName = response.site?.name || name;
      await loadOperationalData();
      if (state.currentSiteName) openSite(state.currentSiteName);
      activity = { actionType: existing ? "site_updated" : "site_added", entityType: "site", entityId: state.currentSiteName, description: `${state.currentSiteName} site ${existing ? "information updated" : "added"}`, siteName: state.currentSiteName };
    } catch (error) {
      throw new Error(userFriendlyApiError(error));
    }
  }
  if (type === "contact") {
    const assignedSiteName = document.getElementById("assigned-site")?.value || "";
    const site = assignedSiteName ? getSite(assignedSiteName) : null;
    if (assignedSiteName && !site?.id) throw new Error("Choose a valid assigned site.");
    const payload = {
      site_id: site?.id || null,
      contact_name: document.getElementById("name")?.value.trim(),
      job_title: document.getElementById("role")?.value.trim() || null,
      organization: document.getElementById("organization-department")?.value.trim() || null,
      phone: document.getElementById("phone")?.value.trim() || null,
      email: document.getElementById("email")?.value.trim() || null,
      notes: document.getElementById("notes")?.value.trim() || null,
    };
    if (!payload.contact_name) throw new Error("Contact name is required.");
    try {
      if (mode === "create") await window.QatarOpsApi.Contacts.create(payload);
      else await window.QatarOpsApi.Contacts.update(state.currentContactId, payload);
      await loadOperationalData();
      renderContactsPage();
    } catch (error) { throw new Error(userFriendlyApiError(error)); }
  }
  if (type === "charger") {
    const form = document.getElementById("modal-form");
    const lockedSiteId = mode === "create" ? form?.dataset.siteId : "";
    const siteName = document.getElementById("site")?.value || state.currentSiteName || state.sites[0]?.name;
    const site = lockedSiteId ? state.sites.find((item) => item.id === lockedSiteId) : getSite(siteName);
    if (!site?.id) throw new Error("Choose a valid site before saving this charger.");
    const name = document.getElementById("charger-name")?.value.trim();
    const chargerType = document.getElementById("charger-type")?.value;
    if (!name) throw new Error("Charger name is required.");
    if (!["AC", "DC"].includes(chargerType)) throw new Error("Charger type must be AC or DC for the backend MVP.");
    const existing = mode !== "create" ? getCharger(state.currentSiteName, state.currentChargerId) : null;
    const payload = {
      site_id: site.id,
      name,
      code: existing?.code || backendCodeFromName(name),
      manufacturer: document.getElementById("manufacturer")?.value.trim() || null,
      operator: document.getElementById("operator")?.value.trim() || null,
      administrator: document.getElementById("administrator")?.value.trim() || null,
      installation_date: document.getElementById("installation-date")?.value || null,
      model: document.getElementById("model")?.value.trim() || null,
      serial_number: document.getElementById("serial-number")?.value.trim() || null,
      type: chargerType,
      power_kw: parsePowerKw(document.getElementById("capacity")?.value),
      firmware_version: null,
      description: document.getElementById("notes")?.value.trim() || null,
    };
    try {
      const response = existing?.id
        ? await window.QatarOpsApi.Chargers.update(existing.id, payload)
        : await window.QatarOpsApi.Chargers.create(payload);
      const requestedStatus = backendChargerStatus(document.getElementById("status")?.value);
      if (requestedStatus !== (response.charger?.status || "active")) {
        await window.QatarOpsApi.Chargers.updateStatus(response.charger.id, requestedStatus);
      }
      state.currentSiteName = response.charger?.site_name || site.name;
      state.currentChargerId = response.charger?.id || existing?.id || "";
      await loadOperationalData();
      refreshOpenProfiles();
      activity = {
        actionType: existing ? "charger_updated" : "charger_added",
        entityType: "charger",
        entityId: state.currentChargerId,
        description: `${name} ${existing ? "information updated in" : "added to"} ${state.currentSiteName}`,
        siteName: state.currentSiteName,
        chargerName: name,
      };
    } catch (error) {
      throw new Error(userFriendlyApiError(error));
    }
  }
  if (type === "deleteCharger") {
    const confirmation = document.getElementById("type-remove-to-confirm")?.value.trim();
    if (confirmation !== "REMOVE") return;
    const siteName = state.currentSiteName;
    const charger = getCharger();
    const chargerName = charger?.name || "Charger";
    const chargerId = charger?.id || state.currentChargerId;
    if (!chargerId) throw new Error("No charger is selected.");
    try {
      await window.QatarOpsApi.Chargers.archive(chargerId);
      state.currentChargerId = "";
      await loadOperationalData();
      document.getElementById("charger-profile").classList.add("hidden");
      if (state.currentSiteName) openSite(state.currentSiteName, "Chargers");
    } catch (error) {
      throw new Error(userFriendlyApiError(error));
    }
    addActivity({
      actionType: "charger_archived",
      entityType: "charger",
      entityId: chargerId,
      description: `${chargerName} archived from ${siteName}`,
      siteName,
      chargerName,
    });
    renderCounts();
    saveState();
    renderActivity();
    return;
  }
  if (type === "user") {
    if (!isAdmin()) return;
    const fullName = document.getElementById("full-name")?.value.trim();
    const email = document.getElementById("work-email")?.value.trim().toLowerCase();
    const roleLabel = document.getElementById("role")?.value || "Operations Staff";
    const role = { "Administrator": "admin", "Operations Staff": "operations_staff", "Viewer": "viewer" }[roleLabel] || "operations_staff";
    const temporaryPassword = document.getElementById("temporary-password")?.value.trim();
    if (!fullName || !email || !temporaryPassword) throw new Error("Full name, email, and temporary password are required.");
    await window.QatarOpsApi.Users.create({
      full_name: fullName,
      email,
      password: temporaryPassword,
      role,
    });
    await loadManagedUsers();
    renderSettings("User Management");
    activity = { actionType: "user_created", entityType: "user", entityId: email, description: `${fullName} user account created` };
  }
  if (type === "faultCode") {
    if (!isAdmin()) return;
    const dtcId = form.dataset.dtcId || "";
    const faultCode = document.getElementById("fault-code")?.value.trim();
    const faultName = document.getElementById("fault-name")?.value.trim();
    if (!faultCode || !faultName) {
      throw new Error("Enter a unique fault code and fault name.");
    }
    const payload = {
      dtc_code: faultCode,
      fault_title: faultName,
      description: document.getElementById("meaning")?.value.trim() || "",
      severity: document.getElementById("severity")?.value || "Not Classified",
      recommended_actions: document.getElementById("recommended-action")?.value.trim() || "",
      is_active: document.getElementById("status")?.value !== "Disabled",
    };
    const response = dtcId ? await window.QatarOpsApi.Dtc.update(dtcId, payload) : await window.QatarOpsApi.Dtc.create(payload);
    const entry = normalizeFaultCatalogueRecord(response.dtc_record);
    state.faultCatalogue = [entry, ...state.faultCatalogue.filter((item) => item.id !== entry.id)];
    activity = { actionType: dtcId ? "fault_catalogue_updated" : "fault_catalogue_added", entityType: "fault_catalogue", entityId: entry.id, description: `${entry.faultCode} ${dtcId ? "updated in" : "added to"} DTC catalogue` };
  }
  if (type === "fault") {
    const { site, siteName, chargerId, chargerName, charger } = getSelectedCharger();
    if (!site?.id || !chargerId || !charger || (charger.site_id && charger.site_id !== site.id)) throw new Error("Choose a valid site and charger before saving this fault.");
    selectedOperationalFiles().forEach(({ input, file }) => validateModuleFile(type, input.id, file));
    const hasTechnicalCode = document.getElementById("has-technical-code")?.value === "Yes";
    const catalogueItem = hasTechnicalCode ? selectedFaultCatalogueItem("fault-code") : null;
    const status = document.getElementById("fault-status")?.value || "Open";
    const reportedDate = document.getElementById("date-reported")?.value || new Date().toISOString().slice(0, 10);
    const reportedTime = document.getElementById("time-reported")?.value || new Date().toTimeString().slice(0, 5);
    const existing = mode !== "create" ? state.faults.find((item) => item.id === state.currentFaultId) : null;
    const backendValue = (value) => String(value || "").trim().toLowerCase().replace(/\s+/g, "_");
    const payload = {
      site_id: site.id, charger_id: chargerId, fault_catalogue_id: catalogueItem?.id || null,
      fault_code: hasTechnicalCode ? document.getElementById("dtc-code")?.value.trim() || null : null,
      ftb_code: hasTechnicalCode ? document.getElementById("ftb-code")?.value.trim() || null : null,
      component: hasTechnicalCode ? document.getElementById("component-ecu")?.value.trim() || null : null,
      fault_type: document.getElementById("fault-category")?.value || "Other",
      title: document.getElementById("fault-title")?.value.trim() || "Manual fault",
      description: document.getElementById("description")?.value.trim() || null,
      technician_observation: hasTechnicalCode ? document.getElementById("catalogue-description")?.value.trim() || null : null,
      possible_causes: hasTechnicalCode ? document.getElementById("possible-causes")?.value.trim() || null : null,
      recommended_actions: hasTechnicalCode ? document.getElementById("recommended-actions")?.value.trim() || null : null,
      category: document.getElementById("fault-category")?.value || "Other",
      technical_category: hasTechnicalCode ? document.getElementById("technical-category")?.value.trim() || null : null,
      severity: backendValue(document.getElementById("severity")?.value || "medium"), priority: backendValue(document.getElementById("priority")?.value || "medium"),
      status: backendValue(status), charger_status: document.getElementById("current-charger-status")?.value || null,
      reported_by_name: document.getElementById("reported-by")?.value.trim() || state.currentUser || null,
      comments: document.getElementById("comments")?.value.trim() || null, resolution_notes: document.getElementById("comments")?.value.trim() || null,
      requires_site_visit: document.getElementById("site-visit-required")?.value === "Yes", reported_at: new Date(`${reportedDate}T${reportedTime}`).toISOString(),
    };
    const response = existing ? await window.QatarOpsApi.Faults.update(existing.id, payload) : await window.QatarOpsApi.Faults.create(payload);
    const fault = normalizeFaultRecord(response.fault);
    try { await persistOperationalFiles("faults", fault.id, type, existing?.attachmentRecords || []); }
    catch (error) { await loadOperationalData(); throw new Error(`The fault was saved, but its photo upload failed. Reopen the fault to retry. ${error.message}`); }
    state.currentFaultId = fault.id;
    await loadOperationalData();
    activity = {
      actionType: existing ? "fault_updated" : "fault_reported",
      entityType: "fault",
      entityId: fault.faultId,
      description: `${fault.faultId} ${existing ? "updated" : "reported"} for ${chargerName || "selected charger"} at ${siteName}`,
      siteName,
      chargerName,
    };
  }
  if (type === "siteVisit") {
    const { siteName, chargerId, chargerName } = getSelectedCharger();
    const site = getSite(siteName);
    const visitDate = document.getElementById("visit-date")?.value || new Date().toISOString().slice(0, 10);
    const timeIn = document.getElementById("time-in")?.value || "";
    const timeOut = document.getElementById("time-out")?.value || "";
    if (!site?.id) throw new Error("Choose a valid site before saving this visit.");
    selectedOperationalFiles().forEach(({ input, file }) => validateModuleFile(type, input.id, file));
    const payload = {
      site_id: site.id,
      charger_id: chargerId || null,
      visit_date: visitDate,
      time_in: timeIn || null,
      time_out: timeOut || null,
      visited_by: document.getElementById("engineer-name")?.value.trim() || document.getElementById("technician-name")?.value.trim() || state.currentUser || "Operations Staff",
      purpose: document.getElementById("purpose")?.value.trim() || "Site visit",
      status: backendSiteVisitStatus(document.getElementById("visit-status")?.value || "Completed"),
      observations: document.getElementById("findings")?.value.trim() || document.getElementById("notes")?.value.trim() || null,
      actions_taken: document.getElementById("work-completed")?.value.trim() || null,
    };
    const existing = mode !== "create" ? state.visits.find((item) => item.id === state.currentVisitId) : null;
    const response = existing?.id
      ? await window.QatarOpsApi.SiteVisits.update(existing.id, payload)
      : await window.QatarOpsApi.SiteVisits.create(payload);
    const savedVisit = mapBackendSiteVisit(response.site_visit);
    const existingIndex = state.visits.findIndex((item) => item.id === savedVisit.id);
    if (existingIndex >= 0) state.visits.splice(existingIndex, 1, savedVisit);
    else state.visits.unshift(savedVisit);
    state.currentVisitId = savedVisit.id;
    try {
      await persistOperationalFiles("site-visits", savedVisit.id, type, existing?.attachmentRecords || []);
    } catch (error) {
      await loadOperationalData();
      throw new Error(existing
        ? `The visit changes were saved, but the replacement report failed and the existing report remains active. ${error.message}`
        : `The visit was saved, but its report upload failed. Reopen the visit to retry. ${error.message}`);
    }
    activity = {
      actionType: existing ? "site_visit_updated" : "site_visit_added",
      entityType: "site_visit",
      entityId: savedVisit.id,
      description: `${savedVisit.status} site visit ${existing ? "updated" : "added"} for ${siteName}`,
      siteName,
      chargerName,
    };
  }
  if (["document", "weeklyReport", "guide"].includes(type)) {
    const { siteName, chargerId } = getSelectedCharger();
    const site = getSite(siteName);
    const apiType = type === "document" ? "documents" : type === "weeklyReport" ? "weekly-reports" : "troubleshooting";
    const payload = type === "document" ? {
      site_id: site?.id || null, charger_id: chargerId || null, title: document.getElementById("document-title")?.value.trim() || "Document",
      document_type: document.getElementById("document-category")?.value || "Other", document_date: document.getElementById("document-date")?.value || new Date().toISOString().slice(0,10),
      description: document.getElementById("description")?.value.trim() || null,
    } : type === "weeklyReport" ? {
      site_id: site?.id || null, title: document.getElementById("report-title")?.value.trim() || "Weekly Report",
      period_start: document.getElementById("week-start")?.value, period_end: document.getElementById("week-end")?.value,
      notes: document.getElementById("summary")?.value.trim() || null,
    } : {
      site_id: site?.id || null, charger_id: chargerId || null, title: document.getElementById("guide-title")?.value.trim() || "Troubleshooting Record",
      issue_category: document.getElementById("category")?.value || "Other", symptoms: document.getElementById("symptoms")?.value.trim() || null,
      possible_cause: document.getElementById("possible-cause")?.value.trim() || null, troubleshooting_steps: document.getElementById("troubleshooting-steps")?.value.trim() || null,
      resolution: document.getElementById("resolution")?.value.trim() || null, notes: document.getElementById("notes")?.value.trim() || null,
    };
    const legacyId = mode !== "create" ? state.currentLegacyContentId : "";
    if (legacyId) {
      if (selectedOperationalFiles().length) throw new Error("This early-testing record has no backend parent. Save metadata without selecting a replacement file, or re-upload it as a new managed record.");
      const legacy = state.uploads.find((file) => file.id === legacyId && !file.recordPersisted);
      if (!legacy) throw new Error("This record is no longer available.");
      Object.assign(legacy, {
        siteName, chargerId, chargerName: getSelectedCharger().chargerName,
        title: payload.title,
        documentType: type === "document" ? payload.document_type : legacy.documentType,
        documentDate: type === "document" ? payload.document_date : legacy.documentDate,
        description: type === "document" ? payload.description || "" : legacy.description,
        weekStart: type === "weeklyReport" ? payload.period_start : legacy.weekStart,
        weekEnd: type === "weeklyReport" ? payload.period_end : legacy.weekEnd,
        notes: type === "weeklyReport" || type === "guide" ? payload.notes || "" : legacy.notes,
        guideCategory: type === "guide" ? payload.issue_category : legacy.guideCategory,
        symptoms: type === "guide" ? payload.symptoms || "" : legacy.symptoms,
        possibleCause: type === "guide" ? payload.possible_cause || "" : legacy.possibleCause,
        troubleshootingSteps: type === "guide" ? payload.troubleshooting_steps || "" : legacy.troubleshootingSteps,
        resolution: type === "guide" ? payload.resolution || "" : legacy.resolution,
      });
      saveState();
      refreshOpenProfiles();
      return;
    }
    const existingId = mode !== "create" ? state.currentContentRecordId : "";
    const response = existingId ? await window.QatarOpsApi.ContentRecords.update(apiType, existingId, payload) : await window.QatarOpsApi.ContentRecords.create(apiType, payload);
    const recordId = response.record.id;
    const existingFile = state.uploads.find((file) => file.recordId === recordId && file.persisted);
    const selected = selectedOperationalFiles();
    if (selected[0]) {
      validateModuleFile(type, selected[0].input.id, selected[0].file);
      try {
        if (existingFile) await window.QatarOpsApi.Attachments.replace(existingFile.id, selected[0].file);
        else await window.QatarOpsApi.Attachments.upload(apiType, recordId, selected[0].file);
      } catch (error) {
        await loadOperationalData();
        throw new Error(existingFile
          ? `The metadata was saved, but file replacement failed. The existing attachment remains active. ${error.message}`
          : `The record was saved, but the attachment upload failed. Reopen the record to retry. ${error.message}`);
      }
    }
    state.currentContentRecordId = recordId;
    await loadOperationalData();
  }
  if (type === "visitReport") {
    const currentFault = null;
    const uploads = await collectUploadedFiles(type, {
      parentId: `record-${crypto.randomUUID()}`,
      faultId: currentFault?.faultId || "",
      weeklyReportId: type === "weeklyReport" ? `weekly-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` : "",
      troubleshootingGuideId: type === "guide" ? `guide-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` : "",
    });
    if (uploads.length) {
      const legacyReplacementId = state.pendingLegacyReplacementId || "";
      if (legacyReplacementId) state.uploads = state.uploads.filter((file) => file.id !== legacyReplacementId);
      state.uploads.unshift(...uploads);
      if (currentFault) currentFault.photos = uploads.map((file) => file.id);
      state.pendingLegacyReplacementId = "";
    }
  }
  if (type === "document") {
    const { siteName, chargerName } = getSelectedCharger();
    const title = document.getElementById("document-title")?.value.trim() || "Document";
    activity = { actionType: "document_uploaded", entityType: "upload", description: `${title} uploaded for ${siteName}`, siteName, chargerName };
  }
  if (type === "weeklyReport") {
    const { siteName, chargerName } = getSelectedCharger();
    activity = { actionType: "weekly_report_uploaded", entityType: "upload", description: `Weekly report uploaded for ${siteName}`, siteName, chargerName };
  }
  if (type === "visitReport") {
    const { siteName, chargerName } = getSelectedCharger();
    const title = document.getElementById("report-title")?.value.trim() || "Site visit report";
    activity = { actionType: "visit_report_uploaded", entityType: "upload", description: `${title} uploaded for ${siteName}`, siteName, chargerName };
  }
  if (type === "guide") {
    const { siteName, chargerName } = getSelectedCharger();
    const title = document.getElementById("guide-title")?.value.trim() || "Troubleshooting guide";
    activity = { actionType: "guide_saved", entityType: "guide", description: `${title} saved for ${chargerName || siteName}`, siteName, chargerName };
  }
  if (activity) addActivity(activity);
  if (type === "siteVisit") await loadOperationalData();
  if (["siteVisit", "visitReport", "fault", "document", "weeklyReport", "guide", "charger", "site"].includes(type)) refreshOpenProfiles();
  renderCounts();
  saveState();
  renderActivity();
}
