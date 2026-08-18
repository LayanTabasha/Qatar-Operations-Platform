const DASHBOARD_COLORS = ["#73d7ff", "#4f8dff", "#37c985", "#dca94b", "#ef6262", "#9cafc6"];
const CHARGER_STATUSES = Object.freeze([
  { label: "Active", color: "#37c985" },
  { label: "Maintenance", color: "#dca94b" },
  { label: "Faulted", color: "#ef6262" },
]);
const CHARGER_STATUS_COLORS = Object.freeze(Object.fromEntries(CHARGER_STATUSES.map(({ label, color }) => [label, color])));
const FAULT_STATUSES = Object.freeze([
  { label: "Open", color: "#4f8dff" },
  { label: "In Progress", color: "#dca94b" },
  { label: "Resolved", color: "#37c985" },
]);
const FAULT_STATUS_COLORS = Object.freeze(Object.fromEntries(FAULT_STATUSES.map(({ label, color }) => [label, color])));
const DASHBOARD_SITES = [
  { label: "All Sites", aliases: [] },
  { label: "Al Mana", aliases: ["Al Mana"] },
  { label: "Mowasalat", aliases: ["Mowasalat"] },
  { label: "Msheireb", aliases: ["Msheireb", "Musheireb"] },
];

function globalSearchRecords(query) {
  const normalizedQuery = String(query || "").trim().toLowerCase();
  if (!normalizedQuery) return [];
  const matches = (values) => values.some((value) => String(value ?? "").toLowerCase().includes(normalizedQuery));
  const results = [];
  state.sites.forEach((site) => {
    if (matches([site.name, site.code, site.location, site.description])) results.push({ type: "Site", title: site.name, detail: site.location, siteName: site.name, tab: "Overview" });
    (site.chargers || []).forEach((charger) => {
      if (matches([charger.name, charger.code, charger.serialNumber, charger.manufacturer, charger.model])) results.push({ type: "Charger", title: charger.name, detail: site.name, siteName: site.name, chargerId: charger.id });
    });
  });
  state.faults.forEach((fault) => {
    if (matches([fault.faultId, fault.faultCode, fault.faultName, fault.title, fault.description, fault.siteName, fault.chargerName])) results.push({ type: "Fault", title: fault.faultId || fault.faultName, detail: fault.siteName, siteName: fault.siteName, tab: "Faults" });
  });
  state.visits.forEach((visit) => {
    if (matches([visit.purpose, visit.notes, visit.siteName, visit.chargerName, visit.createdBy])) results.push({ type: "Site Visit", title: visit.purpose || "Site Visit", detail: visit.siteName, siteName: visit.siteName, tab: "Site Visits" });
  });
  getValidUploads().forEach((file) => {
    if (!matches([file.title, file.name, file.category, file.documentType, file.guideCategory, file.siteName, file.chargerName])) return;
    const tab = file.kind === "weeklyReport" ? "Weekly Reports" : file.kind === "guide" ? "Troubleshooting" : "Documents";
    results.push({ type: tab.slice(0, -1), title: file.title || file.name, detail: file.siteName, siteName: file.siteName, tab });
  });
  return results.slice(0, 50);
}

function renderGlobalSearchResults(query) {
  const input = document.getElementById("global-search");
  if (!input) return;
  let target = document.getElementById("global-search-results");
  if (!target) {
    target = document.createElement("section");
    target.id = "global-search-results";
    target.className = "panel recent-panel hidden";
    document.querySelector("#home .hero-row")?.insertAdjacentElement("afterend", target);
  }
  const trimmed = String(query || "").trim();
  target.classList.toggle("hidden", !trimmed);
  if (!trimmed) { target.innerHTML = ""; return; }
  const results = globalSearchRecords(trimmed);
  target.innerHTML = `<div class="panel-head"><h2>Search Results</h2><strong>${results.length} result${results.length === 1 ? "" : "s"}</strong></div>${results.length ? `<div class="activity-list">${results.map((item, index) => `<button type="button" class="activity-row" data-global-result="${index}"><span>${item.type}</span><strong><b>${safeDetailValue(item.title)}</b><small>${safeDetailValue(item.detail || "")}</small></strong></button>`).join("")}</div>` : `<div class="empty-state"><h2>No matching records</h2><p>Try a different search.</p></div>`}`;
  target._searchResults = results;
}

