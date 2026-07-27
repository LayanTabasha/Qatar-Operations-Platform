const IMAGE_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;
const IMAGE_UPLOAD_TYPES = ["image/jpeg", "image/png", "image/webp"];
let pendingModalImage = null;
let pendingSiteImageFile = null;
let removeExistingSiteImage = false;

function openModal(type, mode = "edit") {
  const config = modalConfigs[type];
  if (!config) return;
  if (!isAdmin() && ["user", "faultCode"].includes(type)) {
    alert("Access denied. This action requires administrator permission.");
    return;
  }
  if (!canManageOperations() && ["site", "charger", "deleteCharger"].includes(type)) {
    alert("Access denied. This action requires operations permission.");
    return;
  }
  if (state.currentUserRole === "Viewer" && ["siteVisit", "visitReport", "fault", "document", "weeklyReport", "guide", "contact", "confirmDelete"].includes(type)) {
    alert("Access denied. Viewer accounts can view, preview, and download permitted records only.");
    return;
  }
  const form = document.getElementById("modal-form");
  document.querySelector(".modal")?.classList.remove("preview-modal");
  pendingModalImage = null;
  pendingSiteImageFile = null;
  removeExistingSiteImage = false;
  document.getElementById("modal-title").textContent = config.title;
  document.getElementById("modal-eyebrow").textContent = type === "confirmDelete" ? "Confirm" : "Operational Form";
  form.dataset.type = type;
  form.dataset.mode = mode;
  form.dataset.site = state.currentSiteName || "";
  form.dataset.charger = state.currentChargerId || "";
  const deleteNote = type === "deleteCharger" ? `<p class="modal-note">This archives the current charger. Type REMOVE to confirm.</p>` : "";
  const saveLabel = type === "deleteCharger" ? "Archive Charger" : "Save";
  const saveClass = type === "deleteCharger" ? "danger-button" : "primary-button";
  form.innerHTML = `<div class="modal-error" id="modal-error"></div>${deleteNote}${config.fields.map(([label, kind], index) => fieldMarkup(label, kind, index < 2)).join("")}<div class="modal-actions"><button class="secondary-button" type="button" id="cancel-modal">Cancel</button><button class="${saveClass}" type="submit" data-loading-text="Saving...">${saveLabel}</button></div>`;
  if (mode !== "create") prefillModal(type);
  if (mode === "create" && type === "charger") setFieldValue("site", state.currentSiteName);
  document.getElementById("modal-backdrop").classList.remove("hidden");
  resetModalScroll();
}

function fieldMarkup(label, kind, required = false) {
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const requiredAttr = required && kind !== "file" ? ` data-required="true"` : "";
  if (kind === "fault-id") {
    return `<label><span>${label}</span><input id="${id}" type="text" value="${nextFaultId()}" readonly data-system-value="true" /></label>`;
  }
  if (kind === "fault-code-select" || kind === "fault-code-select-optional") {
    const activeCodes = state.faultCatalogue.filter((item) => item.active);
    const requiredCode = kind === "fault-code-select" ? requiredAttr : "";
    return `<label><span>${label}</span><select id="${id}"${requiredCode}><option value="">${activeCodes.length ? "Select a fault code" : "No official fault codes configured"}</option>${activeCodes.map((item) => `<option value="${item.id}">${item.faultCode} - ${item.faultName}</option>`).join("")}</select></label>`;
  }
  if (kind === "fault-code-details") {
    return `<div class="full fault-code-details" id="fault-code-details"><span>Fault Name</span><strong>Not selected</strong><span>Meaning</span><p>Select an official fault code to show its meaning.</p><span>Severity</span><strong>Not selected</strong><span>Recommended Action</span><p>Not Available Yet</p></div>`;
  }
  if (kind.startsWith("select:")) {
    const siteLabels = ["Site", "Related site"];
    const options = siteLabels.includes(label)
      ? state.sites.map((site) => site.name)
      : kind.replace("select:", "").split(",");
    return `<label><span>${label}</span><select id="${id}"${requiredAttr}>${options.map((item) => `<option>${item}</option>`).join("")}</select></label>`;
  }
  if (kind === "charger-select") return chargerSelectMarkup(label, id, requiredAttr);
  if (kind === "textarea") return `<label class="full"><span>${label}</span><textarea id="${id}" rows="3"${requiredAttr}></textarea></label>`;
  if (kind === "image-file") return `<label class="full"><span>${label}</span><input id="${id}" type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" multiple${requiredAttr} /><small>JPG, PNG, or WebP only. Photos appear inside the fault record.</small></label>`;
  if (kind === "file" && label === "Upload site image") {
    return `<label class="full image-upload-field"><span>${label}</span><input id="${id}" type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"${requiredAttr} /><div class="image-upload-preview" id="site-image-preview"><span>No image selected</span></div><div class="quick-actions compact image-upload-actions"><button class="secondary-button" id="replace-site-image" type="button">Replace Image</button><button class="danger-button" id="remove-site-image" type="button">Remove Selected Image</button></div><small>JPG, PNG, or WebP. Maximum 5 MB. The image is previewed before upload and saved after the site details are saved.</small></label>`;
  }
  return `<label><span>${label}</span><input id="${id}" type="${kind}"${requiredAttr} /></label>`;
}

