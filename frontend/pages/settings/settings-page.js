function renderAdminPanel(selected) {
  const simpleTable = `<div class="table-wrap"><table><thead><tr><th>Name</th><th>Description</th><th>Owner</th><th>Actions</th></tr></thead><tbody><tr><td>Pending configuration</td><td>Backend controlled value</td><td>Administrator</td><td><button type="button">View</button></td></tr></tbody></table></div>`;
  const content = {
    "User Management": `<div class="settings-section"><div class="panel-head"><div><h2>User Management</h2><p>Create users and manage company-controlled account fields.</p></div></div>${renderUserManagementForm()}<div id="settings-users-table">${renderUserTable()}</div></div>`,
    "Site & Charger Configuration": `<div class="settings-section"><div class="panel-head"><div><h2>Site & Charger Configuration</h2><p>Administrator-controlled operating assets.</p></div><div class="quick-actions compact"><button class="primary-button" data-modal="site" data-mode="create" type="button">Add Site</button><button class="secondary-button" data-modal="charger" data-mode="create" type="button">Add Charger</button></div></div>${simpleTable}</div>`,
    "Archive": renderArchivePage(),
    "Audit Logs": `<div class="settings-section"><h2>Audit Logs</h2><p>Security and administrative changes should be written to a backend audit log.</p><div class="activity-list">${getRecentActivities(8).map((item) => `<div class="activity-row"><span class="activity-icon">${activityIcon(item.actionType)}</span><strong><b>${formatSettingValue(item.description)}</b><small>by ${formatSettingValue(item.userName)}</small></strong><time title="${formatDateTime(item.occurredAt)}">${relativeTime(item.occurredAt)}</time></div>`).join("") || `<div><span>Event</span><strong>No audit activity yet</strong></div>`}</div></div>`,
    "Platform Health": renderPlatformHealthPlaceholder(),
  };
  return content[selected] || content["User Management"];
}

function renderSettings(selected = "Profile") {
  const user = getCurrentUserRecord();
  const availableSettings = isAdmin() ? settingsItems : personalSettingsItems;
  if (!availableSettings.includes(selected)) selected = availableSettings[0];

  renderSettingsMenu(selected);

  const panel = document.getElementById("settings-panel");
  if (!isAdmin() && administrationSettingsItems.includes(selected)) {
    panel.innerHTML = `<div class="settings-section"><h2>Access Denied</h2><p>You do not have permission to access this page.</p></div>`;
    return;
  }

  const content = {
    "Profile": renderReadOnlyProfile(user),
    "Security": `${renderSecurityInfo(user)}${renderPasswordPanel()}`,
  };

  panel.innerHTML = content[selected] || renderAdminPanel(selected);
  if (selected === "User Management" && isAdmin()) loadManagedUsers();
  if (selected === "Archive" && isAdmin()) loadArchiveData();
  if (selected === "Platform Health" && isAdmin()) loadPlatformHealth();
}