if (typeof document !== "undefined") {
  document.addEventListener("input", (event) => {
    if (event.target.id === "global-search") renderGlobalSearchResults(event.target.value);
  });
  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-global-result]");
    if (!button) return;
    const result = document.getElementById("global-search-results")?._searchResults?.[Number(button.dataset.globalResult)];
    if (!result) return;
    setRoute("sites");
    if (result.chargerId) openCharger(result.siteName, result.chargerId);
    else if (result.siteName) openSite(result.siteName, result.tab || "Overview");
  });
}

function renderCounts() {
  refreshDerivedCounts();
  document.getElementById("kpi-sites").textContent = state.sites.length;
  document.getElementById("kpi-chargers").textContent = state.counts.chargers;
  document.getElementById("kpi-faults").textContent = state.counts.faults;
  document.getElementById("kpi-visits").textContent = state.counts.visits;
  try {
    renderHomepageRequests();
  } catch (error) {
    console.error("Homepage Requests rendering failed", error);
  }
  renderDashboardCharts();
  const globalSearch = document.getElementById("global-search");
  if (globalSearch?.value.trim()) renderGlobalSearchResults(globalSearch.value);
}

function renderHomepageRequests() {
  const visible = window.QatarOpsRequests.canAccess();
  const card = document.getElementById("open-requests-kpi");
  const chartCard = document.getElementById("requests-status-card");
  card?.classList.toggle("hidden", !visible);
  chartCard?.classList.toggle("hidden", !visible);
  if (!visible) return;

  const count = document.getElementById("kpi-requests");
  const detail = document.getElementById("kpi-requests-detail");
  const chart = document.getElementById("requests-status-chart");
  if (state.homepageRequestsLoading) {
    if (count) count.textContent = "--";
    if (detail) detail.textContent = "Loading requests";
    if (chart) chart.innerHTML = chartUnavailable("Loading requests");
    return;
  }
  if (state.homepageRequestsError) {
    if (count) count.textContent = "Not Available Yet";
    if (detail) detail.textContent = "Requests unavailable";
    if (chart) chart.innerHTML = chartUnavailable("Not Available Yet");
    return;
  }

  const active = state.requests.filter((item) => ["open", "in_progress"].includes(item.status));
  const highPriority = active.filter((item) => item.priority === "high").length;
  if (count) count.textContent = active.length;
  if (detail) detail.textContent = highPriority ? `${highPriority} High Priority` : "No high priority requests";
  renderRequestsStatusChart();
}

function chartUnavailable(message) {
  return `<div class="empty-state small" role="status"><strong>${message}</strong></div>`;
}

function renderRequestsStatusChart() {
  const container = document.getElementById("requests-status-chart");
  if (!container) return;
  const statuses = window.QatarOpsRequests.statuses;
  const counts = Object.fromEntries(statuses.map(({ value, label }) => [label, state.requests.filter((item) => item.status === value).length]));
  const total = statuses.reduce((sum, { label }) => sum + (counts[label] || 0), 0);
  container.innerHTML = `<div class="requests-status-summary">${statuses.map(({ label, color }) => {
    const count = counts[label] || 0;
    const proportion = total ? (count / total) * 100 : 0;
    return `<section class="request-status-row" role="img" aria-label="${label}: ${count} request${count === 1 ? "" : "s"}">
      <div class="request-status-heading"><span><i style="background:${color}"></i>${label}</span><strong>${count}</strong></div>
      <div class="request-status-track" aria-hidden="true"><i style="width:${proportion}%;background:${color}"></i></div>
    </section>`;
  }).join("")}</div>`;
}

async function loadHomepageRequests() {
  if (!window.QatarOpsRequests.canAccess()) {
    state.requests = [];
    state.homepageRequestsLoading = false;
    state.homepageRequestsError = "";
    renderHomepageRequests();
    return;
  }
  state.homepageRequestsLoading = true;
  state.homepageRequestsError = "";
  renderHomepageRequests();
  try {
    const response = await window.QatarOpsApi.Requests.list({ limit: 500 });
    state.requests = response.requests || [];
  } catch (error) {
    state.homepageRequestsError = error.message || "The Requests API is unavailable.";
  } finally {
    state.homepageRequestsLoading = false;
    renderHomepageRequests();
  }
}

