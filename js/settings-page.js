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
  document.getElementById("settings-menu").innerHTML = `<div class="settings-menu-label">Account</div>${accountButtons}${adminButtons}`;
}

function renderReadOnlyProfile(user) {
  return `
    <div class="settings-section">
      <div>
        <h2>Profile</h2>
        <p>Company-managed account details are shown here for reference. Changes to email, role, department, or status must be handled by an administrator.</p>
      </div>
      <div class="settings-info-grid">
        ${settingInfoItem("Name", user?.name || state.currentUser)}
        ${settingInfoItem("Email", user?.email || state.currentUserEmail)}
        ${settingInfoItem("Role", user?.role || state.currentUserRole)}
        ${settingInfoItem("Department", user?.department)}
        ${settingInfoItem("Account Status", user?.status, "status-good")}
      </div>
    </div>
  `;
}

function renderPasswordPanel() {
  return `
    <div class="settings-section">
      <div>
        <h2>Change Password</h2>
        <p>Confirm your current password before setting a new company account password.</p>
      </div>
      <form class="settings-form secure-form" id="settings-password-form" novalidate>
        <div class="error-message full" id="settings-password-error" aria-live="polite"></div>
        <div class="success-message full" id="settings-password-success" aria-live="polite"></div>
        <label><span>Current Password</span><input id="settings-current-password" type="password" autocomplete="current-password" /></label>
        <label><span>New Password</span><input id="settings-new-password" type="password" autocomplete="new-password" /></label>
        <label><span>Confirm New Password</span><input id="settings-confirm-password" type="password" autocomplete="new-password" /></label>
        <div class="password-requirements full">
          <strong>Password requirements</strong>
          <span>At least 10 characters, one uppercase letter, and one number.</span>
        </div>
        <div class="modal-actions full">
          <button class="primary-button" id="settings-change-password-button" type="submit">Change Password</button>
        </div>
      </form>
    </div>
  `;
}

function renderSecurityInfo(user) {
  return `
    <div class="settings-section">
      <div>
        <h2>Account Security</h2>
        <p>Security values are controlled by the authentication system and audit logs.</p>
      </div>
      <div class="settings-info-grid">
        ${settingInfoItem("Last Login", formatDateTime(user?.lastLogin))}
        ${settingInfoItem("Last Password Change", formatDateTime(user?.lastPasswordChange))}
        ${settingInfoItem("Account Created", formatDate(user?.createdAt))}
        ${settingInfoItem("Two-Factor Authentication", "Future")}
        ${settingInfoItem("Active Session", state.authenticated ? "Current browser session" : "Signed out")}
        ${settingInfoItem("Role", user?.role || state.currentUserRole)}
        ${settingInfoItem("Status", user?.status, user?.status === "Active" ? "status-good" : "")}
      </div>
    </div>
  `;
}

function renderSessionManagement(user) {
  return `
    <div class="settings-section">
      <div>
        <h2>Session Management</h2>
        <p>Control your current session. Device-wide session revocation belongs to the backend authentication provider.</p>
      </div>
      <div class="settings-info-grid">
        ${settingInfoItem("Signed In As", user?.email || state.currentUserEmail)}
        ${settingInfoItem("Session State", state.authenticated ? "Active" : "Inactive", state.authenticated ? "status-good" : "")}
        ${settingInfoItem("Last Login", formatDateTime(user?.lastLogin))}
      </div>
      <div class="quick-actions compact settings-actions">
        <button class="secondary-button" id="settings-view-session-button" type="button">View Active Session</button>
        <button class="secondary-button" type="button" disabled>Sign Out of All Devices</button>
        <button class="danger-button" id="settings-sign-out-button" type="button">Sign Out</button>
      </div>
      <p class="settings-note" id="settings-session-note" aria-live="polite"></p>
    </div>
  `;
}

function renderUserTable() {
  const userRows = state.users.map((user) => `
    <tr>
      <td>${formatSettingValue(user.name)}</td>
      <td>${formatSettingValue(user.email)}</td>
      <td>${formatSettingValue(user.role)}</td>
      <td>${formatSettingValue(user.department || "Qatar Operations")}</td>
      <td>${formatSettingValue(user.status)}</td>
      <td>${formatSettingValue(formatDateTime(user.lastLogin))}</td>
      <td>${formatSettingValue(formatDate(user.createdAt))}</td>
      <td>${formatSettingValue(user.createdBy)}</td>
      <td><button data-modal="profile" type="button">View</button></td>
    </tr>
  `).join("");
  return `<div class="table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Department</th><th>Status</th><th>Last Login</th><th>Date Created</th><th>Created By</th><th>Actions</th></tr></thead><tbody>${userRows}</tbody></table></div>`;
}

