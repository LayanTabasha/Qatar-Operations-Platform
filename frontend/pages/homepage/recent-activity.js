function renderActivity() {
  const recent = getRecentActivities(5);
  const rows = recent.length
    ? recent.map((item) => `<div class="activity-row">
        <span class="activity-icon">${activityIcon(item.actionType)}</span>
        <strong><b>${item.description}</b><small>by ${item.userName || "System"}</small></strong>
        <time datetime="${item.occurredAt}" title="${formatDateTime(item.occurredAt)}">${relativeTime(item.occurredAt)}</time>
      </div>`).join("")
    : `<div class="activity-row empty"><span class="activity-icon">--</span><strong><b>No recent activity yet.</b><small>Operational events will appear here after users make changes.</small></strong><time>--</time></div>`;
  document.getElementById("activity-list").innerHTML = rows;
}

function activityIcon(actionType = "") {
  if (actionType.includes("fault")) return "FLT";
  if (actionType.includes("visit")) return "VIS";
  if (actionType.includes("upload") || actionType.includes("document") || actionType.includes("report")) return "DOC";
  if (actionType.includes("charger")) return "CHG";
  if (actionType.includes("site")) return "SITE";
  if (actionType.includes("password") || actionType.includes("user")) return "SEC";
  return "OPS";
}