function nextFaultId() {
  const year = new Date().getFullYear();
  const maxForYear = state.faults
    .map((fault) => fault.faultId || "")
    .filter((id) => id.startsWith(`FLT-${year}-`))
    .map((id) => Number(id.split("-").pop()))
    .filter((number) => Number.isFinite(number))
    .reduce((max, number) => Math.max(max, number), 0);
  return `FLT-${year}-${String(maxForYear + 1).padStart(4, "0")}`;
}

function selectedFaultCatalogueItem(selectId = "fault-code") {
  const selectedId = document.getElementById(selectId)?.value || "";
  return state.faultCatalogue.find((item) => item.id === selectedId);
}

function renderFaultCodeDetails(selectId = "fault-code") {
  const panel = document.getElementById("fault-code-details");
  if (!panel) return;
  const item = selectedFaultCatalogueItem(selectId);
  panel.innerHTML = item
    ? `<span>Fault Name</span><strong>${valueOrPlaceholder(item.faultName)}</strong><span>Meaning</span><p>${valueOrPlaceholder(item.meaning)}</p><span>Severity</span><strong>${valueOrPlaceholder(item.severity)}</strong><span>Recommended Action</span><p>${valueOrPlaceholder(item.recommendedAction)}</p>`
    : `<span>Fault Name</span><strong>Not selected</strong><span>Meaning</span><p>Select an official fault code to show its meaning.</p><span>Severity</span><strong>Not selected</strong><span>Recommended Action</span><p>Not Available Yet</p>`;
}

function chargerSelectMarkup(label, id, requiredAttr = "") {
  const siteName = document.getElementById("site")?.value || document.getElementById("related-site")?.value || state.currentSiteName || state.sites[0]?.name;
  const chargers = getSite(siteName)?.chargers || [];
  if (!chargers.length) {
    return `<label><span>${label}</span><select id="${id}" disabled${requiredAttr}><option value="">No chargers are available for this site</option></select></label>`;
  }
  return `<label><span>${label}</span><select id="${id}"${requiredAttr}><option value="">Select a charger</option>${chargers.map((charger) => `<option value="${charger.id}">${valueOrPlaceholder(charger.name)}</option>`).join("")}</select></label>`;
}

function refreshChargerSelect() {
  const chargerField = document.getElementById("charger");
  if (!chargerField) return;
  const siteName = document.getElementById("site")?.value || document.getElementById("related-site")?.value || state.currentSiteName || state.sites[0]?.name;
  const chargers = getSite(siteName)?.chargers || [];
  chargerField.innerHTML = chargers.length
    ? `<option value="">Select a charger</option>${chargers.map((charger) => `<option value="${charger.id}">${valueOrPlaceholder(charger.name)}</option>`).join("")}`
    : `<option value="">No chargers are available for this site</option>`;
  chargerField.disabled = !chargers.length;
  if (chargers.some((charger) => charger.id === state.currentChargerId)) chargerField.value = state.currentChargerId;
}