function renderDashboardCharts() {
  renderFaultStatusChart();
  renderChargerStatusChart();
  renderFaultTrendChart();
  renderVisitActivityChart();
  renderRecordsBySiteChart();
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
  const container = document.getElementById("fault-status-chart");
  if (!container) return;
  const statuses = FAULT_STATUSES.map(({ label }) => label);
  container.innerHTML = `<div class="chart-comparison doughnut-comparison">${DASHBOARD_SITES.map((site) => {
    const records = recordsForDashboardSite(state.faults, site);
    const counts = groupCount(records, statuses, (fault) => fault.status);
    const total = records.length;
    const gradient = doughnutGradient(statuses, counts, total, FAULT_STATUS_COLORS);
    return `<section class="chart-comparison-item">
      <h3>${site.label}</h3>
      ${total ? `<div class="doughnut-chart" style="--chart-segments:${gradient}" role="img" aria-label="${site.label}: ${statusSummary(statuses, counts)}" title="${faultPercentageSummary(statuses, counts, total)}">
        ${doughnutSliceLabels(statuses, counts, total)}
        <div class="doughnut-centre"><strong>${total}</strong><span>Fault${total === 1 ? "" : "s"}</span></div>
      </div>` : `<div class="mini-chart-empty"><strong>0</strong><span>No faults</span></div>`}
    </section>`;
  }).join("")}</div>${sharedLegend(statuses, FAULT_STATUS_COLORS)}`;
}

function renderChargerStatusChart() {
  const chargers = (state.dashboardChargers.length
    ? state.dashboardChargers
    : state.sites.flatMap((site) => (site.chargers || []).map((charger) => ({ ...charger, siteName: site.name }))))
    .filter((charger) => String(charger.backendStatus || charger.status).toLowerCase() !== "archived");
  const statuses = CHARGER_STATUSES.map(({ label }) => label);
  const container = document.getElementById("charger-status-chart");
  if (!container) return;
  container.innerHTML = `<div class="chart-comparison stacked-comparison">${DASHBOARD_SITES.map((site) => {
    const records = recordsForDashboardSite(chargers, site);
    const counts = groupCount(records, statuses, (charger) => normalizeChargerStatus(charger.status));
    const total = records.length;
    return `<section class="stacked-chart-row">
      <div class="stacked-chart-heading"><h3>${site.label}</h3><strong>${total} Charger${total === 1 ? "" : "s"}</strong></div>
      ${total ? `<div class="stacked-bar" role="img" aria-label="${site.label}: ${statusSummary(statuses, counts)}">${statuses.map((status) => {
        const count = counts[status] || 0;
        if (!count) return "";
        const proportion = (count / total) * 100;
        return `<i style="width:${proportion}%;background:${CHARGER_STATUS_COLORS[status]}" title="${status}: ${count}">${proportion >= 14 ? `<b>${count}</b>` : ""}</i>`;
      }).join("")}</div>` : `<div class="stacked-bar empty"><span>No chargers</span></div>`}
    </section>`;
  }).join("")}</div>${sharedLegend(statuses, CHARGER_STATUS_COLORS)}`;
}

function normalizeChargerStatus(status) {
  if (!status || status === "Pending Data") return "Inactive";
  if (["Available", "Operational"].includes(status)) return "Active";
  if (status === "Critical") return "Faulted";
  if (["Warning", "Under Maintenance"].includes(status)) return "Maintenance";
  return status;
}

function recordsForDashboardSite(records, site) {
  if (!site.aliases.length) return records;
  return records.filter((record) => site.aliases.some((alias) => alias.toLowerCase() === String(record.siteName || "").toLowerCase()));
}

function sharedLegend(statuses, colorMap = {}, counts = null) {
  return `<div class="shared-chart-legend" aria-label="Chart legend">${statuses.map((status, index) => `<span><i style="background:${colorMap[status] || DASHBOARD_COLORS[index % DASHBOARD_COLORS.length]}"></i>${status}${counts ? ` ${counts[status] || 0}` : ""}</span>`).join("")}</div>`;
}

function statusSummary(statuses, counts) {
  return statuses.map((status) => `${status} ${counts[status] || 0}`).join(", ");
}

function faultPercentageSummary(statuses, counts, total) {
  return statuses.filter((status) => counts[status] > 0).map((status) => `${status}: ${Math.round((counts[status] / total) * 100)}%`).join(", ");
}

function doughnutSliceLabels(statuses, counts, total) {
  let offset = 0;
  return statuses.map((status) => {
    const count = counts[status] || 0;
    if (!count) return "";
    const percentage = (count / total) * 100;
    const midpoint = offset + percentage / 2;
    offset += percentage;
    if (percentage < 12) return "";
    const angle = (midpoint / 100) * Math.PI * 2;
    const x = 50 + Math.sin(angle) * 39;
    const y = 50 - Math.cos(angle) * 39;
    return `<span class="doughnut-slice-label" style="left:${x}%;top:${y}%" aria-hidden="true">${Math.round(percentage)}%</span>`;
  }).join("");
}

