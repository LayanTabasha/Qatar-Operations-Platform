function healthStatusLabel(status) {
  return { healthy: "Operational", degraded: "Degraded", unavailable: "Unavailable", unknown: "Unknown", not_configured: "Not configured" }[status] || "Unknown";
}

function healthTone(status) {
  return { healthy: "status-good", degraded: "status-warning", unavailable: "status-bad" }[status] || "status-neutral";
}

function healthInfoItem(label, value, status = "unknown", message = "") {
  return `<div class="settings-info-item health-card ${healthTone(status)}"><span>${formatSettingValue(label)}</span><strong>${formatSettingValue(value)}</strong>${message ? `<small>${formatSettingValue(message)}</small>` : ""}</div>`;
}

function renderPlatformHealth(data = null, stateName = "loading", error = null) {
  if (stateName === "loading") {
    return `<div class="settings-section platform-health"><div class="panel-head"><div><h2>Platform Health</h2><p>Checking critical platform services...</p></div></div><div class="health-loading" role="status"><span class="spinner"></span> Loading platform status</div></div>`;
  }
  if (stateName === "error") {
    const accessMessage = error?.status === 401 ? "Your session has expired. Sign in again to view Platform Health." : error?.status === 403 ? "Administrator access is required to view Platform Health." : "Platform status could not be retrieved.";
    return `<div class="settings-section platform-health"><div><h2>Platform Health</h2><p>${formatSettingValue(accessMessage)}</p></div><div class="health-error" role="alert">${formatSettingValue(error?.message || "Request failed")}</div><div class="quick-actions compact"><button class="primary-button" id="platform-health-retry" type="button">Retry</button></div></div>`;
  }

  const cards = [
    healthInfoItem("Overall Platform Status", healthStatusLabel(data.status), data.status, data.message),
    healthInfoItem("Backend API", healthStatusLabel(data.components?.backend?.status), data.components?.backend?.status, data.components?.backend?.message),
    healthInfoItem("Database", healthStatusLabel(data.components?.database?.status), data.components?.database?.status, data.components?.database?.message),
    healthInfoItem("File Storage", healthStatusLabel(data.components?.storage?.status), data.components?.storage?.status, data.components?.storage?.message),
    healthInfoItem("Core Platform", healthStatusLabel(data.components?.core?.status), data.components?.core?.status, data.components?.core?.message),
    healthInfoItem("Application Version", data.application?.version, "healthy"),
    healthInfoItem("Last Health Check", formatDateTime(data.lastHealthCheck), "healthy"),
  ];
  return `<div class="settings-section platform-health"><div class="panel-head"><div><h2>Platform Health</h2><p>Live status of critical application dependencies.</p></div><button class="primary-button" id="platform-health-refresh" type="button">Refresh Status</button></div><div class="settings-info-grid">${cards.join("")}</div><p class="settings-note">Retrieved ${formatSettingValue(formatDateTime(data.retrievedAt))}</p></div>`;
}

async function loadPlatformHealth() {
  if (!isAdmin()) return;
  const panel = document.getElementById("settings-panel");
  if (!panel) return;
  panel.innerHTML = renderPlatformHealth(null, "loading");
  try {
    const data = await window.QatarOpsApi.PlatformHealth.platform();
    data.retrievedAt = data.lastHealthCheck;
    if (document.querySelector('#settings-menu [data-setting="Platform Health"].active')) panel.innerHTML = renderPlatformHealth(data, "ready");
  } catch (error) {
    if (document.querySelector('#settings-menu [data-setting="Platform Health"].active')) panel.innerHTML = renderPlatformHealth(null, "error", error);
  }
}

function renderPlatformHealthPlaceholder() {
  return `
    <div class="settings-section">
      <div class="panel-head">
        <div>
          <h2>Platform Health</h2>
          <p>Open Platform Health to check critical services.</p>
        </div>
      </div>
      <div class="settings-info-grid">
        ${settingInfoItem("Status", "Loading")}
      </div>
      <p class="settings-note">Retrieving live status...</p>
    </div>
  `;
}
