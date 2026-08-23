async function handleModalSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const required = Array.from(form.querySelectorAll("[data-required='true']")).filter((input) => !input.value.trim());
  if (required.length) {
    document.getElementById("modal-error").textContent = "Please complete the visible form fields before saving.";
    return;
  }
  if (form.dataset.type === "siteVisit" && !validateVisitTimes()) return;
  const siteImageInput = document.getElementById("upload-site-image");
  if (form.dataset.type === "site" && siteImageInput?.files?.[0] && !pendingModalImage) {
    await handleSiteImageSelection();
    if (!pendingModalImage) return;
  }
  const button = form.querySelector("button[type='submit']");
  button.classList.add("is-loading");
  button.disabled = true;
  button.textContent = button.dataset.loadingText;
  setTimeout(async () => {
    try {
      await simulateUpdate(form.dataset.type, form.dataset.mode);
      button.textContent = "Saved";
      setTimeout(closeModal, 300);
    } catch (error) {
      console.error("Save failed", error);
      document.getElementById("modal-error").textContent = error.message || "The record could not be saved.";
      button.textContent = "Save";
    } finally {
      button.classList.remove("is-loading");
      button.disabled = false;
    }
  }, 350);
}

function validateVisitTimes() {
  const error = document.getElementById("modal-error");
  if (error) error.textContent = "";
  const visitDate = document.getElementById("visit-date")?.value || "";
  const timeIn = document.getElementById("time-in")?.value || "";
  const timeOut = document.getElementById("time-out")?.value || "";
  const engineer = document.getElementById("engineer-name")?.value.trim() || document.getElementById("technician-name")?.value.trim() || "";
  const status = document.getElementById("visit-status")?.value || "";
  if (!visitDate || !timeIn || !engineer) {
    if (error) error.textContent = "Visit Date, Time In, and Engineer / Technician are required.";
    return false;
  }
  if (!timeOut && status !== "Ongoing") {
    if (error) error.textContent = "Time Out is required unless the visit status is Ongoing.";
    return false;
  }
  if (timeIn && timeOut && timeOut < timeIn) {
    if (error) error.textContent = "Time Out cannot be earlier than Time In.";
    return false;
  }
  return true;
}

function backendCodeFromName(name, fallback = "RECORD") {
  const code = String(name || fallback)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 50);
  return code.length >= 2 ? code : `${code || fallback}_1`;
}

function backendSiteStatus(status) {
  return String(status || "").toLowerCase() === "archived" ? "archived" : "active";
}

function backendChargerStatus(status) {
  const normalized = String(status || "").toLowerCase();
  if (["maintenance", "faulted", "archived"].includes(normalized)) return normalized;
  if (["warning", "critical"].includes(normalized)) return "faulted";
  return "active";
}

function parsePowerKw(value) {
  const match = String(value || "").match(/\d+(\.\d+)?/);
  return match ? Number(match[0]) : 0;
}

function userFriendlyApiError(error) {
  if (error?.status === 409) return "A record with the same code or name already exists.";
  if (error?.status === 400) return error.message || "Please check the form values and try again.";
  if (error?.status === 403) return "You do not have permission to save this record.";
  return error?.message || "The backend could not save this record.";
}

