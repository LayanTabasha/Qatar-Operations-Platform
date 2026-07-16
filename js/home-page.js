const DASHBOARD_COLORS = ["#73d7ff", "#4f8dff", "#37c985", "#dca94b", "#ef6262", "#9cafc6"];

function renderCounts() {
  refreshDerivedCounts();
  document.getElementById("kpi-sites").textContent = state.sites.length;
  document.getElementById("kpi-chargers").textContent = state.counts.chargers;
  document.getElementById("kpi-faults").textContent = state.counts.faults;
  document.getElementById("kpi-visits").textContent = state.counts.visits;
  document.getElementById("kpi-documents").textContent = state.counts.documents;
  renderDashboardCharts();
}

function renderDashboardCharts() {
  renderSiteFilters();
  renderFaultStatusChart();
  renderChargerStatusChart();
  renderFaultTrendChart();
  renderVisitActivityChart();
  renderRecordsBySiteChart();
}

function renderSiteFilters() {
  ["fault-status-site-filter", "charger-status-site-filter"].forEach((id) => {
    const select = document.getElementById(id);
    if (!select) return;
    const currentValue = select.value;
    select.innerHTML = `<option value="">All Sites</option>${state.sites.map((site) => `<option value="${site.name}">${site.name}</option>`).join("")}`;
    select.value = state.sites.some((site) => site.name === currentValue) ? currentValue : "";
  });
}

function groupCount(records, labels, getter) {
  const counts = Object.fromEntries(labels.map((label) => [label, 0]));
  records.forEach((record) => {
    const key = getter(record) || "Pending Data";
    counts[key] = (counts[key] || 0) + 1;
  });
  return counts;
}

function chartEmpty(message) {
  return `<div class="empty-state small"><strong>${message}</strong><span>Records entered in the platform will appear here automatically.</span></div>`;
}

function renderBarList(containerId, rows, emptyMessage) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  if (!total) {
    container.innerHTML = chartEmpty(emptyMessage);
    return;
  }
  container.innerHTML = `<div class="bar-list">${rows.map((row, index) => {
    const percent = Math.max(6, Math.round((row.value / total) * 100));
    return `<button class="bar-row" type="button" title="${row.label}: ${row.value}" data-chart-label="${row.label}">
      <span class="bar-label">${row.label}</span>
      <span class="bar-track"><i style="width:${percent}%; background:${DASHBOARD_COLORS[index % DASHBOARD_COLORS.length]}"></i></span>
      <strong>${row.value}</strong>
    </button>`;
  }).join("")}</div>`;
}

function renderFaultStatusChart() {
  const siteFilter = document.getElementById("fault-status-site-filter")?.value || "";
  const records = siteFilter ? state.faults.filter((fault) => fault.siteName === siteFilter) : state.faults;
  const statuses = ["Open", "In Progress", "Resolved", "Closed"];
  const counts = groupCount(records, statuses, (fault) => fault.status);
  renderBarList("fault-status-chart", statuses.map((label) => ({ label, value: counts[label] || 0 })), "No fault data is available yet.");
}

function renderChargerStatusChart() {
  const siteFilter = document.getElementById("charger-status-site-filter")?.value || "";
  const chargers = state.sites
    .filter((site) => !siteFilter || site.name === siteFilter)
    .flatMap((site) => (site.chargers || []).map((charger) => ({ ...charger, siteName: site.name })));
  const statuses = ["Operational", "Available", "Faulted", "Under Maintenance", "Offline", "Pending Data", "Warning", "Critical"];
  const counts = groupCount(chargers, statuses, (charger) => normalizeChargerStatus(charger.status));
  const rows = Object.entries(counts).filter(([, value]) => value > 0).map(([label, value]) => ({ label, value }));
  renderBarList("charger-status-chart", rows, "Add chargers or update charger status to display this chart.");
}

