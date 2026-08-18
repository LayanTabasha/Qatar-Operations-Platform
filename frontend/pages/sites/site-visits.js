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