function renderFaultCatalogueTable() {
  const rows = state.faultCatalogue.length
    ? state.faultCatalogue.map((item) => `<tr><td>${formatSettingValue(item.faultCode)}</td><td>${formatSettingValue(item.faultName)}</td><td>${formatSettingValue(item.meaning)}</td><td>${formatSettingValue(item.severity)}</td><td>${formatSettingValue(item.recommendedAction)}</td><td>${item.active ? "Active" : "Disabled"}</td></tr>`).join("")
    : `<tr><td colspan="6">No official company fault codes have been imported or added yet.</td></tr>`;
  return `<div class="settings-section"><div class="panel-head"><div><h2>Fault Catalogue</h2><p>Administrator-managed official fault codes. Operations users can select these codes but cannot edit meanings.</p></div><button class="primary-button" data-modal="faultCode" type="button">Add Fault Code</button></div><div class="toolbar"><input placeholder="Search fault codes" disabled /><button class="secondary-button" type="button" disabled>Import Company List</button></div><div class="table-wrap"><table><thead><tr><th>Fault Code</th><th>Fault Name</th><th>Meaning</th><th>Severity</th><th>Recommended Action</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
}

function renderAdminPanel(selected) {
  const simpleTable = `<div class="table-wrap"><table><thead><tr><th>Name</th><th>Description</th><th>Owner</th><th>Actions</th></tr></thead><tbody><tr><td>Pending configuration</td><td>Backend controlled value</td><td>Administrator</td><td><button type="button">View</button></td></tr></tbody></table></div>`;
  const content = {
    "User Management": `<div class="settings-section"><div class="panel-head"><div><h2>User Management</h2><p>Create users and manage company-controlled account fields.</p></div><button class="primary-button" data-modal="user" type="button">Add User</button></div>${renderUserTable()}</div>`,
    "Roles & Permissions": `<div class="settings-section"><h2>Roles & Permissions</h2><p>Role assignment and permission changes are restricted to administrators.</p>${simpleTable}</div>`,
    "Site & Charger Configuration": `<div class="settings-section"><div class="panel-head"><div><h2>Site & Charger Configuration</h2><p>Administrator-controlled operating assets.</p></div><div class="quick-actions compact"><button class="primary-button" data-modal="site" data-mode="create" type="button">Add Site</button><button class="secondary-button" data-modal="charger" data-mode="create" type="button">Add Charger</button></div></div>${simpleTable}</div>`,
    "Fault Catalogue": renderFaultCatalogueTable(),
    "Fault Categories": `<div class="settings-section"><h2>Fault Categories</h2><p>Maintain fault categories used by operations workflows.</p>${simpleTable}</div>`,
    "Error Codes": `<div class="settings-section"><h2>Error Codes</h2><div class="table-wrap"><table><thead><tr><th>Code</th><th>Description</th><th>Category</th><th>Related charger type</th></tr></thead><tbody><tr><td>--</td><td>Pending Data</td><td>--</td><td>--</td></tr></tbody></table></div></div>`,
    "Upload Permissions": `<div class="settings-section"><h2>Upload Permissions</h2><p>Document, report, photo, and guide upload permissions should be managed by role.</p>${simpleTable}</div>`,
    "Data Backup": `<div class="settings-section"><h2>Data Backup</h2><p>Backups should run from the production backend and database layer.</p><div class="quick-actions compact settings-actions"><button class="secondary-button" type="button" disabled>Download Backup</button><button class="secondary-button" type="button" disabled>Import Data</button></div></div>`,
    "Export Data": `<div class="settings-section"><h2>Export Data</h2><p>Exports should be permission-controlled and logged.</p><div class="quick-actions compact settings-actions"><button class="secondary-button" type="button" disabled>Export Operations Data</button></div></div>`,
    "System Preferences": `<div class="settings-section"><h2>System Preferences</h2><p>Platform-level preferences belong in administrator-only configuration.</p>${simpleTable}</div>`,
    "Audit Logs": `<div class="settings-section"><h2>Audit Logs</h2><p>Security and administrative changes should be written to a backend audit log.</p><div class="activity-list">${getRecentActivities(8).map((item) => `<div class="activity-row"><span class="activity-icon">${activityIcon(item.actionType)}</span><strong><b>${formatSettingValue(item.description)}</b><small>by ${formatSettingValue(item.userName)}</small></strong><time title="${formatDateTime(item.occurredAt)}">${relativeTime(item.occurredAt)}</time></div>`).join("") || `<div><span>Event</span><strong>No audit activity yet</strong></div>`}</div></div>`,
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
    "Account Security": `${renderSecurityInfo(user)}${renderPasswordPanel()}`,
    "Session Management": renderSessionManagement(user),
  };

  panel.innerHTML = content[selected] || renderAdminPanel(selected);
}
