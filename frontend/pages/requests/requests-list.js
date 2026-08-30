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
    const statusControl = canEditRequestStatus()
      ? `<select class="inline-select request-status-select" data-request-status="${requestText(item.id)}" data-previous-status="${requestText(item.status)}" aria-label="Status for ${requestText(item.request_reference)}">${window.QatarOpsRequests.statuses.map(({ value }) => requestOption(value, item.status)).join("")}</select>`
      : `<span class="request-pill status-${requestText(item.status)}">${requestText(requestLabel(item.status))}</span>`;
    const priorityControl = canEditRequestPriority()
      ? `<select class="inline-select request-priority-select priority-${requestText(item.priority)}" data-request-priority="${requestText(item.id)}" data-previous-priority="${requestText(item.priority)}" aria-label="Priority for ${requestText(item.request_reference)}">${REQUEST_PRIORITIES.map((value) => requestOption(value, item.priority)).join("")}</select>`
      : `<span class="request-pill priority-${requestText(item.priority)}">${requestText(requestLabel(item.priority))}</span>`;
    return `<tr data-request-view="${requestText(item.id)}" tabindex="0"><td><strong>${requestText(item.request_reference)}</strong></td><td>${requestText(item.title)}</td><td>${requestText([item.site_name, item.charger_name].filter(Boolean).join(" / ") || "—")}</td><td>${priorityControl}</td><td>${statusControl}${responseAvailable ? `<span class="request-response-available">✓ HQ Responded</span>` : ""}</td><td>${requestText(item.assigned_to_name || "Unassigned")}</td><td class="${overdue ? "request-overdue" : ""}">${requestText(item.due_date ? formatMediumDate(item.due_date) : "—")}${overdue ? "<small>Overdue</small>" : ""}</td><td>${requestText(formatMediumDate(item.created_at))}</td><td><button type="button" data-request-view="${requestText(item.id)}">View</button></td></tr>`;
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

async function updateRequestStatusFromTable(select) {
  if (!canEditRequestStatus()) return;
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

async function updateRequestPriorityFromTable(select) {
  if (!canEditRequestPriority()) return;
  const previousPriority = select.dataset.previousPriority;
  const requestItem = state.requests.find((item) => item.id === select.dataset.requestPriority);
  if (!requestItem || select.value === previousPriority) return;
  select.disabled = true;
  select.classList.remove(`priority-${previousPriority}`);
  select.classList.add(`priority-${select.value}`);
  try {
    const response = await window.QatarOpsApi.Requests.update(requestItem.id, { priority: select.value });
    Object.assign(requestItem, response.request);
    select.dataset.previousPriority = requestItem.priority;
    await loadRequestsPageFresh();
  } catch (error) {
    select.classList.remove(`priority-${select.value}`);
    select.value = previousPriority;
    select.classList.add(`priority-${previousPriority}`);
    window.alert(error.message || "The request priority could not be saved.");
  } finally {
    select.disabled = false;
  }
}
