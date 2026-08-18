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
        <h2>Security</h2>
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

function healthStatusLabel(status) {
  return { healthy: "Operational", degraded: "Degraded", unavailable: "Unavailable", unknown: "Unknown", not_configured: "Not configured" }[status] || "Unknown";
}

function healthTone(status) {
  return { healthy: "status-good", degraded: "status-warning", unavailable: "status-bad" }[status] || "status-neutral";
}

function formatUptime(seconds) {
  if (!Number.isFinite(seconds)) return "Unknown";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return [days && `${days}d`, (days || hours) && `${hours}h`, `${minutes}m`].filter(Boolean).join(" ");
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
    healthInfoItem("Application Uptime", formatUptime(data.application?.uptimeSeconds), "healthy"),
    healthInfoItem("Application Version", data.application?.version, "healthy"),
    healthInfoItem("Last Health Check", formatDateTime(data.lastHealthCheck), "healthy"),
  ];
  if (data.migrations) cards.push(healthInfoItem("Latest Database Migration", data.migrations.latest || healthStatusLabel(data.migrations.status), data.migrations.status, data.migrations.message));
  if (data.backup) cards.push(healthInfoItem("Backup Status", healthStatusLabel(data.backup.status), data.backup.status, data.backup.message));
  return `<div class="settings-section platform-health"><div class="panel-head"><div><h2>Platform Health</h2><p>Live status of critical application dependencies.</p></div><button class="primary-button" id="platform-health-refresh" type="button">Refresh Status</button></div><div class="settings-info-grid">${cards.join("")}</div><p class="settings-note">Retrieved ${formatSettingValue(formatDateTime(data.retrievedAt))}</p></div>`;
}

async function loadPlatformHealth() {
  if (!isAdmin()) return;
  const panel = document.getElementById("settings-panel");
  if (!panel) return;
  panel.innerHTML = renderPlatformHealth(null, "loading");
  try {
    const data = await window.QatarOpsApi.PlatformHealth.platform();
    data.retrievedAt = new Date().toISOString();
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

function renderUserTable() {
  const currentUserId = state.authUser?.id || "";
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
          ${user.id === currentUserId
            ? `<button class="secondary-button" type="button" disabled title="You cannot deactivate your own account">Current User</button>`
            : user.isActive
              ? `<button class="danger-button" data-user-delete="${user.id}" type="button">Delete</button>`
              : `<button class="secondary-button" data-user-status="${user.id}" data-active="true" type="button">Activate</button><button class="danger-button" data-user-delete="${user.id}" type="button">Delete</button>`}
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
      <label><span>Role</span><select id="settings-user-role"><option value="operations_staff" selected>Operations Staff</option><option value="hq_user">HQ User</option><option value="viewer">Viewer</option><option value="admin">Administrator</option></select></label>
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
    hq_user: "HQ User",
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
    const response = await window.QatarOpsApi.Users.list();
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
      await window.QatarOpsApi.Users.update(userId, payload);
      if (success) success.textContent = "User updated.";
    } else {
      await window.QatarOpsApi.Users.create({
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
  if (userId === state.authUser?.id && !isActive) throw new Error("You cannot deactivate your own account.");
  await window.QatarOpsApi.Users.updateStatus(userId, isActive);
  await loadManagedUsers();
  const success = document.getElementById("settings-user-success");
  if (success) success.textContent = isActive ? "User activated." : "User deactivated.";
}

function openDeleteUserModal(userId) {
  if (!isAdmin() || userId === state.authUser?.id) return;
  const user = state.users.find((item) => item.id === userId);
  if (!user) return;

  const form = document.getElementById("modal-form");
  document.querySelector(".modal")?.classList.remove("preview-modal", "request-modal");
  document.getElementById("modal-eyebrow").textContent = "Administrator Action";
  document.getElementById("modal-title").textContent = "Delete User?";
  form.innerHTML = `
    <div class="modal-error full" id="modal-error" aria-live="polite"></div>
    <div class="settings-info-grid full">
      ${settingInfoItem("Name", user.name)}
      ${settingInfoItem("Email", user.email)}
    </div>
    <p class="modal-note">This permanently deletes the user account. The user will lose access immediately and cannot be restored. Historical operational records will be retained.</p>
    <div class="modal-actions"><button class="secondary-button" type="button" id="cancel-modal">Cancel</button><button class="danger-button" data-user-delete-confirm="${user.id}" type="button">Delete</button></div>`;
  document.getElementById("modal-backdrop").classList.remove("hidden");
  document.body.classList.add("modal-open");
}

document.getElementById("settings-panel")?.addEventListener("click", (event) => {
  const deleteButton = event.target.closest("[data-user-delete]");
  if (deleteButton) openDeleteUserModal(deleteButton.dataset.userDelete);
});

document.getElementById("modal-form")?.addEventListener("click", async (event) => {
  const confirmButton = event.target.closest("[data-user-delete-confirm]");
  if (!confirmButton) return;

  const errorBox = document.getElementById("modal-error");
  confirmButton.disabled = true;
  if (errorBox) errorBox.textContent = "";
  try {
    await window.QatarOpsApi.Users.remove(confirmButton.dataset.userDeleteConfirm);
    await loadManagedUsers();
    closeModal();
    const success = document.getElementById("settings-user-success");
    if (success) success.textContent = "User deleted successfully";
  } catch (error) {
    confirmButton.disabled = false;
    if (errorBox) errorBox.textContent = error.message || "User could not be deleted.";
  }
});

async function resetManagedUserPassword(userId) {
  const password = window.prompt("Enter a temporary password for this user.");
  if (!password) return;
  await window.QatarOpsApi.Users.resetPassword(userId, password);
  alert("Temporary password has been saved.");
}

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
