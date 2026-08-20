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
