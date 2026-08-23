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
