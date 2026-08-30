const FAULT_STATUSES = Object.freeze([
  { label: "Open", color: "#4f8dff" },
  { label: "In Progress", color: "#dca94b" },
  { label: "Monitoring", color: "#9b7de3" },
  { label: "Resolved", color: "#37c985" },
]);
const FAULT_STATUS_COLORS = Object.freeze(Object.fromEntries(FAULT_STATUSES.map(({ label, color }) => [label, color])));
const INACTIVE_SITE_COLOR = "#9cafc6";

function renderFaultStatusChart() {
  const container = document.getElementById("fault-status-chart");
  if (!container) return;
  const statuses = FAULT_STATUSES.map(({ label }) => label);
  const hasInactiveSite = DASHBOARD_SITES.slice(1).some((site) => dashboardSiteIsInactive(site));
  container.innerHTML = `<div class="chart-comparison doughnut-comparison">${DASHBOARD_SITES.map((site) => {
    const records = recordsForDashboardSite(state.faults, site);
    const counts = groupCount(records, statuses, (fault) => fault.status);
    const total = records.length;
    const inactive = site.aliases.length > 0 && dashboardSiteIsInactive(site);
    const label = `${site.label}${inactive ? " (Inactive)" : ""}`;
    const gradient = inactive ? `${INACTIVE_SITE_COLOR} 0% 100%` : doughnutGradient(statuses, counts, total, FAULT_STATUS_COLORS);
    return `<section class="chart-comparison-item">
      <h3>${label}</h3>
      ${total ? `<div class="doughnut-chart" style="--chart-segments:${gradient}" role="img" aria-label="${label}: ${statusSummary(statuses, counts)}" title="${inactive ? "Inactive site; actual fault statuses: " : ""}${faultPercentageSummary(statuses, counts, total)}">
        ${inactive ? "" : doughnutSliceLabels(statuses, counts, total)}
        <div class="doughnut-centre"><strong>${total}</strong><span>Fault${total === 1 ? "" : "s"}</span></div>
      </div>` : `<div class="mini-chart-empty${inactive ? " inactive-site" : ""}"${inactive ? ` role="img" aria-label="${label}: No faults"` : ""}><strong>0</strong><span>${inactive ? "Inactive · No faults" : "No faults"}</span></div>`}
    </section>`;
  }).join("")}</div>${sharedLegend(hasInactiveSite ? [...statuses, "Inactive Site"] : statuses, { ...FAULT_STATUS_COLORS, "Inactive Site": INACTIVE_SITE_COLOR })}`;
}

function dashboardSiteIsInactive(site) {
  const record = (state.sites || []).find((candidate) => site.aliases.some((alias) => alias.toLowerCase() === String(candidate.name || "").toLowerCase()));
  return String(record?.backendStatus || record?.status || "").toLowerCase() === "inactive";
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
