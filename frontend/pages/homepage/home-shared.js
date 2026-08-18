const DASHBOARD_COLORS = ["#73d7ff", "#4f8dff", "#37c985", "#dca94b", "#ef6262", "#9cafc6"];
const DASHBOARD_SITES = [
  { label: "All Sites", aliases: [] },
  { label: "Al Mana", aliases: ["Al Mana"] },
  { label: "Mowasalat", aliases: ["Mowasalat"] },
  { label: "Msheireb", aliases: ["Msheireb", "Musheireb"] },
];

function groupCount(records, labels, getter) {
  const counts = Object.fromEntries(labels.map((label) => [label, 0]));
  records.forEach((record) => {
    const key = getter(record) || "Pending Data";
    counts[key] = (counts[key] || 0) + 1;
  });
  return counts;
}

function chartEmpty(message) {
  return `<div class="empty-state small"><strong>${message}</strong><span>Records entered in the platform will appear here automatically.</span></div>`;
}

function renderBarList(containerId, rows, emptyMessage) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  if (!total) {
    container.innerHTML = chartEmpty(emptyMessage);
    return;
  }
  container.innerHTML = `<div class="bar-list">${rows.map((row, index) => {
    const percent = Math.max(6, Math.round((row.value / total) * 100));
    return `<button class="bar-row" type="button" title="${row.label}: ${row.value}" data-chart-label="${row.label}">
      <span class="bar-label">${row.label}</span>
      <span class="bar-track"><i style="width:${percent}%; background:${DASHBOARD_COLORS[index % DASHBOARD_COLORS.length]}"></i></span>
      <strong>${row.value}</strong>
    </button>`;
  }).join("")}</div>`;
}

function recordsForDashboardSite(records, site) {
  if (!site.aliases.length) return records;
  return records.filter((record) => site.aliases.some((alias) => alias.toLowerCase() === String(record.siteName || "").toLowerCase()));
}

function sharedLegend(statuses, colorMap = {}, counts = null) {
  return `<div class="shared-chart-legend" aria-label="Chart legend">${statuses.map((status, index) => `<span><i style="background:${colorMap[status] || DASHBOARD_COLORS[index % DASHBOARD_COLORS.length]}"></i>${status}${counts ? ` ${counts[status] || 0}` : ""}</span>`).join("")}</div>`;
}

function statusSummary(statuses, counts) {
  return statuses.map((status) => `${status} ${counts[status] || 0}`).join(", ");
}
