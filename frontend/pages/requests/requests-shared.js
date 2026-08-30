const REQUEST_CATEGORIES = ["firmware", "software", "configuration", "network", "hardware", "documentation", "other"];
const REQUEST_PRIORITIES = ["high", "medium", "low"];
const requestFilters = { search: "", status: "", priority: "", category: "", site_id: "", charger_id: "", assigned_to: "" };
let requestPageLoading = false;
let requestPageError = "";

function isRequestResponder() {
  return normalizedRoleKey(state.currentUserRoleKey || state.currentUserRole) === "hq_user";
}
function canEditRequestStatus() {
  return ["admin", "hq_user"].includes(normalizedRoleKey(state.currentUserRoleKey || state.currentUserRole));
}
function canEditRequestPriority() {
  return canEditRequestStatus();
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
