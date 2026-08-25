function renderVisitActivityChart() {
  const container = document.getElementById("visit-activity-chart");
  if (!container) return;
  const statuses = ["Scheduled", "Completed", "Follow-Up Required"];
  const statusColors = { Scheduled: DASHBOARD_COLORS[0], Completed: DASHBOARD_COLORS[1], "Follow-Up Required": DASHBOARD_COLORS[3] };
  const siteRows = DASHBOARD_SITES.slice(1).map((site) => {
    const visits = recordsForDashboardSite(state.visits, site);
    const counts = groupCount(visits, statuses, (visit) => visit.status);
    return {
      label: site.label,
      counts,
      total: statuses.reduce((total, status) => total + (counts[status] || 0), 0),
    };
  });
  const allCounts = Object.fromEntries(statuses.map((status) => [
    status,
    siteRows.reduce((total, row) => total + (row.counts[status] || 0), 0),
  ]));
  const allTotal = siteRows.reduce((total, row) => total + row.total, 0);
  const rows = [{ label: DASHBOARD_SITES[0].label, counts: allCounts, total: allTotal }, ...siteRows];

  container.innerHTML = `<div class="visit-activity-list">${rows.map((row) => {
    const segments = statuses.map((status) => {
      const count = row.counts[status] || 0;
      if (!count || !allTotal) return "";
      const width = (count / allTotal) * 100;
      return `<i data-visit-status="${status}" title="${status}: ${count}" style="width:${width}%; background:${statusColors[status]}"></i>`;
    }).join("");
    const summary = statusSummary(statuses, row.counts);
    return `<div class="bar-row visit-activity-row" title="${row.label}: ${row.total}. ${summary}" data-chart-label="${row.label}">
      <span class="bar-label">${row.label}</span>
      <span class="bar-track visit-activity-track" aria-label="${row.label}: ${summary}">${segments}</span>
      <strong>${row.total}</strong>
    </div>`;
  }).join("")}</div>${sharedLegend(statuses, statusColors)}`;
}
