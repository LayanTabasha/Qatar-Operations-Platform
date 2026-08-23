function renderKpiCards() {
  document.getElementById("kpi-sites").textContent = state.sites.length;
  document.getElementById("kpi-chargers").textContent = state.counts.chargers;
  document.getElementById("kpi-faults").textContent = state.counts.faults;
  document.getElementById("kpi-visits").textContent = state.counts.visits;
}
