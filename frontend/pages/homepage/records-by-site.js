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
