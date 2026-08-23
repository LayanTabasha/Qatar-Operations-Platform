function renderCounts() {
  refreshDerivedCounts();
  renderKpiCards();
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
