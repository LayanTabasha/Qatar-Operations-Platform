// Main bootstrap only.
// Page-specific code lives in frontend/pages/.
// Modal/form code lives in frontend/shared/modals/.
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
  const archiveTab = event.target.closest("[data-archive-tab]");
  if (archiveTab) {
    state.archive.tab = archiveTab.dataset.archiveTab;
    state.archive.search = "";
    renderSettings("Archive");
    return;
  }
  if (event.target.closest("[data-archive-retry]")) {
    loadArchiveData();
    return;
  }
  const archiveActive = event.target.closest("[data-archive-active]");
  if (archiveActive) {
    confirmArchiveActive(archiveActive.dataset.archiveActive, archiveActive.dataset.archiveId, archiveActive.dataset.archiveName);
    return;
  }
  const archiveRestore = event.target.closest("[data-archive-restore]");
  if (archiveRestore) {
    confirmArchiveRestore(archiveRestore.dataset.archiveRestore, archiveRestore.dataset.archiveId, archiveRestore.dataset.archiveName);
    return;
  }
  const archiveDelete = event.target.closest("[data-archive-delete]");
  if (archiveDelete) {
    confirmArchiveDelete(archiveDelete.dataset.archiveDelete, archiveDelete.dataset.archiveId, archiveDelete.dataset.archiveName);
    return;
  }
  const archiveDetails = event.target.closest("[data-archive-details]");
  if (archiveDetails) {
    showArchiveDetails(archiveDetails.dataset.archiveDetails, archiveDetails.dataset.archiveId);
    return;
  }
  if (event.target.closest("[data-archive-modal-close]") || event.target.id === "archive-action-backdrop") {
    closeArchiveModal();
    return;
  }
  const passwordButton = event.target.closest("#settings-change-password-button");
  if (passwordButton) return;

  const modalButton = event.target.closest("[data-modal]");
  if (modalButton?.dataset.siteContext) state.currentSiteName = modalButton.dataset.siteContext;
  if (modalButton?.dataset.modal === "siteVisit") state.currentVisitId = modalButton.dataset.visitId || "";
  if (modalButton?.dataset.modal === "fault") state.currentFaultId = modalButton.dataset.faultId || "";
  if (modalButton?.dataset.modal === "contact") state.currentContactId = modalButton.dataset.contactId || "";
  if (modalButton?.dataset.modal === "profile") {
    document.getElementById("profile-dropdown").classList.add("hidden");
    setRoute("settings");
    renderSettings("Profile");
    return;
  }
  if (modalButton) {
    openModal(
      modalButton.dataset.modal,
      modalButton.dataset.mode || (["siteVisit", "fault"].includes(modalButton.dataset.modal) ? "create" : "edit"),
      { siteId: modalButton.dataset.siteId || "", chargerId: modalButton.dataset.chargerId || "", lockSite: modalButton.dataset.lockSite === "true", lockLocation: modalButton.dataset.lockLocation === "true" },
    );
  }

  const contentEditButton = event.target.closest("[data-content-edit]");
  if (contentEditButton) {
    state.currentLegacyContentId = "";
    state.currentContentRecordId = contentEditButton.dataset.contentEdit;
    const modalType = { documents: "document", "weekly-reports": "weeklyReport", troubleshooting: "guide" }[contentEditButton.dataset.contentType];
    openModal(modalType, "edit");
  }

  const contentViewButton = event.target.closest("[data-content-view]");
  if (contentViewButton) openContentRecordDetail(contentViewButton.dataset.contentType, contentViewButton.dataset.contentView);

  const contentDeleteButton = event.target.closest("[data-content-delete]");
  if (contentDeleteButton) openContentDeleteConfirmation(contentDeleteButton.dataset.contentType, contentDeleteButton.dataset.contentDelete);

  const legacyContentEditButton = event.target.closest("[data-legacy-content-edit]");
  if (legacyContentEditButton) {
    state.currentContentRecordId = "";
    state.currentLegacyContentId = legacyContentEditButton.dataset.legacyContentEdit;
    openModal(legacyContentEditButton.dataset.legacyContentKind, "edit");
  }

  const legacyContentDeleteButton = event.target.closest("[data-legacy-content-delete]");
  if (legacyContentDeleteButton) openLegacyContentDeleteConfirmation(legacyContentDeleteButton.dataset.legacyContentDelete);

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

  const legacyReplaceButton = event.target.closest("[data-legacy-file-replace]");
  if (legacyReplaceButton) {
    event.preventDefault();
    replaceLegacyFile(legacyReplaceButton.dataset.legacyFileReplace);
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

  const visitDetailButton = event.target.closest("[data-visit-detail]");
  if (visitDetailButton) openSiteVisitDetail(visitDetailButton.dataset.visitDetail);
  const faultDetailButton = event.target.closest("[data-fault-detail]");
  if (faultDetailButton) openFaultDetail(faultDetailButton.dataset.faultDetail);
  const dtcSelectButton = event.target.closest("[data-dtc-select]");
  if (dtcSelectButton) selectFaultCatalogueRecord(dtcSelectButton.dataset.dtcSelect);
  const removeSiteVisitReportButton = event.target.closest("[data-site-visit-report-remove]");
  if (removeSiteVisitReportButton && window.confirm("Remove this report from the Site Visit? The Site Visit record will remain.")) {
    removeSiteVisitReportAttachment(removeSiteVisitReportButton.dataset.siteVisitReportRemove)
      .catch((error) => alert(error.message || "The report could not be removed."));
  }
  const removeAttachmentButton = event.target.closest("[data-attachment-remove]");
  if (removeAttachmentButton && window.confirm("Remove this report from the Site Visit? The visit itself will remain.")) {
    window.QatarOpsApi.Attachments.remove(removeAttachmentButton.dataset.attachmentRemove).then(() => {
      closeModal();
      return loadOperationalData();
    }).catch((error) => alert(error.message || "The report could not be removed."));
  }
  const contactDeleteButton = event.target.closest("[data-contact-delete]");
  if (contactDeleteButton && !isAdmin()) {
    alert("Access denied. This action requires administrator permission.");
  } else if (contactDeleteButton && window.confirm("Delete this contact?")) {
    window.QatarOpsApi.Contacts.remove(contactDeleteButton.dataset.contactDelete).then(async () => {
      await loadOperationalData();
      renderContactsPage();
    }).catch((error) => alert(error.message || "The contact could not be deleted."));
  }

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

document.addEventListener("input", (event) => {
  if (event.target.id === "archive-search") {
    state.archive.search = event.target.value;
    renderArchiveResults();
  }
});

document.getElementById("profile-button").addEventListener("click", () => document.getElementById("profile-dropdown").classList.toggle("hidden"));
document.getElementById("logout-button").addEventListener("click", logout);
document.getElementById("modal-close").addEventListener("click", closeModal);
document.getElementById("modal-form").addEventListener("submit", (event) => {
  if (event.currentTarget.dataset.requestMode) {
    event.preventDefault();
    submitRequestForm(event.currentTarget);
    return;
  }
  handleModalSubmit(event);
});
document.getElementById("modal-form").addEventListener("change", (event) => {
  if (event.target.id === "upload-site-image") handleSiteImageSelection();
  if (event.target.id === "site" || event.target.id === "related-site") refreshChargerSelect();
  if (event.target.id === "fault-code") renderFaultCodeDetails("fault-code");
  if (event.target.id === "has-technical-code") toggleFaultTechnicalDetails();
  if (event.target.id === "fault-status") toggleFaultResolutionDetails();
});
document.getElementById("modal-form").addEventListener("input", (event) => {
  if (event.target.id === "dtc-catalogue-search") queueFaultCatalogueSearch(event.target.value);
});
document.addEventListener("change", async (event) => {
  const faultStatus = event.target.closest("[data-fault-status]");
  if (!faultStatus) return;
  const fault = state.faults.find((item) => item.id === faultStatus.dataset.faultStatus);
  if (!fault) return;
  const previousStatus = fault.status;
  try {
    const response = await window.QatarOpsApi.Faults.update(fault.id, { status: String(faultStatus.value).toLowerCase().replace(/\s+/g, "_") });
    Object.assign(fault, normalizeFaultRecord(response.fault));
  } catch (error) {
    faultStatus.value = previousStatus;
    window.alert(error.message || "The fault status could not be saved.");
    return;
  }
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
document.getElementById("settings-panel").addEventListener("click", (event) => {
  if (event.target.closest("#platform-health-refresh, #platform-health-retry")) loadPlatformHealth();
});
["fault-trend-site", "fault-trend-range"].forEach((id) => {
  document.getElementById(id)?.addEventListener("change", renderDashboardCharts);
});
document.getElementById("fault-trend-site-list")?.addEventListener("click", (event) => {
  const row = event.target.closest("[data-fault-trend-site]");
  const selector = document.getElementById("fault-trend-site");
  if (!row || !selector) return;
  selector.value = row.dataset.faultTrendSite;
  renderFaultTrendChart();
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
