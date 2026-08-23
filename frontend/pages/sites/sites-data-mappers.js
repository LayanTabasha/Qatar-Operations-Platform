function imagePathWithVersion(imagePath, updatedAt) {
  if (!imagePath || !imagePath.startsWith("/uploads/") || !updatedAt) return imagePath || "";
  const separator = imagePath.includes("?") ? "&" : "?";
  return `${imagePath}${separator}v=${encodeURIComponent(updatedAt)}`;
}

function statusLabel(status) {
  const labels = {
    active: "Active",
    archived: "Archived",
    maintenance: "Maintenance",
    faulted: "Faulted",
  };
  return labels[status] || valueOrPlaceholder(status);
}

function mapBackendCharger(charger) {
  const powerValue = charger.power_kw === null || charger.power_kw === undefined ? "" : Number(charger.power_kw);
  const formattedPower = Number.isFinite(powerValue) ? (Number.isInteger(powerValue) ? String(powerValue) : powerValue.toFixed(1)) : "";
  return {
    id: charger.id,
    siteId: charger.site_id,
    siteName: charger.site_name,
    name: charger.name,
    code: charger.code,
    type: charger.type,
    manufacturer: charger.manufacturer || "",
    operator: charger.operator || "",
    administrator: charger.administrator || "",
    installationDate: charger.installation_date || "",
    model: charger.model || "",
    serialNumber: charger.serial_number || "",
    capacity: formattedPower ? `${formattedPower} kW` : "",
    powerKw: charger.power_kw,
    firmwareVersion: charger.firmware_version || "",
    description: charger.description || "",
    image: charger.image_path || "",
    status: statusLabel(charger.status),
    backendStatus: charger.status,
    openFaultCount: charger.open_fault_count ?? 0,
    lastSiteVisit: charger.last_site_visit,
    createdAt: charger.created_at,
    updatedAt: charger.updated_at,
    previousStatus: statusLabel(charger.previous_status),
    archivedAt: charger.archived_at,
    archivedBy: charger.archived_by_name || "",
    restoredAt: charger.restored_at,
    restoredBy: charger.restored_by_name || "",
  };
}

function mapBackendSite(site, chargers) {
  const siteChargers = sortChargersForDisplay(
    chargers.filter((charger) => charger.siteId === site.id || charger.siteName === site.name),
  );
  return {
    id: site.id,
    name: site.name,
    code: site.code,
    location: site.location || site.address || "To Be Updated",
    address: site.address || "",
    client: site.address || "Not Available Yet",
    status: statusLabel(site.status),
    backendStatus: site.status,
    description: site.description || "",
    notes: "",
    image: imagePathWithVersion(site.image_path, site.updated_at),
    chargers: siteChargers,
    chargerCount: site.charger_count ?? siteChargers.length,
    openFaultCount: site.open_fault_count ?? 0,
    lastSiteVisit: site.last_site_visit,
    createdAt: site.created_at,
    updatedAt: site.updated_at,
  };
}

