function mapRequestAttachment(file, item) {
  return normalizeUploadRecord({ id: file.id, name: file.original_filename, type: file.mime_type, size: file.file_size_bytes,
    uploadedAt: file.created_at, uploadedBy: file.uploaded_by_name, previewUrl: file.preview_url, downloadUrl: file.download_url,
    persisted: true, module: "requests", kind: "request", recordId: item.id, title: item.request_reference, siteName: item.site_name, chargerName: item.charger_name });
}
function registerRequestAttachments(item) {
  const existingIds = new Set(state.uploads.map((file) => file.id));
  (item.attachments || []).forEach((file) => { if (!existingIds.has(file.id)) state.uploads.push(mapRequestAttachment(file, item)); });
}

function requestAttachmentList(item, responseFiles = false) {
  const files = (item.attachments || []).filter((file) => ["hq_user", "operations_staff"].includes(file.uploaded_by_role) === responseFiles);
  if (!files.length) return `<p class="request-muted">No attachments</p>`;
  return `<div class="request-attachments">${files.map((file) => `<div class="attached-file"><span>${requestText(file.original_filename)} · ${requestText(formatFileSize(file.file_size_bytes))}</span><div class="file-actions"><button class="secondary-button" data-file-preview="${requestText(file.id)}" type="button">Preview</button><button class="secondary-button" data-file-download="${requestText(file.id)}" type="button">Download</button></div></div>`).join("")}</div>`;
}

function requestDetailFacts(item, compact = false) {
  return `<dl class="request-facts ${compact ? "compact" : ""}">
    <div><dt>Priority</dt><dd>${requestText(requestLabel(item.priority))}</dd></div><div><dt>Category</dt><dd>${requestText(requestLabel(item.category) || "—")}</dd></div>
    <div><dt>Related Site</dt><dd>${requestText(item.site_name || "—")}</dd></div><div><dt>Related Charger</dt><dd>${requestText(item.charger_name || "—")}</dd></div>
    <div><dt>Requested By</dt><dd>${requestText(item.requested_by_name || "—")}</dd></div><div><dt>Assigned To</dt><dd>${requestText(item.assigned_to_name || "Unassigned")}</dd></div>
    <div><dt>Created Date</dt><dd>${requestText(formatMediumDateTime(item.created_at))}</dd></div><div><dt>Due Date</dt><dd class="${requestIsOverdue(item) ? "request-overdue" : ""}">${requestText(item.due_date ? formatMediumDate(item.due_date) : "—")}</dd></div>
  </dl>`;
}

function requestTimeline(item) {
  const events = [
    [item.created_at, `Request created by ${item.requested_by_name || "Qatar Operations"}`],
    [item.started_at, "Status changed to In Progress"],
    [item.responded_at, `HQ Response added${item.responded_by_name ? ` by ${item.responded_by_name}` : ""}`],
    [item.completed_at, "Marked Completed"],
  ].filter(([date]) => date).sort((a, b) => new Date(a[0]) - new Date(b[0]));
  return events.length ? `<ol class="request-timeline">${events.map(([date, text]) => `<li><time>${requestText(formatMediumDateTime(date))}</time><strong>${requestText(text)}</strong></li>`).join("")}</ol>` : `<p class="request-muted">No timestamped activity is available.</p>`;
}

function canDeleteRequest(item) {
  return isAdmin() && Boolean(state.authUser?.id) && item.requested_by === state.authUser.id;
}

