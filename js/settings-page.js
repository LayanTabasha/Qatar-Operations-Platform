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
  const userRows = state.users.length
    ? state.users.map((user) => `
    <tr>
      <td>${formatSettingValue(user.name)}</td>
      <td>${formatSettingValue(user.email)}</td>
      <td>${formatSettingValue(user.role)}</td>
      <td>${formatSettingValue(user.status)}</td>
      <td>${formatSettingValue(formatDateTime(user.lastLogin))}</td>
      <td>${formatSettingValue(formatDate(user.createdAt))}</td>
      <td>
        <div class="file-actions">
          <button class="file-icon-button" data-user-edit="${user.id}" data-tooltip="Edit" type="button">Edit</button>
          <button class="file-icon-button" data-user-reset="${user.id}" data-tooltip="Reset Password" type="button">Reset</button>
          <button class="${user.isActive ? "danger-button" : "secondary-button"}" data-user-status="${user.id}" data-active="${user.isActive ? "false" : "true"}" type="button">${user.isActive ? "Deactivate" : "Activate"}</button>
        </div>
      </td>
    </tr>
  `).join("")
    : `<tr><td colspan="7">No users found.</td></tr>`;
  return `<div class="table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Last Login</th><th>Date Created</th><th>Actions</th></tr></thead><tbody>${userRows}</tbody></table></div>`;
}

function renderUserManagementForm() {
  return `
    <form class="settings-form secure-form" id="settings-user-form" novalidate>
      <div class="error-message full" id="settings-user-error" aria-live="polite"></div>
      <div class="success-message full" id="settings-user-success" aria-live="polite"></div>
      <input id="settings-user-id" type="hidden" />
      <label><span>Full Name</span><input id="settings-user-name" type="text" autocomplete="name" /></label>
      <label><span>Email</span><input id="settings-user-email" type="email" autocomplete="email" /></label>
      <label><span>Temporary Password</span><input id="settings-user-password" type="password" autocomplete="new-password" /></label>
      <label><span>Role</span><select id="settings-user-role"><option value="operations_staff" selected>Operations Staff</option><option value="viewer">Viewer</option><option value="admin">Administrator</option></select></label>
      <div class="modal-actions full">
        <button class="secondary-button" id="settings-user-cancel" type="button">Clear</button>
        <button class="primary-button" id="settings-user-save" type="submit">Add User</button>
      </div>
    </form>
  `;
}

function roleLabel(role) {
  return {
    admin: "Administrator",
    operations_staff: "Operations Staff",
    viewer: "Viewer",
  }[role] || role;
}

function normalizeManagedUser(user) {
  return {
    id: user.id,
    name: user.full_name || user.name || user.email,
    email: user.email,
    role: roleLabel(user.role),
    roleKey: user.role,
    isActive: user.is_active !== false,
    status: user.is_active === false ? "Inactive" : "Active",
    lastLogin: user.last_login_at || "Not Available Yet",
    createdAt: user.created_at || "Not Available Yet",
  };
}

async function loadManagedUsers() {
  if (!isAdmin()) return;
  const panel = document.getElementById("settings-users-table");
  if (panel) panel.innerHTML = `<div class="empty-state"><h2>Loading users...</h2></div>`;
  try {
    const response = await UsersApi.list();
    state.users = (response.users || []).map(normalizeManagedUser);
    const target = document.getElementById("settings-users-table");
    if (target) target.innerHTML = renderUserTable();
  } catch (err) {
    const target = document.getElementById("settings-users-table");
    if (target) target.innerHTML = `<div class="empty-state"><h2>Could not load users</h2><p>${formatSettingValue(err.message)}</p></div>`;
  }
}

function clearUserForm() {
  ["settings-user-id", "settings-user-name", "settings-user-email", "settings-user-password"].forEach((id) => {
    const field = document.getElementById(id);
    if (field) field.value = "";
  });
  const role = document.getElementById("settings-user-role");
  if (role) role.value = "operations_staff";
  const button = document.getElementById("settings-user-save");
  if (button) button.textContent = "Add User";
  const email = document.getElementById("settings-user-email");
  if (email) email.disabled = false;
}

async function submitUserManagementForm() {
  const error = document.getElementById("settings-user-error");
  const success = document.getElementById("settings-user-success");
  if (error) error.textContent = "";
  if (success) success.textContent = "";
  const userId = document.getElementById("settings-user-id")?.value || "";
  const payload = {
    full_name: document.getElementById("settings-user-name")?.value.trim(),
    role: document.getElementById("settings-user-role")?.value || "operations_staff",
  };
  try {
    if (userId) {
      await UsersApi.update(userId, payload);
      if (success) success.textContent = "User updated.";
    } else {
      await UsersApi.create({
        ...payload,
        email: document.getElementById("settings-user-email")?.value.trim(),
        password: document.getElementById("settings-user-password")?.value,
      });
      if (success) success.textContent = "User created.";
    }
    clearUserForm();
    await loadManagedUsers();
  } catch (err) {
    if (error) error.textContent = err.message || "User could not be saved.";
  }
}

function editManagedUser(userId) {
  const user = state.users.find((item) => item.id === userId);
  if (!user) return;
  document.getElementById("settings-user-id").value = user.id;
  document.getElementById("settings-user-name").value = user.name;
  document.getElementById("settings-user-email").value = user.email;
  document.getElementById("settings-user-email").disabled = true;
  document.getElementById("settings-user-password").value = "";
  document.getElementById("settings-user-role").value = user.roleKey;
  document.getElementById("settings-user-save").textContent = "Save User";
}

async function changeManagedUserStatus(userId, isActive) {
  await UsersApi.updateStatus(userId, isActive);
  await loadManagedUsers();
}

async function resetManagedUserPassword(userId) {
  const password = window.prompt("Enter a temporary password for this user.");
  if (!password) return;
  await UsersApi.resetPassword(userId, password);
  alert("Temporary password has been saved.");
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
    "User Management": `<div class="settings-section"><div class="panel-head"><div><h2>User Management</h2><p>Create users and manage company-controlled account fields.</p></div></div>${renderUserManagementForm()}<div id="settings-users-table">${renderUserTable()}</div></div>`,
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
  if (selected === "User Management" && isAdmin()) loadManagedUsers();
}