function closeModal() {
  document.getElementById("modal-backdrop").classList.add("hidden");
  document.querySelector(".modal")?.classList.remove("preview-modal");
  activePreview = { fileId: "", zoom: 1, rotation: 0, mode: "fit-screen" };
  pendingModalImage = null;
  pendingSiteImageFile = null;
  removeExistingSiteImage = false;
  document.querySelector(".modal")?.scrollTo(0, 0);
}

function resetModalScroll() {
  const modal = document.querySelector(".modal");
  modal?.scrollTo({ top: 0, left: 0, behavior: "auto" });
  document.getElementById("modal-form")?.scrollTo?.({ top: 0, left: 0, behavior: "auto" });
}

function setFieldValue(id, value) {
  const field = document.getElementById(id);
  if (field && value) field.value = value;
}

function prefillModal(type) {
  if (type === "site") {
    const site = getSite();
    setFieldValue("site-name", site?.name);
    setFieldValue("location", site?.location !== "To Be Updated" ? site?.location : "");
    setFieldValue("client-organization", site?.client !== "Not Available Yet" ? site?.client : "");
    setFieldValue("status", site?.status);
    setFieldValue("description", site?.description);
    setFieldValue("notes", site?.notes);
    renderSiteImagePreview(site?.image, site?.name || "Site Image");
  }
  if (type === "charger") {
    const charger = getCharger();
    setFieldValue("charger-name", charger?.name);
    setFieldValue("charger-type", charger?.type);
    setFieldValue("site", state.currentSiteName);
    setFieldValue("operator", charger?.operator);
    setFieldValue("administrator", charger?.administrator);
    setFieldValue("manufacturer", charger?.manufacturer);
    setFieldValue("model", charger?.model);
    setFieldValue("serial-number", charger?.serialNumber);
    setFieldValue("capacity", charger?.capacity);
    setFieldValue("installation-date", charger?.installationDate);
    setFieldValue("status", charger?.status);
    setFieldValue("notes", charger?.notes);
  }
  if (["siteVisit", "visitReport", "fault", "document", "weeklyReport", "guide"].includes(type)) {
    setFieldValue("site", state.currentSiteName);
    setFieldValue("related-site", state.currentSiteName);
    setFieldValue("charger", state.currentChargerId);
  }
}

function renderSiteImagePreview(image, label = "Site Image") {
  const preview = document.getElementById("site-image-preview");
  if (!preview) return;
  const imageSource = typeof image === "object" ? image?.display || image?.original : image;
  const resolvedImageSource = typeof apiAssetUrl === "function" ? apiAssetUrl(imageSource) : imageSource;
  preview.innerHTML = imageSource
    ? `<img src="${resolvedImageSource}" alt="${label}" />`
    : `<span>No image selected</span>`;
}

function validateImageFile(file) {
  if (!file) return "Choose an image file first.";
  if (!IMAGE_UPLOAD_TYPES.includes(file.type)) return "Site cover image must be JPG, PNG, or WebP.";
  if (file.size > IMAGE_UPLOAD_MAX_BYTES) return "Site cover image must be 5 MB or smaller.";
  return "";
}

function loadImageFromDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to load image."));
    image.src = dataUrl;
  });
}

