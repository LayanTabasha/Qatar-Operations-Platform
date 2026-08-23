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
