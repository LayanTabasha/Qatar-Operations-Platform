const REQUEST_CATEGORIES = ["firmware", "software", "configuration", "network", "hardware", "documentation", "other"];
const REQUEST_PRIORITIES = ["high", "medium", "low"];
const requestFilters = { search: "", status: "", priority: "", category: "", site_id: "", charger_id: "", assigned_to: "" };
let requestPageLoading = false;
let requestPageError = "";

function isRequestResponder() {
  return normalizedRoleKey(state.currentUserRoleKey || state.currentUserRole) === "hq_user";
}

function requestText(value = "") {
  return escapeHtml(String(value ?? ""));
}

function requestLabel(value = "") {
  return String(value || "").split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function renderRequestsAccessDenied() {
  const target = document.getElementById("requests-page-content");
  if (target) target.innerHTML = `<div class="requests-state panel" role="alert"><h1>Access Denied</h1><p>You do not have permission to access Operations Requests.</p></div>`;
}

function updateRequestsNavigation() {
  document.getElementById("requests-nav")?.classList.toggle("hidden", !window.QatarOpsRequests.canAccess());
}

function requestOption(value, selected = "") {
  return `<option value="${requestText(value)}"${value === selected ? " selected" : ""}>${requestText(requestLabel(value))}</option>`;
}

function siteOptions(selected = "") {
  return state.sites.map((site) => `<option value="${requestText(site.id)}"${site.id === selected ? " selected" : ""}>${requestText(site.name)}</option>`).join("");
}

function requestChargers(siteId = "") {
  if (!siteId) return [];
  return sortChargersForDisplay(state.sites.find((site) => site.id === siteId)?.chargers || []);
}

function chargerOptions(siteId, selected = "") {
  return requestChargers(siteId).map((charger) => `<option value="${requestText(charger.id)}"${charger.id === selected ? " selected" : ""}>${requestText(charger.name || charger.chargerId || charger.id)}</option>`).join("");
}

function hqUserOptions(selected = "") {
  const managedUsers = state.requestUsers.filter((user) => ["hq_user", "operations_staff"].includes(user.role) && user.is_active !== false)
    .map((user) => ({ id: user.id, name: user.full_name || user.email }));
  const visibleAssignees = state.requests.filter((item) => item.assigned_to)
    .map((item) => ({ id: item.assigned_to, name: item.assigned_to_name || "Assigned HQ User" }));
  const options = Array.from(new Map([...managedUsers, ...visibleAssignees].map((user) => [user.id, user])).values());
  return options.map((user) => `<option value="${requestText(user.id)}"${user.id === selected ? " selected" : ""}>${requestText(user.name)}</option>`).join("");
}

function requestIsOverdue(item) {
  if (item.overdue === true) return true;
  if (!item.due_date || item.status === "completed") return false;
  const today = new Date();
  const localToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return item.due_date < localToday;
}

function filteredRequests() {
  const search = requestFilters.search.trim().toLowerCase();
  return state.requests.filter((item) => {
    if (requestFilters.status && item.status !== requestFilters.status) return false;
    if (requestFilters.priority && item.priority !== requestFilters.priority) return false;
    if (requestFilters.category && item.category !== requestFilters.category) return false;
    if (requestFilters.site_id && item.site_id !== requestFilters.site_id) return false;
    if (requestFilters.charger_id && item.charger_id !== requestFilters.charger_id) return false;
    if (requestFilters.assigned_to && item.assigned_to !== requestFilters.assigned_to) return false;
    return !search || [item.request_reference, item.title, item.description, item.site_name, item.charger_name, item.assigned_to_name]
      .some((value) => String(value || "").toLowerCase().includes(search));
  });
}

function requestSummaryCard(label, count, tone = "") {
  return `<article class="kpi-card request-kpi ${tone}"><span>${label}</span><strong>${count}</strong><small>Requests</small></article>`;
}

function renderRequestsPage() {
  const target = document.getElementById("requests-page-content");
  if (!target) return;
  if (!window.QatarOpsRequests.canAccess()) return renderRequestsAccessDenied();
  if (requestPageLoading) {
    target.innerHTML = `<div class="requests-state panel" role="status"><span class="spinner"></span><h1>Loading requests...</h1></div>`;
    return;
  }
  if (requestPageError) {
    target.innerHTML = `<div class="requests-state panel" role="alert"><h1>Requests could not be loaded</h1><p>${requestText(requestPageError)}</p><button class="primary-button" data-requests-retry type="button">Retry</button></div>`;
    return;
  }
  const counts = Object.fromEntries(window.QatarOpsRequests.statuses.map(({ value }) => [value, state.requests.filter((item) => item.status === value).length]));
  const visible = filteredRequests();
  const filterChargerOptions = chargerOptions(requestFilters.site_id, requestFilters.charger_id);
  target.innerHTML = `
    <div class="page-title-row requests-heading">
      <div><h1 id="requests-title">Operations Requests</h1><p>Create and track requests for HQ</p></div>
      ${isAdmin() ? `<button class="primary-button" data-request-new type="button">+ New Request</button>` : ""}
    </div>
    <section class="kpi-grid request-kpi-grid" aria-label="Request summary">
      ${requestSummaryCard("Open", counts.open)}${requestSummaryCard("In Progress", counts.in_progress)}${requestSummaryCard("Completed", counts.completed)}${requestSummaryCard("Overdue", state.requests.filter(requestIsOverdue).length, "overdue")}
    </section>
    <section class="panel requests-list-panel">
      <div class="requests-filters" aria-label="Request filters">
        <label class="requests-search"><span>Search</span><input id="requests-search" type="search" value="${requestText(requestFilters.search)}" placeholder="Search requests" /></label>
        <label><span>Status</span><select id="requests-status"><option value="">All</option>${window.QatarOpsRequests.statuses.map(({ value }) => requestOption(value, requestFilters.status)).join("")}</select></label>
        <label><span>Priority</span><select id="requests-priority"><option value="">All</option>${REQUEST_PRIORITIES.map((v) => requestOption(v, requestFilters.priority)).join("")}</select></label>
        <label><span>Category</span><select id="requests-category"><option value="">All</option>${REQUEST_CATEGORIES.map((v) => requestOption(v, requestFilters.category)).join("")}</select></label>
        <label><span>Site</span><select id="requests-site"><option value="">All</option>${siteOptions(requestFilters.site_id)}</select></label>
        <label><span>Charger</span><select id="requests-charger"${requestFilters.site_id ? "" : " disabled"}><option value="">All</option>${filterChargerOptions}</select></label>
        <label><span>Assigned To</span><select id="requests-assignee"><option value="">All</option>${hqUserOptions(requestFilters.assigned_to)}</select></label>
      </div>
      <div id="requests-results">${renderRequestResults(visible)}</div>
    </section>`;
}

function renderRequestResults(items = filteredRequests()) {
  if (!state.requests.length) return `<div class="requests-state"><h2>No requests yet</h2><p>${isAdmin() ? "Create the first Operations Request when HQ support is needed." : "No Operations Requests have been assigned yet."}</p></div>`;
  if (!items.length) return `<div class="requests-state"><h2>No requests match the selected filters</h2><p>Adjust the filters or search term and try again.</p></div>`;
  return `<div class="table-wrap requests-table-wrap"><table class="requests-table"><thead><tr><th>Request ID</th><th>Title</th><th>Site / Charger</th><th>Priority</th><th>Status</th><th>Assigned To</th><th>Due Date</th><th>Created</th><th>Action</th></tr></thead><tbody>${items.map((item) => {
    const overdue = requestIsOverdue(item);
    const responseAvailable = item.status === "completed" && item.hq_response;
    const statusControl = isRequestResponder()
      ? `<select class="inline-select request-status-select" data-request-status="${requestText(item.id)}" data-previous-status="${requestText(item.status)}" aria-label="Status for ${requestText(item.request_reference)}">${window.QatarOpsRequests.statuses.map(({ value }) => requestOption(value, item.status)).join("")}</select>`
      : `<span class="request-pill status-${requestText(item.status)}">${requestText(requestLabel(item.status))}</span>`;
    return `<tr data-request-view="${requestText(item.id)}" tabindex="0"><td><strong>${requestText(item.request_reference)}</strong></td><td>${requestText(item.title)}</td><td>${requestText([item.site_name, item.charger_name].filter(Boolean).join(" / ") || "—")}</td><td><span class="request-pill priority-${requestText(item.priority)}">${requestText(requestLabel(item.priority))}</span></td><td>${statusControl}${responseAvailable ? `<span class="request-response-available">✓ HQ Responded</span>` : ""}</td><td>${requestText(item.assigned_to_name || "Unassigned")}</td><td class="${overdue ? "request-overdue" : ""}">${requestText(item.due_date ? formatMediumDate(item.due_date) : "—")}${overdue ? "<small>Overdue</small>" : ""}</td><td>${requestText(formatMediumDate(item.created_at))}</td><td><button type="button" data-request-view="${requestText(item.id)}">View</button></td></tr>`;
  }).join("")}</tbody></table></div>`;
}

async function loadRequestsPage() {
  if (!window.QatarOpsRequests.canAccess() || requestPageLoading) return;
  requestPageLoading = true;
  requestPageError = "";
  renderRequestsPage();
  try {
    const calls = [window.QatarOpsApi.Requests.list({ limit: 500 })];
    if (isAdmin() && !state.requestUsers.length) calls.push(window.QatarOpsApi.Users.list());
    const [requestResponse, userResponse] = await Promise.all(calls);
    state.requests = requestResponse.requests || [];
    if (userResponse) state.requestUsers = userResponse.users || [];
  } catch (error) {
    requestPageError = error.message || "The Requests API is unavailable.";
  } finally {
    requestPageLoading = false;
    renderRequestsPage();
  }
}

function updateRequestResults() {
  const target = document.getElementById("requests-results");
  if (target) target.innerHTML = renderRequestResults();
}

function requestFormFields(item = {}, hqMode = false) {
  const siteId = item.site_id || "";
  if (hqMode) return `<div class="request-readonly full">${requestDetailFacts(item, true)}</div>
    <label><span>Status</span><select id="request-status">${window.QatarOpsRequests.statuses.map(({ value }) => requestOption(value, item.status)).join("")}</select></label>
    <label class="full"><span>HQ Response</span><textarea id="request-hq-response" rows="7" placeholder="Enter the official response to Qatar Operations">${requestText(item.hq_response || "")}</textarea></label>
    <label class="full"><span>Response Attachments</span><input id="request-files" type="file" multiple /><small>Supporting files use the managed Request attachment storage.</small></label>`;
  return `
    <label class="full"><span>Title *</span><input id="request-title" type="text" value="${requestText(item.title || "")}" required /></label>
    <label class="full"><span>Description *</span><textarea id="request-description" rows="6" required>${requestText(item.description || "")}</textarea></label>
    <label><span>Category</span><select id="request-category"><option value="">Select category</option>${REQUEST_CATEGORIES.map((v) => requestOption(v, item.category)).join("")}</select></label>
    <label><span>Priority *</span><select id="request-priority">${REQUEST_PRIORITIES.map((v) => requestOption(v, item.priority || "medium")).join("")}</select></label>
    <label><span>Site</span><select id="request-site"><option value="">No site</option>${siteOptions(siteId)}</select></label>
    <label><span>Charger</span><select id="request-charger"${siteId ? "" : " disabled"}><option value="">No charger</option>${chargerOptions(siteId, item.charger_id)}</select></label>
    <label><span>Assigned To HQ</span><select id="request-assigned"><option value="">Unassigned</option>${hqUserOptions(item.assigned_to)}</select></label>
    <label><span>Due Date</span><input id="request-due-date" type="date" value="${requestText(item.due_date || "")}" /></label>
    <label class="full"><span>Request Attachments</span><input id="request-files" type="file" multiple /></label>`;
}

function openRequestModal(item = null) {
  if (!isAdmin() || !window.QatarOpsRequests.canAccess()) return;
  const form = document.getElementById("modal-form");
  form.dataset.requestId = item?.id || "";
  form.dataset.requestMode = item ? "admin-edit" : "create";
  document.querySelector(".modal")?.classList.add("request-modal");
  document.getElementById("modal-title").textContent = item ? "Edit Request" : "New Request";
  document.getElementById("modal-eyebrow").textContent = "Operations Requests";
  form.innerHTML = `<div class="modal-error" id="modal-error" aria-live="polite"></div>${requestFormFields(item || {})}<div class="modal-actions"><button class="secondary-button" id="cancel-modal" type="button">Cancel</button><button class="primary-button" type="submit">${item ? "Save Changes" : "Create Request"}</button></div>`;
  document.getElementById("modal-backdrop").classList.remove("hidden");
}

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

async function uploadRequestFiles(requestId) {
  const files = Array.from(document.getElementById("request-files")?.files || []);
  for (const file of files) await window.QatarOpsApi.Attachments.upload("requests", requestId, file);
}

async function submitRequestForm(form) {
  const errorBox = document.getElementById("modal-error");
  if (errorBox) errorBox.textContent = "";
  const button = form.querySelector("button[type='submit']");
  if (button) button.disabled = true;
  try {
    let request;
    if (form.dataset.requestMode === "delete") {
      if (document.getElementById("request-delete-confirmation").value !== "DELETE") throw new Error("Type DELETE exactly to confirm deletion.");
      await window.QatarOpsApi.Requests.remove(form.dataset.requestId);
      closeModal();
      await loadRequestsPageFresh();
      return;
    } else if (form.dataset.requestMode === "hq-edit") {
      const status = document.getElementById("request-status").value;
      const hqResponse = document.getElementById("request-hq-response").value.trim();
      if (status === "completed" && !hqResponse) throw new Error("HQ Response is required before completing a request.");
      request = (await window.QatarOpsApi.Requests.update(form.dataset.requestId, { status, hq_response: hqResponse || null })).request;
    } else {
      const title = document.getElementById("request-title").value.trim();
      const description = document.getElementById("request-description").value.trim();
      if (!title || !description) throw new Error("Title and Description are required.");
      const payload = { title, description, category: document.getElementById("request-category").value || null,
        priority: document.getElementById("request-priority").value, site_id: document.getElementById("request-site").value || null,
        charger_id: document.getElementById("request-charger").value || null, assigned_to: document.getElementById("request-assigned").value || null,
        due_date: document.getElementById("request-due-date").value || null };
      request = form.dataset.requestMode === "admin-edit"
        ? (await window.QatarOpsApi.Requests.update(form.dataset.requestId, payload)).request
        : (await window.QatarOpsApi.Requests.create(payload)).request;
    }
    await uploadRequestFiles(request.id);
    await loadRequestsPageFresh();
    if (form.dataset.requestMode === "hq-edit") await openRequestDetails(request.id);
    else closeModal();
  } catch (error) {
    if (errorBox) errorBox.textContent = error.message || "The request could not be saved.";
  } finally {
    if (button) button.disabled = false;
  }
}

async function loadRequestsPageFresh() {
  requestPageLoading = false;
  requestPageError = "";
  await loadRequestsPage();
}

document.addEventListener("click", (event) => {
  if (event.target.closest("[data-requests-retry]")) loadRequestsPageFresh();
  if (event.target.closest("[data-request-new]")) openRequestModal();
  const view = event.target.closest("[data-request-view]");
  const directViewButton = event.target.closest("button[data-request-view]");
  if (view && (directViewButton || !event.target.closest("button, select, input, textarea, a"))) openRequestDetails(view.dataset.requestView);
  const edit = event.target.closest("[data-request-edit]");
  if (edit) openRequestEdit(edit.dataset.requestEdit);
  const remove = event.target.closest("[data-request-delete]");
  if (remove) openRequestDeleteConfirmation(remove.dataset.requestDelete);
  const hqEdit = event.target.closest("[data-request-hq-edit]");
  if (hqEdit) openRequestEdit(hqEdit.dataset.requestHqEdit, true);
});

document.addEventListener("input", (event) => {
  if (event.target.id !== "requests-search") return;
  requestFilters.search = event.target.value;
  updateRequestResults();
});

document.addEventListener("change", (event) => {
  const requestStatus = event.target.closest("[data-request-status]");
  if (requestStatus) {
    updateRequestStatusFromTable(requestStatus);
    return;
  }
  const filterMap = { "requests-status": "status", "requests-priority": "priority", "requests-category": "category", "requests-site": "site_id", "requests-charger": "charger_id", "requests-assignee": "assigned_to" };
  if (filterMap[event.target.id]) {
    requestFilters[filterMap[event.target.id]] = event.target.value;
    if (event.target.id === "requests-site") { requestFilters.charger_id = ""; renderRequestsPage(); }
    else updateRequestResults();
  }
  if (event.target.id === "request-site") {
    const charger = document.getElementById("request-charger");
    charger.disabled = !event.target.value;
    charger.innerHTML = `<option value="">No charger</option>${chargerOptions(event.target.value)}`;
  }
});

async function updateRequestStatusFromTable(select) {
  if (!isRequestResponder()) return;
  const previousStatus = select.dataset.previousStatus;
  const requestItem = state.requests.find((item) => item.id === select.dataset.requestStatus);
  if (!requestItem || select.value === previousStatus) return;
  select.disabled = true;
  try {
    const response = await window.QatarOpsApi.Requests.update(requestItem.id, { status: select.value });
    Object.assign(requestItem, response.request);
    select.dataset.previousStatus = requestItem.status;
    await loadRequestsPageFresh();
  } catch (error) {
    select.value = previousStatus;
    window.alert(error.message || "The request status could not be saved.");
  } finally {
    select.disabled = false;
  }
}

document.addEventListener("keydown", (event) => {
  const row = event.target.closest("tr[data-request-view]");
  if (row && ["Enter", " "].includes(event.key)) { event.preventDefault(); openRequestDetails(row.dataset.requestView); }
});
