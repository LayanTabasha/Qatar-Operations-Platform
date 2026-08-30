const PLATFORM_HEALTH_POLL_INTERVAL_MS = 60000;
let platformHealthPollInterval = null;
let platformHealthAlertSignature = "";

function platformHealthAlertElement() {
  return document.getElementById("global-platform-health-alert");
}

function platformHealthReason(data) {
  const components = data?.components || {};
  const failing = [components.database, components.storage, components.core]
    .find((component) => component && component.status !== "healthy");
  return failing?.message || data?.message || "One or more platform services are unavailable";
}

function clearPlatformHealthAlert() {
  const alert = platformHealthAlertElement();
  if (!alert || platformHealthAlertSignature === "healthy") return;
  alert.replaceChildren();
  alert.className = "global-health-alert hidden";
  platformHealthAlertSignature = "healthy";
}

function renderGlobalPlatformHealthAlert({ status, message }) {
  if (!isAdmin() || status === "healthy") {
    clearPlatformHealthAlert();
    return;
  }
  const normalizedStatus = status === "degraded" ? "degraded" : "unavailable";
  const signature = `${normalizedStatus}|${message}`;
  if (signature === platformHealthAlertSignature) return;
  const alert = platformHealthAlertElement();
  if (!alert) return;
  alert.className = `global-health-alert global-health-alert-${normalizedStatus}`;
  alert.innerHTML = `<div class="global-health-alert-message"><span aria-hidden="true">⚠</span><strong>${normalizedStatus === "degraded" ? "Platform Health Degraded" : "Platform Health Unavailable"}</strong><span>— ${formatSettingValue(message)}</span></div><button id="global-health-view" type="button">View Health</button>`;
  platformHealthAlertSignature = signature;
}

async function checkGlobalPlatformHealth() {
  if (!state.authenticated || !isAdmin()) return;
  try {
    const data = await window.QatarOpsApi.PlatformHealth.platform();
    renderGlobalPlatformHealthAlert({ status: data.status, message: platformHealthReason(data) });
  } catch {
    renderGlobalPlatformHealthAlert({ status: "unavailable", message: "Platform Health Check Unavailable" });
  }
}

function stopPlatformHealthMonitoring() {
  if (platformHealthPollInterval !== null) clearInterval(platformHealthPollInterval);
  platformHealthPollInterval = null;
  clearPlatformHealthAlert();
}

function startPlatformHealthMonitoring() {
  stopPlatformHealthMonitoring();
  if (!state.authenticated || !isAdmin()) return;
  checkGlobalPlatformHealth();
  platformHealthPollInterval = setInterval(checkGlobalPlatformHealth, PLATFORM_HEALTH_POLL_INTERVAL_MS);
}

document.getElementById("global-platform-health-alert")?.addEventListener("click", (event) => {
  if (!event.target.closest("#global-health-view") || !isAdmin()) return;
  setRoute("settings");
  renderSettings("Platform Health");
});
