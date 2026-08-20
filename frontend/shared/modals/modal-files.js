const IMAGE_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;
const IMAGE_UPLOAD_TYPES = ["image/jpeg", "image/png", "image/webp"];
let pendingModalImage = null;
let pendingSiteImageFile = null;
let removeExistingSiteImage = false;
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
  const form = document.getElementById("modal-form");
  const siteLocked = form?.dataset.lockSite === "true" || form?.dataset.lockLocation === "true";
  const chargerLocked = form?.dataset.lockLocation === "true";
  const siteSelection = siteLocked ? form.dataset.siteId : (document.getElementById("site")?.value || document.getElementById("related-site")?.value || "");
  const site = siteFromFaultSelection(siteSelection);
  const chargerId = chargerLocked ? form.dataset.chargerId : (document.getElementById("charger")?.value || "");
  const charger = site?.chargers?.find((item) => item.id === chargerId);
  return { site, siteName: site?.name || "", chargerId, chargerName: charger?.name || "", charger };
}

async function collectUploadedFiles(type, relationships = {}) {
  const fileInputs = Array.from(document.querySelectorAll("#modal-form input[type='file']")).filter((input) => input.files?.length && input.id !== "upload-site-image" && input.id !== "upload-charger-image");
  const { siteName, chargerId, chargerName } = getSelectedCharger();
  const records = [];
  for (const input of fileInputs) {
    for (const file of Array.from(input.files)) {
      validateModuleFile(type, input.id, file);
      const moduleName = moduleNameForUpload(type);
      const category = uploadCategoryForType(type, input.id);
      const parentType = { document: "documents", fault: "faults", guide: "troubleshooting" }[type];
      const parentId = relationships.parentId || relationships.faultId || relationships.troubleshootingGuideId || `record-${crypto.randomUUID()}`;
      const common = {
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
      };
      if (parentType) {
        const response = await window.QatarOpsApi.Attachments.upload(parentType, parentId, file);
        records.push(mapBackendAttachment(response.attachment, common));
      } else {
        const dataUrl = await readSingleFileAsDataUrl(file);
        if (!dataUrl) throw new Error("The selected file could not be saved. Please choose the file again and retry.");
        records.push(normalizeUploadRecord({ ...common, id: `file-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, dataUrl }));
      }
    }
  }
  return records;
}

function selectedOperationalFiles() {
  return Array.from(document.querySelectorAll("#modal-form input[type='file']"))
    .filter((input) => !["upload-site-image", "upload-charger-image"].includes(input.id))
    .flatMap((input) => Array.from(input.files || []).map((file) => ({ input, file })));
}

async function persistOperationalFiles(parentType, parentId, type, existingAttachments = []) {
  const selected = selectedOperationalFiles();
  const saved = [];
  for (let index = 0; index < selected.length; index += 1) {
    const { input, file } = selected[index];
    validateModuleFile(type, input.id, file);
    const response = index === 0 && existingAttachments[0]
      ? await window.QatarOpsApi.Attachments.replace(existingAttachments[0].id, file)
      : await window.QatarOpsApi.Attachments.upload(parentType, parentId, file);
    saved.push(response.attachment);
  }
  return saved;
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
  if (type === "fault") {
    if (!IMAGE_UPLOAD_TYPES.includes(file.type)) throw new Error("Fault evidence must be JPG, PNG, or WebP.");
    if (file.size > IMAGE_UPLOAD_MAX_BYTES) throw new Error("Fault evidence must be 5 MB or smaller.");
    return;
  }
  if (!/\.(pdf|doc|docx|xls|xlsx|ppt|pptx|jpe?g|png|webp|gif|txt|csv)$/i.test(file.name)) throw new Error("Supported files are PDF, Office documents, images, TXT, and CSV.");
  if (!file.size) throw new Error("Empty files cannot be uploaded.");
  if (file.size > 25 * 1024 * 1024) throw new Error("Files must be 25 MB or smaller.");
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