async function openRequestDetails(id) {
  if (!window.QatarOpsRequests.canAccess()) return renderRequestsAccessDenied();
  const form = document.getElementById("modal-form");
  document.querySelector(".modal")?.classList.add("request-modal");
  document.getElementById("modal-title").textContent = "Request Details";
  document.getElementById("modal-eyebrow").textContent = "Operations Requests";
  form.innerHTML = `<div class="requests-state full" role="status"><span class="spinner"></span><p>Loading request details...</p></div>`;
  document.getElementById("modal-backdrop").classList.remove("hidden");
  try {
    const response = await window.QatarOpsApi.Requests.get(id);
    const item = response.request;
    registerRequestAttachments(item);
    form.dataset.requestId = item.id;
    form.dataset.requestMode = isRequestResponder() ? "hq-edit" : "details";
    form.innerHTML = `<div class="modal-error" id="modal-error" aria-live="polite"></div>
      <header class="request-detail-header full"><h2>${requestText(item.title)}</h2><span class="request-pill status-${requestText(item.status)}">${requestText(requestLabel(item.status))}</span><div><span>Request Reference</span><strong>${requestText(item.request_reference)}</strong></div></header>
      <section class="request-detail-hero full"><h3>REQUEST</h3><span>Description / What Qatar is requesting</span><p>${requestText(item.description)}</p></section>
      ${isRequestResponder() ? `<section class="request-response full"><h3>HQ RESPONSE</h3><p class="request-response-intro">This is where you tell Qatar what you did.</p><label><span>Status</span><select id="request-status">${window.QatarOpsRequests.statuses.map(({ value }) => requestOption(value, item.status)).join("")}</select></label><label><span>Response / Action Taken</span><textarea id="request-hq-response" rows="7" placeholder="Describe the response or action taken">${requestText(item.hq_response || "")}</textarea></label><label><span>Supporting Attachments</span><input id="request-files" type="file" multiple /></label>${requestAttachmentList(item, true)}<button class="primary-button request-save-response" type="submit">Save Response</button></section>` : `<section class="request-response full"><h3>HQ RESPONSE</h3>${item.hq_response ? `<p class="request-response-copy">${requestText(item.hq_response).replace(/\n/g, "<br>")}</p><dl><dt>Responded By</dt><dd>${requestText(item.responded_by_name || "—")}</dd><dt>Responded At</dt><dd>${requestText(formatMediumDateTime(item.responded_at))}</dd><dt>Status</dt><dd>${requestText(requestLabel(item.status))}</dd></dl>` : `<p class="request-awaiting">Awaiting response from HQ</p>`}<h4>Supporting Attachments</h4>${requestAttachmentList(item, true)}</section>`}
      <section class="request-detail-section request-context full"><h3>Context</h3>${requestDetailFacts(item)}</section>
      <section class="request-detail-section full"><h3>Request Attachments</h3>${requestAttachmentList(item)}</section>
      <details class="request-detail-section request-timeline-details full"><summary>Activity Timeline</summary>${requestTimeline(item)}</details>
      <div class="modal-actions">${canDeleteRequest(item) ? `<button class="danger-button" data-request-delete="${requestText(item.id)}" type="button">Delete Request</button>` : ""}${isAdmin() ? `<button class="secondary-button" data-request-edit="${requestText(item.id)}" type="button">Edit Request</button>` : ""}<button class="secondary-button" id="cancel-modal" type="button">Close</button></div>`;
  } catch (error) {
    form.innerHTML = `<div class="requests-state full" role="alert"><h2>Request could not be loaded</h2><p>${requestText(error.message)}</p><button class="secondary-button" id="cancel-modal" type="button">Close</button></div>`;
  }
}

async function openRequestDeleteConfirmation(id) {
  if (!isAdmin()) return;
  const response = await window.QatarOpsApi.Requests.get(id);
  const item = response.request;
  if (!canDeleteRequest(item)) return;
  const form = document.getElementById("modal-form");
  form.dataset.requestId = item.id;
  form.dataset.requestMode = "delete";
  document.getElementById("modal-title").textContent = "Delete Request?";
  document.getElementById("modal-eyebrow").textContent = "Operations Requests";
  form.innerHTML = `<div class="modal-error" id="modal-error" aria-live="polite"></div>
    <section class="request-detail-section full"><strong>${requestText(item.request_reference)}</strong><h3>${requestText(item.title)}</h3><p>This will remove the Request from active Operations Requests.</p></section>
    <label class="full"><span>Type DELETE to confirm</span><input id="request-delete-confirmation" type="text" autocomplete="off" /></label>
    <div class="modal-actions"><button class="secondary-button" id="cancel-modal" type="button">Cancel</button><button class="danger-button" type="submit">Delete Request</button></div>`;
}

async function openRequestEdit(id, hqMode = false) {
  const response = await window.QatarOpsApi.Requests.get(id);
  const item = response.request;
  if (!hqMode) return openRequestModal(item);
  const form = document.getElementById("modal-form");
  form.dataset.requestId = item.id;
  form.dataset.requestMode = "hq-edit";
  document.getElementById("modal-title").textContent = "HQ Response";
  document.getElementById("modal-eyebrow").textContent = item.request_reference;
  form.innerHTML = `<div class="modal-error" id="modal-error" aria-live="polite"></div>${requestFormFields(item, true)}<div class="modal-actions"><button class="secondary-button" id="cancel-modal" type="button">Cancel</button><button class="primary-button" type="submit">Save Response</button></div>`;
}