async function readAndOptimizeSiteImage(file) {
  const error = validateImageFile(file);
  if (error) throw new Error(error);
  const original = await readFileAsDataUrl("upload-site-image");
  const image = await loadImageFromDataUrl(original);
  const targetWidth = 1280;
  const targetHeight = 720;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  context.fillStyle = "#081827";
  context.fillRect(0, 0, targetWidth, targetHeight);

  const isSmall = image.naturalWidth < 640 || image.naturalHeight < 360;
  const scale = isSmall
    ? Math.min(targetWidth / image.naturalWidth, targetHeight / image.naturalHeight)
    : Math.max(targetWidth / image.naturalWidth, targetHeight / image.naturalHeight);
  const drawWidth = Math.round(image.naturalWidth * scale);
  const drawHeight = Math.round(image.naturalHeight * scale);
  const drawX = Math.round((targetWidth - drawWidth) / 2);
  const drawY = Math.round((targetHeight - drawHeight) / 2);
  context.drawImage(image, drawX, drawY, drawWidth, drawHeight);

  return {
    original,
    display: canvas.toDataURL("image/webp", 0.82),
    name: file.name,
    type: file.type,
    size: file.size,
    width: image.naturalWidth,
    height: image.naturalHeight,
    displayWidth: targetWidth,
    displayHeight: targetHeight,
    optimizedAt: new Date().toISOString(),
  };
}

async function handleSiteImageSelection() {
  const input = document.getElementById("upload-site-image");
  const file = input?.files?.[0];
  const errorBox = document.getElementById("modal-error");
  if (errorBox) errorBox.textContent = "";
  if (!file) return;
  try {
    pendingModalImage = await readAndOptimizeSiteImage(file);
    pendingSiteImageFile = file;
    removeExistingSiteImage = false;
    renderSiteImagePreview(pendingModalImage, pendingModalImage.name);
  } catch (error) {
    pendingModalImage = null;
    pendingSiteImageFile = null;
    if (input) input.value = "";
    if (errorBox) errorBox.textContent = error.message;
    renderSiteImagePreview(null);
  }
}

function removeSiteImageSelection() {
  pendingModalImage = null;
  pendingSiteImageFile = null;
  removeExistingSiteImage = false;
  const input = document.getElementById("upload-site-image");
  if (input) input.value = "";
  renderSiteImagePreview(null);
}

function readFileAsDataUrl(fileInputId) {
  const input = document.getElementById(fileInputId);
  const file = input?.files?.[0];
  if (!file) return Promise.resolve("");
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result || "");
    reader.onerror = () => resolve("");
    reader.readAsDataURL(file);
  });
}

function readSingleFileAsDataUrl(file) {
  if (!file) return Promise.resolve("");
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result || "");
    reader.onerror = () => resolve("");
    reader.readAsDataURL(file);
  });
}

function getSelectedCharger() {
  const chargerId = document.getElementById("charger")?.value || state.currentChargerId || "";
  const siteName = document.getElementById("site")?.value || document.getElementById("related-site")?.value || state.currentSiteName || "";
  const charger = getCharger(siteName, chargerId);
  return { siteName, chargerId, chargerName: charger?.name || "" };
}