function doughnutGradient(statuses, counts, total, colorMap = {}) {
  let offset = 0;
  return statuses.filter((status) => counts[status] > 0).map((status, index) => {
    const start = offset;
    offset += ((counts[status] || 0) / total) * 100;
    return `${colorMap[status] || DASHBOARD_COLORS[index % DASHBOARD_COLORS.length]} ${start}% ${offset}%`;
  }).join(",");
}

let faultTrendChartInstance = null;

function localDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function startOfFaultTrendWeek(date) {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  result.setDate(result.getDate() - ((result.getDay() + 6) % 7));
  return result;
}

function faultTrendPeriodStart(date, grouping) {
  if (grouping === "month") return new Date(date.getFullYear(), date.getMonth(), 1);
  if (grouping === "week") return startOfFaultTrendWeek(date);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function nextFaultTrendPeriod(date, grouping) {
  const next = new Date(date);
  if (grouping === "month") next.setMonth(next.getMonth() + 1);
  else next.setDate(next.getDate() + (grouping === "week" ? 7 : 1));
  return next;
}

function faultTrendLabel(date, grouping) {
  if (grouping === "month") return date.toLocaleDateString(undefined, { month: "short", year: "numeric" });
  if (grouping === "week") return `Week of ${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function syncFaultTrendSiteSelector() {
  const selector = document.getElementById("fault-trend-site");
  if (!selector) return "";
  const selected = selector.value;
  selector.innerHTML = `<option value="">All Sites</option>${state.sites.map((site) => `<option value="${safeDetailValue(site.id || site.name)}">${safeDetailValue(site.name)}</option>`).join("")}`;
  if (selected && Array.from(selector.options).some((option) => option.value === selected)) selector.value = selected;
  return selector.value;
}

function faultTrendSiteColor(index) {
  return DASHBOARD_COLORS[index % DASHBOARD_COLORS.length];
}

function faultBelongsToSite(fault, site) {
  if (!site) return true;
  if (site.id && fault.siteId) return String(fault.siteId) === String(site.id);
  return String(fault.siteName || "").localeCompare(String(site.name || ""), undefined, { sensitivity: "base" }) === 0;
}

function buildFaultTrendSeries(faults, days, now = new Date()) {
  const grouping = days <= 30 ? "day" : days <= 90 ? "week" : "month";
  const rangeStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  rangeStart.setDate(rangeStart.getDate() - days + 1);
  const firstPeriod = faultTrendPeriodStart(rangeStart, grouping);
  const counts = new Map();
  const periods = [];
  for (let cursor = firstPeriod; cursor <= now; cursor = nextFaultTrendPeriod(cursor, grouping)) {
    const key = localDateKey(cursor);
    counts.set(key, 0);
    periods.push({ key, date: new Date(cursor) });
  }
  faults.forEach((fault) => {
    const date = new Date(getRecordDate(fault));
    if (Number.isNaN(date.getTime()) || date < rangeStart || date > now) return;
    const key = localDateKey(faultTrendPeriodStart(date, grouping));
    if (counts.has(key)) counts.set(key, counts.get(key) + 1);
  });
  return { grouping, labels: periods.map(({ date }) => faultTrendLabel(date, grouping)), values: periods.map(({ key }) => counts.get(key)) };
}

function destroyFaultTrendChart() {
  faultTrendChartInstance?.destroy();
  faultTrendChartInstance = null;
}

function renderFaultTrendChart() {
  const days = Number(document.getElementById("fault-trend-range")?.value || 30);
  const selectedSiteValue = syncFaultTrendSiteSelector();
  const selectedSite = state.sites.find((site) => String(site.id || site.name) === selectedSiteValue);
  const siteSeries = state.sites.map((site, index) => {
    const series = buildFaultTrendSeries(state.faults.filter((fault) => faultBelongsToSite(fault, site)), days);
    return { site, color: faultTrendSiteColor(index), series, total: series.values.reduce((sum, value) => sum + value, 0) };
  });
  const selectedEntry = siteSeries.find(({ site }) => String(site.id || site.name) === selectedSiteValue);
  const templateSeries = selectedEntry?.series || siteSeries[0]?.series || buildFaultTrendSeries([], days);
  const series = selectedEntry?.series || {
    ...templateSeries,
    values: templateSeries.values.map((_, periodIndex) => siteSeries.reduce((sum, entry) => sum + entry.series.values[periodIndex], 0)),
  };
  const total = selectedEntry?.total ?? siteSeries.reduce((sum, entry) => sum + entry.total, 0);
  const rangeLabel = document.getElementById("fault-trend-range")?.selectedOptions?.[0]?.textContent || `Last ${days} Days`;
  const subtitle = document.getElementById("fault-trend-subtitle");
  if (subtitle) subtitle.textContent = `Overview of faults over time · ${selectedSite?.name || "All Sites"} · ${rangeLabel}`;
  const title = document.getElementById("fault-trend-detail-title");
  const context = document.getElementById("fault-trend-context");
  const totalElement = document.getElementById("fault-trend-total");
  if (title) title.textContent = selectedSite ? `Fault Trend — ${selectedSite.name}` : "Total Faults (All Sites)";
  if (context) context.textContent = rangeLabel;
  if (totalElement) totalElement.textContent = total;
  renderFaultTrendSites(siteSeries, selectedSiteValue);
  renderFaultTrendLine(series, selectedEntry?.color || DASHBOARD_COLORS[0], Boolean(selectedSite));
}

function faultTrendSparkline(values, color, siteName) {
  const width = 176;
  const height = 34;
  const inset = 3;
  const max = Math.max(1, ...values);
  const points = values.map((value, index) => {
    const x = values.length === 1 ? width / 2 : inset + (index / (values.length - 1)) * (width - inset * 2);
    const y = height - inset - (value / max) * (height - inset * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return `<svg class="fault-trend-sparkline" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="${safeDetailValue(siteName)} fault trend"><line x1="0" y1="${height - inset}" x2="${width}" y2="${height - inset}" stroke="rgba(255,255,255,.08)"/><polyline points="${points}" fill="none" stroke="${color}" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>`;
}

function renderFaultTrendSites(siteSeries, selectedSiteValue) {
  const container = document.getElementById("fault-trend-site-list");
  if (!container) return;
  container.innerHTML = siteSeries.length ? siteSeries.map(({ site, color, series, total }) => {
    const value = String(site.id || site.name);
    const selected = value === selectedSiteValue;
    return `<button class="fault-trend-site-row${selected ? " selected" : ""}" type="button" data-fault-trend-site="${safeDetailValue(value)}" aria-pressed="${selected}">
      <span class="fault-trend-site-name"><i style="background:${color}"></i><b>${safeDetailValue(site.name)}</b><strong>${total}</strong></span>
      ${faultTrendSparkline(series.values, color, site.name)}
    </button>`;
  }).join("") : chartEmpty("No active sites are available.");
}

function renderFaultTrendLine(series, color, siteSelected) {
  const container = document.getElementById("fault-trend-chart");
  if (!container) return;
  destroyFaultTrendChart();
  if (!series.values.some((value) => value > 0)) {
    container.innerHTML = chartEmpty(siteSelected ? "No faults reported for this site during this period." : "No faults reported during this period.");
    return;
  }
  container.innerHTML = `<div class="fault-trend-canvas"><canvas aria-label="Number of faults over time" role="img"></canvas></div>`;
  if (typeof window.Chart === "undefined") {
    container.innerHTML = chartEmpty("Fault trend chart is temporarily unavailable.");
    return;
  }
  faultTrendChartInstance = new window.Chart(container.querySelector("canvas"), {
    type: "line",
    data: { labels: series.labels, datasets: [{ label: siteSelected ? "Site Faults" : "Total Faults", data: series.values, borderColor: color, backgroundColor: `${color}1f`, pointBackgroundColor: color, pointBorderColor: "#10253c", pointBorderWidth: 2, pointRadius: series.values.length > 20 ? 2 : 4, pointHoverRadius: 5, borderWidth: 3, tension: .25, fill: true }] },
    options: { responsive: true, maintainAspectRatio: false, animation: false, interaction: { intersect: false, mode: "index" }, plugins: { legend: { display: false }, tooltip: { displayColors: false, callbacks: { label: (context) => `Faults: ${context.parsed.y}` } } }, scales: { x: { grid: { display: false }, ticks: { color: "#9cafc6", maxRotation: 0, autoSkip: true, maxTicksLimit: 9 } }, y: { beginAtZero: true, ticks: { color: "#9cafc6", precision: 0, stepSize: 1 }, title: { display: true, text: "Number of faults", color: "#9cafc6" }, grid: { color: "rgba(255,255,255,.07)" } } } }
  });
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