async function simulateUpdate(type, mode = "edit") {
  let activity = null;
  if (type === "contentDelete") {
    const form = document.getElementById("modal-form");
    if (document.getElementById("content-delete-confirmation")?.value.trim() !== "DELETE") throw new Error("Type DELETE exactly to confirm permanent deletion.");
    await window.QatarOpsApi.ContentRecords.remove(form.dataset.contentType, form.dataset.recordId);
    state.uploads = state.uploads.filter((file) => file.recordId !== form.dataset.recordId);
    await loadOperationalData();
    return;
  }
  if (type === "legacyContentDelete") {
    const form = document.getElementById("modal-form");
    if (document.getElementById("content-delete-confirmation")?.value.trim() !== "DELETE") throw new Error("Type DELETE exactly to confirm permanent deletion.");
    const existing = state.uploads.find((file) => file.id === form.dataset.fileId && !file.recordPersisted);
    if (!existing) throw new Error("This record is no longer available.");
    state.uploads = state.uploads.filter((file) => file.id !== form.dataset.fileId);
    saveState();
    refreshOpenProfiles();
    renderCounts();
    return;
  }
  if (type === "operationalDelete") {
    const form = document.getElementById("modal-form");
    if (document.getElementById("operational-delete-confirmation")?.value.trim() !== "DELETE") throw new Error("Type DELETE exactly to confirm deletion.");
    if (form.dataset.deleteType === "siteVisit") await window.QatarOpsApi.SiteVisits.remove(form.dataset.recordId);
    else await window.QatarOpsApi.Faults.remove(form.dataset.recordId);
    await loadOperationalData();
    return;
  }
  if (type === "site") {
    const name = document.getElementById("site-name")?.value.trim();
    const location = document.getElementById("location")?.value.trim();
    const client = document.getElementById("client-organization")?.value.trim();
    const status = document.getElementById("status")?.value || "Pending Data";
    const description = document.getElementById("description")?.value.trim();
    const notes = document.getElementById("notes")?.value.trim();
    if (!name) throw new Error("Site name is required.");
    const existing = mode !== "create" ? getSite(state.currentSiteName) : null;
    const payload = {
      name,
      code: existing?.code || backendCodeFromName(name),
      location: location || null,
      address: client || null,
      description: [description, notes].filter(Boolean).join("\n\n") || null,
    };
    try {
      const response = existing?.id
        ? await window.QatarOpsApi.Sites.update(existing.id, payload)
        : await window.QatarOpsApi.Sites.create(payload);
      if (backendSiteStatus(status) !== (response.site?.status || "active")) {
        await window.QatarOpsApi.Sites.updateStatus(response.site.id, backendSiteStatus(status));
      }
      if (pendingSiteImageFile) {
        try {
          const imageResponse = await window.QatarOpsApi.Sites.uploadImage(response.site.id, pendingSiteImageFile);
          response.site = imageResponse.site || response.site;
        } catch (uploadError) {
          await loadOperationalData();
          throw new Error(`Site details were saved, but the image upload failed: ${userFriendlyApiError(uploadError)}`);
        }
      }
      state.currentSiteName = response.site?.name || name;
      await loadOperationalData();
      if (state.currentSiteName) openSite(state.currentSiteName);
      activity = { actionType: existing ? "site_updated" : "site_added", entityType: "site", entityId: state.currentSiteName, description: `${state.currentSiteName} site ${existing ? "information updated" : "added"}`, siteName: state.currentSiteName };
    } catch (error) {
      throw new Error(userFriendlyApiError(error));
    }
  }
  if (type === "contact") {
    const assignedSiteName = document.getElementById("assigned-site")?.value || "";
    const site = assignedSiteName ? getSite(assignedSiteName) : null;
    if (assignedSiteName && !site?.id) throw new Error("Choose a valid assigned site.");
    const payload = {
      site_id: site?.id || null,
      contact_name: document.getElementById("name")?.value.trim(),
      job_title: document.getElementById("role")?.value.trim() || null,
      organization: document.getElementById("organization-department")?.value.trim() || null,
      phone: document.getElementById("phone")?.value.trim() || null,
      email: document.getElementById("email")?.value.trim() || null,
      notes: document.getElementById("notes")?.value.trim() || null,
    };
    if (!payload.contact_name) throw new Error("Contact name is required.");
    try {
      if (mode === "create") await window.QatarOpsApi.Contacts.create(payload);
      else await window.QatarOpsApi.Contacts.update(state.currentContactId, payload);
      await loadOperationalData();
      renderContactsPage();
    } catch (error) { throw new Error(userFriendlyApiError(error)); }
  }
  if (type === "charger") {
    const form = document.getElementById("modal-form");
    const lockedSiteId = mode === "create" ? form?.dataset.siteId : "";
    const siteName = document.getElementById("site")?.value || state.currentSiteName || state.sites[0]?.name;
    const site = lockedSiteId ? state.sites.find((item) => item.id === lockedSiteId) : getSite(siteName);
    if (!site?.id) throw new Error("Choose a valid site before saving this charger.");
    const name = document.getElementById("charger-name")?.value.trim();
    const chargerType = document.getElementById("charger-type")?.value;
    if (!name) throw new Error("Charger name is required.");
    if (!["AC", "DC"].includes(chargerType)) throw new Error("Charger type must be AC or DC for the backend MVP.");
    const existing = mode !== "create" ? getCharger(state.currentSiteName, state.currentChargerId) : null;
    const payload = {
      site_id: site.id,
      name,
      code: existing?.code || backendCodeFromName(name),
      manufacturer: document.getElementById("manufacturer")?.value.trim() || null,
      operator: document.getElementById("operator")?.value.trim() || null,
      administrator: document.getElementById("administrator")?.value.trim() || null,
      installation_date: document.getElementById("installation-date")?.value || null,
      model: document.getElementById("model")?.value.trim() || null,
      serial_number: document.getElementById("serial-number")?.value.trim() || null,
      type: chargerType,
      power_kw: parsePowerKw(document.getElementById("capacity")?.value),
      firmware_version: null,
      description: document.getElementById("notes")?.value.trim() || null,
    };
    try {
      const response = existing?.id
        ? await window.QatarOpsApi.Chargers.update(existing.id, payload)
        : await window.QatarOpsApi.Chargers.create(payload);
      const requestedStatus = backendChargerStatus(document.getElementById("status")?.value);
      if (requestedStatus !== (response.charger?.status || "active")) {
        await window.QatarOpsApi.Chargers.updateStatus(response.charger.id, requestedStatus);
      }
      state.currentSiteName = response.charger?.site_name || site.name;
      state.currentChargerId = response.charger?.id || existing?.id || "";
      await loadOperationalData();
      refreshOpenProfiles();
      activity = {
        actionType: existing ? "charger_updated" : "charger_added",
        entityType: "charger",
        entityId: state.currentChargerId,
        description: `${name} ${existing ? "information updated in" : "added to"} ${state.currentSiteName}`,
        siteName: state.currentSiteName,
        chargerName: name,
      };
    } catch (error) {
      throw new Error(userFriendlyApiError(error));
    }
  }
  if (type === "deleteCharger") {
    const confirmation = document.getElementById("type-remove-to-confirm")?.value.trim();
    if (confirmation !== "REMOVE") return;
    const siteName = state.currentSiteName;
    const charger = getCharger();
    const chargerName = charger?.name || "Charger";
    const chargerId = charger?.id || state.currentChargerId;
    if (!chargerId) throw new Error("No charger is selected.");
    try {
      await window.QatarOpsApi.Chargers.archive(chargerId);
      state.currentChargerId = "";
      await loadOperationalData();
      document.getElementById("charger-profile").classList.add("hidden");
      if (state.currentSiteName) openSite(state.currentSiteName, "Chargers");
    } catch (error) {
      throw new Error(userFriendlyApiError(error));
    }
    addActivity({
      actionType: "charger_archived",
      entityType: "charger",
      entityId: chargerId,
      description: `${chargerName} archived from ${siteName}`,
      siteName,
      chargerName,
    });
    renderCounts();
    saveState();
    renderActivity();
    return;
  }
  if (type === "user") {
    if (!isAdmin()) return;
    const fullName = document.getElementById("full-name")?.value.trim();
    const email = document.getElementById("work-email")?.value.trim().toLowerCase();
    const roleLabel = document.getElementById("role")?.value || "Operations Staff";
    const role = { "Administrator": "admin", "Operations Staff": "operations_staff", "Viewer": "viewer" }[roleLabel] || "operations_staff";
    const temporaryPassword = document.getElementById("temporary-password")?.value.trim();
    if (!fullName || !email || !temporaryPassword) throw new Error("Full name, email, and temporary password are required.");
    await window.QatarOpsApi.Users.create({
      full_name: fullName,
      email,
      password: temporaryPassword,
      role,
    });
    await loadManagedUsers();
    renderSettings("User Management");
    activity = { actionType: "user_created", entityType: "user", entityId: email, description: `${fullName} user account created` };
  }
  if (type === "faultCode") {
    if (!isAdmin()) return;
    const dtcId = form.dataset.dtcId || "";
    const faultCode = document.getElementById("fault-code")?.value.trim();
    const faultName = document.getElementById("fault-name")?.value.trim();
    if (!faultCode || !faultName) {
      throw new Error("Enter a unique fault code and fault name.");
    }
    const payload = {
      dtc_code: faultCode,
      fault_title: faultName,
      description: document.getElementById("meaning")?.value.trim() || "",
      severity: document.getElementById("severity")?.value || "Not Classified",
      recommended_actions: document.getElementById("recommended-action")?.value.trim() || "",
      is_active: document.getElementById("status")?.value !== "Disabled",
    };
    const response = dtcId ? await window.QatarOpsApi.Dtc.update(dtcId, payload) : await window.QatarOpsApi.Dtc.create(payload);
    const entry = normalizeFaultCatalogueRecord(response.dtc_record);
    state.faultCatalogue = [entry, ...state.faultCatalogue.filter((item) => item.id !== entry.id)];
    activity = { actionType: dtcId ? "fault_catalogue_updated" : "fault_catalogue_added", entityType: "fault_catalogue", entityId: entry.id, description: `${entry.faultCode} ${dtcId ? "updated in" : "added to"} DTC catalogue` };
  }
  if (type === "fault") {
    const { site, siteName, chargerId, chargerName, charger } = getSelectedCharger();
    if (!site?.id || !chargerId || !charger || (charger.site_id && charger.site_id !== site.id)) throw new Error("Choose a valid site and charger before saving this fault.");
    selectedOperationalFiles().forEach(({ input, file }) => validateModuleFile(type, input.id, file));
    const hasTechnicalCode = document.getElementById("has-technical-code")?.value === "Yes";
    const catalogueItem = hasTechnicalCode ? selectedFaultCatalogueItem("fault-code") : null;
    const status = document.getElementById("fault-status")?.value || "Open";
    const reportedDate = document.getElementById("date-reported")?.value || new Date().toISOString().slice(0, 10);
    const reportedTime = document.getElementById("time-reported")?.value || new Date().toTimeString().slice(0, 5);
    const existing = mode !== "create" ? state.faults.find((item) => item.id === state.currentFaultId) : null;
    const backendValue = (value) => String(value || "").trim().toLowerCase().replace(/\s+/g, "_");
    const payload = {
      site_id: site.id, charger_id: chargerId, fault_catalogue_id: catalogueItem?.id || null,
      fault_code: hasTechnicalCode ? document.getElementById("dtc-code")?.value.trim() || null : null,
      ftb_code: hasTechnicalCode ? document.getElementById("ftb-code")?.value.trim() || null : null,
      component: hasTechnicalCode ? document.getElementById("component-ecu")?.value.trim() || null : null,
      fault_type: document.getElementById("fault-category")?.value || "Other",
      title: document.getElementById("fault-title")?.value.trim() || "Manual fault",
      description: document.getElementById("description")?.value.trim() || null,
      technician_observation: hasTechnicalCode ? document.getElementById("catalogue-description")?.value.trim() || null : null,
      possible_causes: hasTechnicalCode ? document.getElementById("possible-causes")?.value.trim() || null : null,
      recommended_actions: hasTechnicalCode ? document.getElementById("recommended-actions")?.value.trim() || null : null,
      category: document.getElementById("fault-category")?.value || "Other",
      technical_category: hasTechnicalCode ? document.getElementById("technical-category")?.value.trim() || null : null,
      severity: backendValue(document.getElementById("severity")?.value || "medium"), priority: backendValue(document.getElementById("priority")?.value || "medium"),
      status: backendValue(status), charger_status: document.getElementById("current-charger-status")?.value || null,
      reported_by_name: document.getElementById("reported-by")?.value.trim() || state.currentUser || null,
      comments: document.getElementById("comments")?.value.trim() || null, resolution_notes: document.getElementById("comments")?.value.trim() || null,
      requires_site_visit: document.getElementById("site-visit-required")?.value === "Yes", reported_at: new Date(`${reportedDate}T${reportedTime}`).toISOString(),
    };
    const response = existing ? await window.QatarOpsApi.Faults.update(existing.id, payload) : await window.QatarOpsApi.Faults.create(payload);
    const fault = normalizeFaultRecord(response.fault);
    try { await persistOperationalFiles("faults", fault.id, type, existing?.attachmentRecords || []); }
    catch (error) { await loadOperationalData(); throw new Error(`The fault was saved, but its photo upload failed. Reopen the fault to retry. ${error.message}`); }
    state.currentFaultId = fault.id;
    await loadOperationalData();
    activity = {
      actionType: existing ? "fault_updated" : "fault_reported",
      entityType: "fault",
      entityId: fault.faultId,
      description: `${fault.faultId} ${existing ? "updated" : "reported"} for ${chargerName || "selected charger"} at ${siteName}`,
      siteName,
      chargerName,
    };
  }
  if (type === "siteVisit") {
    const { siteName, chargerId, chargerName } = getSelectedCharger();
    const site = getSite(siteName);
    const visitDate = document.getElementById("visit-date")?.value || new Date().toISOString().slice(0, 10);
    const timeIn = document.getElementById("time-in")?.value || "";
    const timeOut = document.getElementById("time-out")?.value || "";
    if (!site?.id) throw new Error("Choose a valid site before saving this visit.");
    selectedOperationalFiles().forEach(({ input, file }) => validateModuleFile(type, input.id, file));
    const payload = {
      site_id: site.id,
      charger_id: chargerId || null,
      visit_date: visitDate,
      time_in: timeIn || null,
      time_out: timeOut || null,
      visited_by: document.getElementById("engineer-name")?.value.trim() || document.getElementById("technician-name")?.value.trim() || state.currentUser || "Operations Staff",
      purpose: document.getElementById("purpose")?.value.trim() || "Site visit",
      status: backendSiteVisitStatus(document.getElementById("visit-status")?.value || "Completed"),
      observations: document.getElementById("findings")?.value.trim() || document.getElementById("notes")?.value.trim() || null,
      actions_taken: document.getElementById("work-completed")?.value.trim() || null,
    };
    const existing = mode !== "create" ? state.visits.find((item) => item.id === state.currentVisitId) : null;
    const response = existing?.id
      ? await window.QatarOpsApi.SiteVisits.update(existing.id, payload)
      : await window.QatarOpsApi.SiteVisits.create(payload);
    const savedVisit = mapBackendSiteVisit(response.site_visit);
    const existingIndex = state.visits.findIndex((item) => item.id === savedVisit.id);
    if (existingIndex >= 0) state.visits.splice(existingIndex, 1, savedVisit);
    else state.visits.unshift(savedVisit);
    state.currentVisitId = savedVisit.id;
    try {
      await persistOperationalFiles("site-visits", savedVisit.id, type, existing?.attachmentRecords || []);
    } catch (error) {
      await loadOperationalData();
      throw new Error(existing
        ? `The visit changes were saved, but the replacement report failed and the existing report remains active. ${error.message}`
        : `The visit was saved, but its report upload failed. Reopen the visit to retry. ${error.message}`);
    }
    activity = {
      actionType: existing ? "site_visit_updated" : "site_visit_added",
      entityType: "site_visit",
      entityId: savedVisit.id,
      description: `${savedVisit.status} site visit ${existing ? "updated" : "added"} for ${siteName}`,
      siteName,
      chargerName,
    };
  }
  if (["document", "weeklyReport", "guide"].includes(type)) {
    const { siteName, chargerId } = getSelectedCharger();
    const site = getSite(siteName);
    const apiType = type === "document" ? "documents" : type === "weeklyReport" ? "weekly-reports" : "troubleshooting";
    const payload = type === "document" ? {
      site_id: site?.id || null, charger_id: chargerId || null, title: document.getElementById("document-title")?.value.trim() || "Document",
      document_type: document.getElementById("document-category")?.value || "Other", document_date: document.getElementById("document-date")?.value || new Date().toISOString().slice(0,10),
      description: document.getElementById("description")?.value.trim() || null,
    } : type === "weeklyReport" ? {
      site_id: site?.id || null, title: document.getElementById("report-title")?.value.trim() || "Weekly Report",
      period_start: document.getElementById("week-start")?.value, period_end: document.getElementById("week-end")?.value,
      notes: document.getElementById("summary")?.value.trim() || null,
    } : {
      site_id: site?.id || null, charger_id: chargerId || null, title: document.getElementById("guide-title")?.value.trim() || "Troubleshooting Record",
      issue_category: document.getElementById("category")?.value || "Other", symptoms: document.getElementById("symptoms")?.value.trim() || null,
      possible_cause: document.getElementById("possible-cause")?.value.trim() || null, troubleshooting_steps: document.getElementById("troubleshooting-steps")?.value.trim() || null,
      resolution: document.getElementById("resolution")?.value.trim() || null, notes: document.getElementById("notes")?.value.trim() || null,
    };
    const legacyId = mode !== "create" ? state.currentLegacyContentId : "";
    if (legacyId) {
      if (selectedOperationalFiles().length) throw new Error("This early-testing record has no backend parent. Save metadata without selecting a replacement file, or re-upload it as a new managed record.");
      const legacy = state.uploads.find((file) => file.id === legacyId && !file.recordPersisted);
      if (!legacy) throw new Error("This record is no longer available.");
      Object.assign(legacy, {
        siteName, chargerId, chargerName: getSelectedCharger().chargerName,
        title: payload.title,
        documentType: type === "document" ? payload.document_type : legacy.documentType,
        documentDate: type === "document" ? payload.document_date : legacy.documentDate,
        description: type === "document" ? payload.description || "" : legacy.description,
        weekStart: type === "weeklyReport" ? payload.period_start : legacy.weekStart,
        weekEnd: type === "weeklyReport" ? payload.period_end : legacy.weekEnd,
        notes: type === "weeklyReport" || type === "guide" ? payload.notes || "" : legacy.notes,
        guideCategory: type === "guide" ? payload.issue_category : legacy.guideCategory,
        symptoms: type === "guide" ? payload.symptoms || "" : legacy.symptoms,
        possibleCause: type === "guide" ? payload.possible_cause || "" : legacy.possibleCause,
        troubleshootingSteps: type === "guide" ? payload.troubleshooting_steps || "" : legacy.troubleshootingSteps,
        resolution: type === "guide" ? payload.resolution || "" : legacy.resolution,
      });
      saveState();
      refreshOpenProfiles();
      return;
    }
    const existingId = mode !== "create" ? state.currentContentRecordId : "";
    const response = existingId ? await window.QatarOpsApi.ContentRecords.update(apiType, existingId, payload) : await window.QatarOpsApi.ContentRecords.create(apiType, payload);
    const recordId = response.record.id;
    const existingFile = state.uploads.find((file) => file.recordId === recordId && file.persisted);
    const selected = selectedOperationalFiles();
    if (selected[0]) {
      validateModuleFile(type, selected[0].input.id, selected[0].file);
      try {
        if (existingFile) await window.QatarOpsApi.Attachments.replace(existingFile.id, selected[0].file);
        else await window.QatarOpsApi.Attachments.upload(apiType, recordId, selected[0].file);
      } catch (error) {
        await loadOperationalData();
        throw new Error(existingFile
          ? `The metadata was saved, but file replacement failed. The existing attachment remains active. ${error.message}`
          : `The record was saved, but the attachment upload failed. Reopen the record to retry. ${error.message}`);
      }
    }
    state.currentContentRecordId = recordId;
    await loadOperationalData();
  }
  if (type === "visitReport") {
    const currentFault = null;
    const uploads = await collectUploadedFiles(type, {
      parentId: `record-${crypto.randomUUID()}`,
      faultId: currentFault?.faultId || "",
      weeklyReportId: type === "weeklyReport" ? `weekly-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` : "",
      troubleshootingGuideId: type === "guide" ? `guide-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` : "",
    });
    if (uploads.length) {
      const legacyReplacementId = state.pendingLegacyReplacementId || "";
      if (legacyReplacementId) state.uploads = state.uploads.filter((file) => file.id !== legacyReplacementId);
      state.uploads.unshift(...uploads);
      if (currentFault) currentFault.photos = uploads.map((file) => file.id);
      state.pendingLegacyReplacementId = "";
    }
  }
  if (type === "document") {
    const { siteName, chargerName } = getSelectedCharger();
    const title = document.getElementById("document-title")?.value.trim() || "Document";
    activity = { actionType: "document_uploaded", entityType: "upload", description: `${title} uploaded for ${siteName}`, siteName, chargerName };
  }
  if (type === "weeklyReport") {
    const { siteName, chargerName } = getSelectedCharger();
    activity = { actionType: "weekly_report_uploaded", entityType: "upload", description: `Weekly report uploaded for ${siteName}`, siteName, chargerName };
  }
  if (type === "visitReport") {
    const { siteName, chargerName } = getSelectedCharger();
    const title = document.getElementById("report-title")?.value.trim() || "Site visit report";
    activity = { actionType: "visit_report_uploaded", entityType: "upload", description: `${title} uploaded for ${siteName}`, siteName, chargerName };
  }
  if (type === "guide") {
    const { siteName, chargerName } = getSelectedCharger();
    const title = document.getElementById("guide-title")?.value.trim() || "Troubleshooting guide";
    activity = { actionType: "guide_saved", entityType: "guide", description: `${title} saved for ${chargerName || siteName}`, siteName, chargerName };
  }
  if (activity) addActivity(activity);
  if (type === "siteVisit") await loadOperationalData();
  if (["siteVisit", "visitReport", "fault", "document", "weeklyReport", "guide", "charger", "site"].includes(type)) refreshOpenProfiles();
  renderCounts();
  saveState();
  renderActivity();
}