async function collectUploadedFiles(type, relationships = {}) {
  const fileInputs = Array.from(document.querySelectorAll("#modal-form input[type='file']")).filter((input) => input.files?.length && input.id !== "upload-site-image" && input.id !== "upload-charger-image");
  const { siteName, chargerId, chargerName } = getSelectedCharger();
  const records = [];
  for (const input of fileInputs) {
    for (const file of Array.from(input.files)) {
      validateModuleFile(type, input.id, file);
      const dataUrl = await readSingleFileAsDataUrl(file);
      if (!dataUrl) throw new Error("The selected file could not be saved. Please choose the file again and retry.");
      const moduleName = moduleNameForUpload(type);
      const category = uploadCategoryForType(type, input.id);
      records.push({
        id: `file-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        kind: type,
        module: moduleName,
        category,
        siteVisitId: relationships.siteVisitId || "",
        faultId: relationships.faultId || "",
        weeklyReportId: relationships.weeklyReportId || "",
        troubleshootingGuideId: relationships.troubleshootingGuideId || "",
        siteName,
        chargerId,
        chargerName,
        name: file.name,
        fileName: file.name,
        originalFileName: file.name,
        title: document.getElementById("document-title")?.value.trim() || document.getElementById("report-title")?.value.trim() || document.getElementById("guide-title")?.value.trim() || file.name,
        documentType: documentTypeForNewUpload(type, input.id),
        weekStart: document.getElementById("week-start")?.value || "",
        weekEnd: document.getElementById("week-end")?.value || "",
        guideCategory: document.getElementById("category")?.value || "",
        guideVersion: document.getElementById("version")?.value.trim() || "",
        faultCatalogueId: document.getElementById("relevant-fault-code")?.value || "",
        description: document.getElementById("description")?.value.trim() || "",
        type: file.type || "application/octet-stream",
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        fileSize: file.size,
        uploadedBy: state.currentUser,
        uploadedAt: new Date().toISOString(),
        storagePath: `prototype-storage/${siteName || "unassigned"}/${relationships.siteVisitId || relationships.faultId || relationships.weeklyReportId || relationships.troubleshootingGuideId || "general"}/${file.name}`,
        dataUrl,
      });
    }
  }
  return records;
}

function uploadCategoryForType(type, inputId = "") {
  if (type === "siteVisit" && inputId === "site-visit-report-upload") return "Site Visit Report";
  if (type === "visitReport") return "Site Visit Report";
  if (type === "weeklyReport") return "Weekly Report";
  if (type === "fault") return "Fault Photo";
  if (type === "guide") return "Troubleshooting Guide";
  if (type === "document") return "Charger Document";
  return "Needs Classification";
}

function documentTypeForNewUpload(type, inputId = "") {
  if (type === "siteVisit" && inputId === "site-visit-report-upload") return "site_visit_report";
  if (type === "visitReport") return "site_visit_report";
  if (type === "fault") return "fault_photo";
  if (type === "weeklyReport") return "weekly_report";
  if (type === "guide") return "troubleshooting_guide";
  if (type === "document") return document.getElementById("document-category")?.value || "charger_document";
  return "needs_classification";
}

function moduleNameForUpload(type) {
  if (type === "siteVisit" || type === "visitReport") return "siteVisit";
  if (type === "fault") return "fault";
  if (type === "weeklyReport") return "weeklyReport";
  if (type === "guide") return "troubleshooting";
  if (type === "document") return "chargerDocument";
  return "needsClassification";
}

function validateModuleFile(type, inputId, file) {
  const imageTypes = ["image/jpeg", "image/png", "image/webp"];
  const maxImageBytes = 5 * 1024 * 1024;
  if (type === "fault") {
    if (!imageTypes.includes(file.type)) throw new Error("Fault evidence must be JPG, PNG, or WebP photos only.");
    if (file.size > maxImageBytes) throw new Error("Fault photos must be 5 MB or smaller.");
  }
}

function calculateVisitDuration(timeIn, timeOut) {
  if (!timeIn || !timeOut || timeOut < timeIn) return "";
  const [inHours, inMinutes] = timeIn.split(":").map(Number);
  const [outHours, outMinutes] = timeOut.split(":").map(Number);
  const totalMinutes = (outHours * 60 + outMinutes) - (inHours * 60 + inMinutes);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (!hours) return `${minutes}m`;
  if (!minutes) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

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
      button.classList.remove("is-loading");
      button.textContent = "Saved";
      setTimeout(closeModal, 300);
    } catch (error) {
      console.error("Save failed", error);
      document.getElementById("modal-error").textContent = error.message || "The record could not be saved.";
      button.classList.remove("is-loading");
      button.disabled = false;
      button.textContent = "Save";
    }
  }, 350);
}

function validateVisitTimes() {
  const error = document.getElementById("modal-error");
  if (error) error.textContent = "";
  const timeIn = document.getElementById("time-in")?.value || "";
  const timeOut = document.getElementById("time-out")?.value || "";
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
        ? await SitesApi.update(existing.id, payload)
        : await SitesApi.create(payload);
      if (backendSiteStatus(status) !== (response.site?.status || "active")) {
        await SitesApi.updateStatus(response.site.id, backendSiteStatus(status));
      }
      if (pendingSiteImageFile) {
        try {
          const imageResponse = await SitesApi.uploadImage(response.site.id, pendingSiteImageFile);
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
  if (type === "charger") {
    const siteName = document.getElementById("site")?.value || state.currentSiteName || state.sites[0]?.name;
    const site = getSite(siteName);
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
      model: document.getElementById("model")?.value.trim() || null,
      serial_number: document.getElementById("serial-number")?.value.trim() || null,
      type: chargerType,
      power_kw: parsePowerKw(document.getElementById("capacity")?.value),
      firmware_version: null,
      description: document.getElementById("notes")?.value.trim() || null,
    };
    try {
      const response = existing?.id
        ? await ChargersApi.update(existing.id, payload)
        : await ChargersApi.create(payload);
      const requestedStatus = backendChargerStatus(document.getElementById("status")?.value);
      if (requestedStatus !== (response.charger?.status || "active")) {
        await ChargersApi.updateStatus(response.charger.id, requestedStatus);
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
      await ChargersApi.updateStatus(chargerId, "archived");
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
    const role = document.getElementById("role")?.value;
    const department = document.getElementById("department")?.value || "Operations";
    const status = document.getElementById("account-status")?.value;
    const temporaryPassword = document.getElementById("temporary-password")?.value.trim();
    const mustChangePassword = document.getElementById("require-password-change-on-first-login")?.value === "Yes";
    if (!fullName || !email || !temporaryPassword || state.users.some((user) => user.email.toLowerCase() === email)) {
      throw new Error("Enter a unique email and temporary password.");
    }
    state.users.push({
      id: `user-${Date.now()}`,
      name: fullName,
      email,
      role,
      department,
      status,
      mustChangePassword,
      lastLogin: "Not Available Yet",
      lastPasswordChange: "Not Available Yet",
      createdAt: new Date().toISOString().slice(0, 10),
      createdBy: state.currentUser,
    });
    saveUsers();
    renderSettings("User Management");
    activity = { actionType: "user_created", entityType: "user", entityId: email, description: `${fullName} user account created` };
  }
  if (type === "faultCode") {
    if (!isAdmin()) return;
    const faultCode = document.getElementById("fault-code")?.value.trim();
    const faultName = document.getElementById("fault-name")?.value.trim();
    if (!faultCode || !faultName || state.faultCatalogue.some((item) => item.faultCode.toLowerCase() === faultCode.toLowerCase())) {
      throw new Error("Enter a unique fault code and fault name.");
    }
    const entry = normalizeFaultCatalogueRecord({
      faultCode,
      faultName,
      meaning: document.getElementById("meaning")?.value.trim() || "",
      severity: document.getElementById("severity")?.value || "Not Classified",
      recommendedAction: document.getElementById("recommended-action")?.value.trim() || "",
      active: document.getElementById("status")?.value !== "Disabled",
    });
    state.faultCatalogue.push(entry);
    renderSettings("Fault Catalogue");
    activity = { actionType: "fault_catalogue_added", entityType: "fault_catalogue", entityId: entry.id, description: `${entry.faultCode} added to Fault Catalogue` };
  }
  if (type === "fault") {
    const { siteName, chargerId, chargerName } = getSelectedCharger();
    const catalogueItem = selectedFaultCatalogueItem("fault-code");
    const status = document.getElementById("fault-status")?.value || "Open";
    const reportedDate = document.getElementById("date-reported")?.value || new Date().toISOString().slice(0, 10);
    const reportedTime = document.getElementById("time-reported")?.value || new Date().toTimeString().slice(0, 5);
    const fault = {
      id: `fault-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      faultId: document.getElementById("generated-fault-id")?.value || nextFaultId(),
      faultCatalogueId: catalogueItem?.id || "",
      faultCode: catalogueItem?.faultCode || "",
      faultName: catalogueItem?.faultName || "Official fault code not selected",
      faultDescription: catalogueItem?.meaning || "",
      severity: catalogueItem?.severity || "Not Classified",
      recommendedAction: catalogueItem?.recommendedAction || "",
      siteName,
      chargerId,
      chargerName,
      status,
      description: document.getElementById("description")?.value.trim() || "",
      comments: document.getElementById("comments")?.value.trim() || "",
      photos: [],
      reportedBy: state.currentUser,
      reportedDate,
      reportedTime,
      reportedAt: new Date(`${reportedDate}T${reportedTime}`).toISOString(),
      createdAt: new Date().toISOString(),
    };
    state.faults.unshift(fault);
    activity = {
      actionType: "fault_reported",
      entityType: "fault",
      entityId: fault.faultId,
      description: `${fault.faultId} reported for ${chargerName || "selected charger"} at ${siteName}`,
      siteName,
      chargerName,
    };
  }
  if (type === "siteVisit") {
    const { siteName, chargerId, chargerName } = getSelectedCharger();
    const visitDate = document.getElementById("date")?.value || new Date().toISOString().slice(0, 10);
    const timeIn = document.getElementById("time-in")?.value || "";
    const timeOut = document.getElementById("time-out")?.value || "";
    const visit = {
      id: `visit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      siteName,
      chargerId,
      chargerName,
      visitDate,
      status: document.getElementById("visit-status")?.value || "Scheduled",
      timeIn,
      timeOut,
      duration: calculateVisitDuration(timeIn, timeOut),
      purpose: document.getElementById("purpose")?.value.trim() || "",
      notes: document.getElementById("notes")?.value.trim() || "",
      attachments: [],
      createdBy: state.currentUser,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    state.visits.unshift(visit);
    activity = {
      actionType: "site_visit_added",
      entityType: "site_visit",
      entityId: visit.id,
      description: `${visit.status} site visit added for ${siteName}`,
      siteName,
      chargerName,
    };
  }
  if (["siteVisit", "visitReport", "fault", "document", "weeklyReport", "guide"].includes(type)) {
    const currentVisit = type === "siteVisit" ? state.visits[0] : null;
    const currentFault = type === "fault" ? state.faults[0] : null;
    const weeklyReportId = type === "weeklyReport" ? `weekly-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` : "";
    const troubleshootingGuideId = type === "guide" ? `guide-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` : "";
    try {
      const uploads = await collectUploadedFiles(type, {
        siteVisitId: currentVisit?.id || "",
        faultId: currentFault?.faultId || "",
        weeklyReportId,
        troubleshootingGuideId,
      });
      if (uploads.length) {
        state.uploads.unshift(...uploads);
        if (currentVisit) currentVisit.attachments = uploads.map((file) => file.id);
        if (currentFault) currentFault.photos = uploads.map((file) => file.id);
        refreshOpenProfiles();
      }
    } catch (error) {
      if (type === "siteVisit" && currentVisit) {
        addActivity({
          actionType: "site_visit_added",
          entityType: "site_visit",
          entityId: currentVisit.id,
          description: `${currentVisit.status} site visit added for ${currentVisit.siteName}; report upload failed`,
          siteName: currentVisit.siteName,
          chargerName: currentVisit.chargerName,
        });
        renderCounts();
        refreshOpenProfiles();
        saveState();
        renderActivity();
        throw new Error("The site visit was saved, but the report upload failed. Reopen the visit and upload the report again.");
      }
      throw error;
    }
  }
  if (type === "document") {
    const { siteName, chargerName } = getSelectedCharger();
    const title = document.getElementById("document-name")?.value.trim() || "Document";
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
    const title = document.getElementById("title")?.value.trim() || "Troubleshooting guide";
    activity = { actionType: "guide_saved", entityType: "guide", description: `${title} saved for ${chargerName || siteName}`, siteName, chargerName };
  }
  if (activity) addActivity(activity);
  if (["siteVisit", "visitReport", "fault", "document", "weeklyReport", "guide", "charger", "site"].includes(type)) refreshOpenProfiles();
  renderCounts();
  saveState();
  renderActivity();
}
