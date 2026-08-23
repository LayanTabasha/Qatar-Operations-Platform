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
