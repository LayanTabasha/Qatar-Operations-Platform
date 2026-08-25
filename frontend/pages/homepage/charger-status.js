const CHARGER_STATUSES = Object.freeze([
  { label: "Active", color: "#37c985" },
  { label: "Maintenance", color: "#dca94b" },
  { label: "Faulted", color: "#ef6262" },
  { label: "Inactive", color: "#9cafc6" },
]);
const CHARGER_STATUS_COLORS = Object.freeze(Object.fromEntries(CHARGER_STATUSES.map(({ label, color }) => [label, color])));

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
    const counts = groupCount(records, statuses, (charger) => chargerDisplayStatus(charger));
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

function chargerDisplayStatus(charger) {
  const site = (state.sites || []).find((candidate) => String(candidate.name || "").toLowerCase() === String(charger.siteName || "").toLowerCase());
  if (String(site?.backendStatus || site?.status || "").toLowerCase() === "inactive") return "Inactive";
  return normalizeChargerStatus(charger.status);
}

function normalizeChargerStatus(status) {
  if (!status || status === "Pending Data") return "Inactive";
  if (["Available", "Operational"].includes(status)) return "Active";
  if (status === "Critical") return "Faulted";
  if (["Warning", "Under Maintenance"].includes(status)) return "Maintenance";
  return status;
}