function contentIdentityValue(value = "") {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function contentRecordIdentity(file) {
  const filename = contentIdentityValue(file.originalFileName || file.fileName || file.name);
  if (filename && filename !== "uploaded file") return `${file.kind}|file|${filename}`;
  return [file.kind, "meta", file.title, file.siteName, file.chargerName, file.weekStart, file.weekEnd, file.guideCategory]
    .map(contentIdentityValue).join("|");
}

function reconcileLegacyContentUploads(backendUploads, legacyUploads) {
  const persistedIdentities = new Set(backendUploads.map(contentRecordIdentity));
  return legacyUploads.filter((file) => !persistedIdentities.has(contentRecordIdentity(file)));
}

function mapContentRecord(record, kind) {
  const attachment = record.attachments?.[0];
  const context = {
    kind, recordId: record.id, siteName: record.site_name || "", chargerId: record.charger_id || "", chargerName: record.charger_name || "",
    title: record.title, description: record.description || record.notes || "", documentType: record.document_type || "",
    weeklyReportId: kind === "weeklyReport" ? record.id : "", troubleshootingGuideId: kind === "guide" ? record.id : "",
    weekStart: record.period_start || "", weekEnd: record.period_end || "", guideCategory: record.issue_category || "",
    symptoms: record.symptoms || "", possibleCause: record.possible_cause || "", troubleshootingSteps: record.troubleshooting_steps || "",
    resolution: record.resolution || "", notes: record.notes || "", documentDate: record.document_date || "",
    uploadedBy: record.uploaded_by_name || "", uploadedAt: record.created_at, recordPersisted: true,
  };
  return attachment
    ? mapBackendAttachment(attachment, { ...context, attachmentPersisted: true })
    : normalizeUploadRecord({ ...context, id: `record-${record.id}`, name: "", persisted: false, attachmentPersisted: false });
}

function mapBackendSiteVisit(visit) {
  const attachmentRecords = deduplicateSiteVisitAttachments((visit.attachments || []).map((attachment) => mapBackendAttachment(attachment, {
    kind: "siteVisit", module: "siteVisit", category: "Site Visit Report", documentType: "site_visit_report",
    siteVisitId: visit.id, siteName: visit.site_name, chargerId: visit.charger_id, chargerName: visit.charger_name,
  })), visit.id);
  return {
    id: visit.id,
    siteId: visit.site_id,
    siteName: visit.site_name,
    chargerId: visit.charger_id || "",
    chargerName: visit.charger_name || "",
    visitDate: visit.visit_date,
    status: siteVisitStatusLabel(visit.status || (visit.follow_up_required ? "follow_up_required" : "completed")),
    backendStatus: visit.status || (visit.follow_up_required ? "follow_up_required" : "completed"),
    timeIn: visit.time_in || "",
    timeOut: visit.time_out || "",
    duration: calculateVisitDuration(visit.time_in || "", visit.time_out || ""),
    purpose: visit.purpose || "",
    notes: visit.observations || "",
    workCompleted: visit.actions_taken || "",
    attachments: attachmentRecords.map((file) => file.id),
    attachmentRecords,
    createdBy: visit.visited_by || "",
    recordedOn: visit.created_at || "",
    recordedBy: visit.recorded_by_name || "",
    lastModified: visit.updated_at || "",
    lastModifiedBy: visit.last_modified_by_name || "",
    createdAt: visit.created_at,
    updatedAt: visit.updated_at,
  };
}

function mapBackendAttachment(attachment, context = {}) {
  return normalizeUploadRecord({
    id: attachment.id, ...context, name: attachment.original_filename, fileName: attachment.original_filename,
    originalFileName: attachment.original_filename, type: attachment.mime_type, mimeType: attachment.mime_type,
    size: Number(attachment.file_size_bytes), fileSize: Number(attachment.file_size_bytes), uploadedBy: attachment.uploaded_by_name,
    uploadedAt: attachment.created_at, updatedAt: attachment.updated_at,
    extension: attachment.file_extension || extensionFromName(attachment.original_filename),
    previewAvailable: attachment.preview_available !== false,
    previewUrl: attachment.preview_url, downloadUrl: attachment.download_url, persisted: true,
  });
}

function extensionFromName(filename = "") {
  const match = String(filename).toLowerCase().match(/(\.[a-z0-9]+)$/);
  return match ? match[1] : "";
}

function deduplicateSiteVisitAttachments(files = [], parentId = "") {
  const seen = new Set();
  return files.filter((file) => {
    if (!file) return false;
    const idKey = file.id ? `id:${file.id}` : "";
    const storageKey = file.storagePath || file.storage_path || file.storedFilename || file.stored_filename;
    const fallbackKey = `file:${file.name || file.original_filename || ""}:${Number(file.size ?? file.fileSize ?? file.file_size_bytes ?? 0)}:${file.siteVisitId || parentId}`;
    const keys = [idKey, storageKey ? `storage:${storageKey}` : "", fallbackKey].filter(Boolean);
    if (keys.some((key) => seen.has(key))) return false;
    keys.forEach((key) => seen.add(key));
    return true;
  });
}

function siteVisitStatusLabel(status) {
  return {
    scheduled: "Scheduled",
    ongoing: "Ongoing",
    completed: "Completed",
    cancelled: "Cancelled",
    follow_up_required: "Follow-Up Required",
  }[status] || valueOrPlaceholder(status);
}

function backendSiteVisitStatus(status) {
  return {
    Scheduled: "scheduled",
    Ongoing: "ongoing",
    Completed: "completed",
    Cancelled: "cancelled",
    "Follow-Up Required": "follow_up_required",
  }[status] || "completed";
}
