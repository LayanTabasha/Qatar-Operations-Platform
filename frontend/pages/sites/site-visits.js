function hasBackendAttachmentId(file) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(file?.id || ""));
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

function canRemoveSiteVisitAttachment(file) {
  return hasBackendAttachmentId(file) && canManageOperations();
}

function siteVisitRemoveControl(file, label = "Remove") {
  if (canRemoveSiteVisitAttachment(file)) return `<button class="danger-button" data-site-visit-report-remove="${file.id}" type="button">${label}</button>`;
  const reason = hasBackendAttachmentId(file) ? "Your account cannot remove Site Visit reports" : "Remove unavailable: backend attachment ID is missing";
  return `<button class="danger-button" type="button" disabled title="${reason}">${label}</button>`;
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

function relatedFaultsEditorMarkup() {
  const visit = state.visits.find((item) => item.id === state.currentVisitId);
  const selected = new Map((visit?.relatedFaults || []).map((link) => [link.fault_id, link]));
  const siteName = document.getElementById("site")?.value || visit?.siteName || state.currentSiteName;
  const faults = state.faults.filter((fault) => fault.siteName === siteName);
  return `<section class="settings-section related-faults-editor full" id="related-faults-editor"><div class="related-faults-head"><h2>Related Faults</h2><p>Select faults addressed during this visit and record visit-specific progress.</p></div><label class="related-fault-search full"><span class="sr-only">Search faults</span><input id="related-fault-search" type="search" placeholder="Search by fault ID, title or status..." autocomplete="off" /></label><div class="related-fault-options full" id="related-fault-options">${faults.length ? faults.map((fault) => {
    const link = selected.get(fault.id);
    const status = ({open:"Open",in_progress:"In Progress",monitoring:"Monitoring",resolved:"Resolved"}[link?.status_after_visit] || link?.status_after_visit || fault.status);
    const statusClass = String(fault.status || "open").toLowerCase().replace(/\s+/g, "-");
    const preview = fault.description || fault.comments || fault.faultDescription || "";
    return `<article class="fault-visit-picker-card related-fault-card${link ? " is-selected is-linked" : ""}" data-related-fault-row data-related-fault-card="${fault.id}" data-search="${safeDetailValue(`${fault.faultId} ${fault.faultName} ${fault.status}`.toLowerCase())}"><label class="fault-visit-picker-choice related-fault-choice"><input type="checkbox" data-related-fault="${fault.id}"${link ? " checked" : ""} /><span class="fault-visit-card-copy"><span class="related-fault-card-top"><strong>${safeDetailValue(fault.faultId)}</strong><span class="related-fault-card-badges">${link ? `<span class="fault-visit-linked-badge">Linked</span>` : ""}<span class="fault-selector-status status-${statusClass}">${safeDetailValue(fault.status)}</span></span></span><strong>${safeDetailValue(fault.faultName)}</strong>${fault.chargerName ? `<small>${safeDetailValue(fault.chargerName)}</small>` : ""}${preview ? `<p>${safeDetailValue(preview)}</p>` : ""}</span></label><div class="fault-visit-link-fields${link ? "" : " hidden"}" data-related-fault-fields="${fault.id}"><label><span>Progress Update</span><textarea data-fault-progress="${fault.id}" rows="2" placeholder="What happened with this fault during this visit?">${link?.progress_update ? safeDetailValue(link.progress_update) : ""}</textarea></label><label><span>Status After Visit</span><select data-fault-after-status="${fault.id}">${FAULT_STATUS_OPTIONS.map((item) => `<option${item === status ? " selected" : ""}>${item}</option>`).join("")}</select></label></div></article>`;
  }).join("") : `<p class="detail-muted">No faults belong to the selected site.</p>`}</div><button class="secondary-button related-fault-create" id="create-fault-from-visit" type="button">Create New Fault From This Visit</button></section>`;
}

function selectedRelatedFaults() {
  return [...document.querySelectorAll("[data-related-fault]:checked")].map((checkbox) => ({ fault_id: checkbox.dataset.relatedFault, progress_update: document.querySelector(`[data-fault-progress="${checkbox.dataset.relatedFault}"]`)?.value.trim() || null, status_after_visit: String(document.querySelector(`[data-fault-after-status="${checkbox.dataset.relatedFault}"]`)?.value || "Open").toLowerCase().replace(/\s+/g, "_") }));
}
