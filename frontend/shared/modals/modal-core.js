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
