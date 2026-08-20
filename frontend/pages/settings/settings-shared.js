const personalSettingsItems = ["Profile", "Security"];
const administrationSettingsItems = ["User Management", "Site & Charger Configuration", "Archive", "Audit Logs"];
const systemSettingsItems = ["Platform Health"];
const settingsItems = [...personalSettingsItems, ...administrationSettingsItems, ...systemSettingsItems];

function formatSettingValue(value) {
  return String(valueOrPlaceholder(value))
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function settingInfoItem(label, value, tone = "") {
  return `<div class="settings-info-item ${tone}"><span>${label}</span><strong>${formatSettingValue(value)}</strong></div>`;
}

function renderSettingsMenu(selected) {
  const accountButtons = personalSettingsItems
    .map((item) => `<button class="${item === selected ? "active" : ""}" data-setting="${item}" type="button">${item}</button>`)
    .join("");
  const adminButtons = isAdmin()
    ? `<div class="settings-menu-label">Administration</div>${administrationSettingsItems.map((item) => `<button class="${item === selected ? "active" : ""}" data-setting="${item}" type="button">${item}</button>`).join("")}`
    : "";
  const systemButtons = isAdmin()
    ? `<div class="settings-menu-label">System</div>${systemSettingsItems.map((item) => `<button class="${item === selected ? "active" : ""}" data-setting="${item}" type="button">${item}</button>`).join("")}`
    : "";
  document.getElementById("settings-menu").innerHTML = `<div class="settings-menu-label">Account</div>${accountButtons}${adminButtons}${systemButtons}`;
}
