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