function normalizeChargerStatus(status) {
  if (!status || status === "Pending Data") return "Pending Data";
  if (status === "Available") return "Operational";
  if (status === "Critical") return "Faulted";
  if (status === "Warning") return "Under Maintenance";
  return status;
}

function renderFaultTrendChart() {
  const days = Number(document.getElementById("fault-trend-range")?.value || 30);
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - days + 1);
  cutoff.setHours(0, 0, 0, 0);
  const buckets = new Map();
  for (let index = days - 1; index >= 0; index -= 1) {
    const date = new Date(now);
    date.setDate(now.getDate() - index);
    const key = date.toISOString().slice(0, 10);
    buckets.set(key, { label: formatDate(key), value: 0 });
  }
  state.faults.forEach((fault) => {
    const date = new Date(getRecordDate(fault));
    if (Number.isNaN(date.getTime()) || date < cutoff) return;
    const key = date.toISOString().slice(0, 10);
    if (buckets.has(key)) buckets.get(key).value += 1;
  });
  const rows = Array.from(buckets.values()).filter((row) => row.value > 0);
  renderBarList("fault-trend-chart", rows, "Add dated fault records to display this chart.");
}

function renderVisitActivityChart() {
  const mode = document.getElementById("visit-activity-mode")?.value || "status";
  if (mode === "site") {
    const rows = state.sites.map((site) => ({
      label: site.name,
      value: state.visits.filter((visit) => visit.siteName === site.name).length,
    }));
    renderBarList("visit-activity-chart", rows, "Add site visits to display this chart.");
    return;
  }
  const statuses = ["Scheduled", "Completed", "Cancelled", "Follow-Up Required"];
  const counts = groupCount(state.visits, statuses, (visit) => visit.status);
  renderBarList("visit-activity-chart", statuses.map((label) => ({ label, value: counts[label] || 0 })), "Add site visits to display this chart.");
}

function renderRecordsBySiteChart() {
  const rows = state.sites.map((site) => {
    const chargerCount = site.chargers?.length || 0;
    const openFaults = state.faults.filter((fault) => fault.siteName === site.name && ["Open", "In Progress"].includes(fault.status)).length;
    const visits = state.visits.filter((visit) => visit.siteName === site.name).length;
    const uploads = getValidUploads().filter((file) => file.siteName === site.name).length;
    return `<div class="site-record-row">
      <strong>${site.name}</strong>
      <span>Chargers <b>${chargerCount}</b></span>
      <span>Open Faults <b>${openFaults}</b></span>
      <span>Visits <b>${visits}</b></span>
      <span>Uploads <b>${uploads}</b></span>
    </div>`;
  }).join("");
  document.getElementById("records-by-site-chart").innerHTML = rows || chartEmpty("No site records are available yet.");
}

function renderActivity() {
  const recent = getRecentActivities(5);
  const rows = recent.length
    ? recent.map((item) => `<div class="activity-row">
        <span class="activity-icon">${activityIcon(item.actionType)}</span>
        <strong><b>${item.description}</b><small>by ${item.userName || "System"}</small></strong>
        <time datetime="${item.occurredAt}" title="${formatDateTime(item.occurredAt)}">${relativeTime(item.occurredAt)}</time>
      </div>`).join("")
    : `<div class="activity-row empty"><span class="activity-icon">--</span><strong><b>No recent activity yet.</b><small>Operational events will appear here after users make changes.</small></strong><time>--</time></div>`;
  document.getElementById("activity-list").innerHTML = rows;
}

function activityIcon(actionType = "") {
  if (actionType.includes("fault")) return "FLT";
  if (actionType.includes("visit")) return "VIS";
  if (actionType.includes("upload") || actionType.includes("document") || actionType.includes("report")) return "DOC";
  if (actionType.includes("charger")) return "CHG";
  if (actionType.includes("site")) return "SITE";
  if (actionType.includes("password") || actionType.includes("user")) return "SEC";
  return "OPS";
}
