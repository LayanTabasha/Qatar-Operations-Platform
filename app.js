// Main bootstrap only.
// Page-specific code lives in:
// - js/home-page.js
// - js/sites-page.js
// - js/settings-page.js
// Modal/form code lives in js/modals.js.
// Shared data/helpers live in js/state.js.

document.getElementById("login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = event.currentTarget.querySelector("button[type='submit']");
  button.classList.add("is-loading");
  button.textContent = button.dataset.loadingText;
  try {
    await signIn(document.getElementById("login-email").value.trim(), document.getElementById("login-password").value);
  } finally {
    button.classList.remove("is-loading");
    button.textContent = "Sign in";
  }
});

document.getElementById("change-password-form").addEventListener("submit", (event) => {
  event.preventDefault();
  changeOwnPassword(
    document.getElementById("current-temp-password").value,
    document.getElementById("new-password").value,
    document.getElementById("confirm-new-password").value,
  );
});
document.getElementById("change-password-logout").addEventListener("click", logout);

document.querySelectorAll("[data-route]").forEach((item) => item.addEventListener("click", () => setRoute(item.dataset.route)));

document.addEventListener("click", (event) => {
  const passwordButton = event.target.closest("#settings-change-password-button");
  if (passwordButton) return;

  const modalButton = event.target.closest("[data-modal]");
  if (modalButton?.dataset.siteContext) state.currentSiteName = modalButton.dataset.siteContext;
  if (modalButton?.dataset.modal === "siteVisit") state.currentVisitId = modalButton.dataset.visitId || "";
  if (modalButton?.dataset.modal === "profile") {
    document.getElementById("profile-dropdown").classList.add("hidden");
    setRoute("settings");
    renderSettings("Profile");
    return;
  }
  if (modalButton) openModal(modalButton.dataset.modal, modalButton.dataset.mode || "edit");

  const previewButton = event.target.closest("[data-file-preview]");
  if (previewButton) {
    event.preventDefault();
    openFilePreview(previewButton.dataset.filePreview);
  }

  const previewAction = event.target.closest("[data-preview-action]");
  if (previewAction) {
    event.preventDefault();
    handlePreviewAction(previewAction.dataset.previewAction);
  }

  const downloadButton = event.target.closest("[data-file-download]");
  if (downloadButton) {
    event.preventDefault();
    downloadFile(downloadButton.dataset.fileDownload);
  }

  const siteButton = event.target.closest(".open-site");
  if (siteButton) openSite(siteButton.dataset.site);

  const chargerButton = event.target.closest(".open-charger");
  if (chargerButton) openCharger(chargerButton.dataset.site, chargerButton.dataset.charger);

  const restoreChargerButton = event.target.closest("[data-charger-restore]");
  if (restoreChargerButton) restoreArchivedCharger(restoreChargerButton.dataset.chargerRestore);

  const deleteChargerButton = event.target.closest("[data-charger-delete]");
  if (deleteChargerButton) {
    permanentlyDeleteArchivedCharger(
      deleteChargerButton.dataset.chargerDelete,
      deleteChargerButton.dataset.chargerName,
      deleteChargerButton.dataset.chargerCode,
    );
  }

  const retryOperationalDataButton = event.target.closest("#retry-operational-data");
  if (retryOperationalDataButton) loadOperationalData();

  const signOutButton = event.target.closest("#settings-sign-out-button");
  if (signOutButton) logout();

  const sessionButton = event.target.closest("#settings-view-session-button");
  if (sessionButton) {
    const note = document.getElementById("settings-session-note");
    const user = getCurrentUserRecord();
    if (note) note.textContent = `Active session for ${user?.email || state.currentUserEmail}. Last login: ${user?.lastLogin || "Not Available Yet"}.`;
  }

  const visitDetailButton = event.target.closest("[data-visit-detail]");
  if (visitDetailButton) openSiteVisitDetail(visitDetailButton.dataset.visitDetail);

  const editUserButton = event.target.closest("[data-user-edit]");
  if (editUserButton) editManagedUser(editUserButton.dataset.userEdit);

  const statusUserButton = event.target.closest("[data-user-status]");
  if (statusUserButton) {
    changeManagedUserStatus(statusUserButton.dataset.userStatus, statusUserButton.dataset.active === "true").catch((err) => {
      alert(err.message || "User status could not be changed.");
    });
  }

  const resetUserButton = event.target.closest("[data-user-reset]");
  if (resetUserButton) {
    resetManagedUserPassword(resetUserButton.dataset.userReset).catch((err) => {
      alert(err.message || "Password could not be reset.");
    });
  }

  const dtcSearchButton = event.target.closest("#dtc-search-button");
  if (dtcSearchButton) searchDtcCatalogue();

  const editDtcButton = event.target.closest("[data-dtc-edit]");
  if (editDtcButton) editDtcRecord(editDtcButton.dataset.dtcEdit);

  const statusDtcButton = event.target.closest("[data-dtc-status]");
  if (statusDtcButton) {
    changeDtcStatus(statusDtcButton.dataset.dtcStatus, statusDtcButton.dataset.active === "true").catch((err) => {
      alert(err.message || "DTC status could not be changed.");
    });
  }

  const clearUserButton = event.target.closest("#settings-user-cancel");
  if (clearUserButton) clearUserForm();

  const replaceSiteImageButton = event.target.closest("#replace-site-image");
  if (replaceSiteImageButton) {
    event.preventDefault();
    document.getElementById("upload-site-image")?.click();
  }

  const removeSiteImageButton = event.target.closest("#remove-site-image");
  if (removeSiteImageButton) {
    event.preventDefault();
    removeSiteImageSelection();
  }
});

