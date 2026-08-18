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

function renderDashboardCharts() {
  renderFaultStatusChart();
  renderChargerStatusChart();
  renderFaultTrendChart();
  renderVisitActivityChart();
  renderRecordsBySiteChart();
}