document.getElementById("profile-button").addEventListener("click", () => document.getElementById("profile-dropdown").classList.toggle("hidden"));
document.getElementById("logout-button").addEventListener("click", logout);
document.getElementById("modal-close").addEventListener("click", closeModal);
document.getElementById("modal-form").addEventListener("submit", handleModalSubmit);
document.getElementById("modal-form").addEventListener("change", (event) => {
  if (event.target.id === "upload-site-image") handleSiteImageSelection();
  if (event.target.id === "site" || event.target.id === "related-site") refreshChargerSelect();
  if (event.target.id === "fault-code") renderFaultCodeDetails("fault-code");
});
document.getElementById("settings-panel").addEventListener("change", (event) => {
  if (event.target.id === "dtc-import-file") importDtcCatalogue(event.target.files?.[0]);
});
document.addEventListener("change", (event) => {
  const faultStatus = event.target.closest("[data-fault-status]");
  if (!faultStatus) return;
  const fault = state.faults.find((item) => item.id === faultStatus.dataset.faultStatus);
  if (!fault) return;
  const previousStatus = fault.status;
  fault.status = faultStatus.value;
  fault.updatedAt = new Date().toISOString();
  addActivity({
    actionType: "fault_status_changed",
    entityType: "fault",
    entityId: fault.faultId || fault.id,
    description: `${fault.faultId || "Fault"} for ${fault.chargerName || "selected charger"} at ${fault.siteName} changed from ${previousStatus} to ${fault.status}`,
    siteName: fault.siteName,
    chargerName: fault.chargerName,
  });
  renderCounts();
  renderActivity();
  saveState();
});
document.getElementById("modal-backdrop").addEventListener("click", (event) => {
  if (event.target.id === "modal-backdrop" || event.target.id === "cancel-modal") closeModal();
});
document.getElementById("settings-menu").addEventListener("click", (event) => {
  const button = event.target.closest("[data-setting]");
  if (button) renderSettings(button.dataset.setting);
});
document.getElementById("settings-panel").addEventListener("submit", (event) => {
  if (event.target.id === "settings-user-form") {
    event.preventDefault();
    submitUserManagementForm();
    return;
  }
  if (event.target.id !== "settings-password-form") return;
  event.preventDefault();
  changeSettingsPassword();
});
["fault-status-site-filter", "charger-status-site-filter", "fault-trend-range", "visit-activity-mode"].forEach((id) => {
  document.getElementById(id)?.addEventListener("change", renderDashboardCharts);
});
window.addEventListener("hashchange", () => {
  if (state.authenticated) setRoute(window.location.hash.replace("#", "") || "home");
});

async function bootstrapApp() {
  loadStoredState();
  renderDevCredentials();
  buildSites();
  renderCounts();
  renderActivity();
  const restored = await restoreAuthenticatedSession();
  if (!restored) showLoginScreen();
}

bootstrapApp();
setInterval(() => {
  if (state.authenticated) renderActivity();
}, 60000);
