const sites = ["Musheireb", "Mowasalat", "Al Mana"];
const routes = ["home", "sites", "requests", "contacts", "settings"];
const STORAGE_KEY = "zeeda-qatar-ops-state";
const USERS_KEY = "zeeda-qatar-ops-users";
const VIEW_CONTEXT_KEY = "zeeda-qatar-ops-view-context";

const chargerNameCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
const FAULT_STATUS_OPTIONS = Object.freeze(["Open", "In Progress", "Resolved"]);

function chargerTypeForDisplay(charger = {}) {
  const explicitType = String(charger.type || "").trim().toUpperCase();
  if (explicitType === "AC" || explicitType === "DC") return explicitType;
  const nameType = String(charger.name || "").match(/(?:^|\s)(AC|DC)(?=\s|$)/i);
  return nameType ? nameType[1].toUpperCase() : "";
}

function chargerTypeDisplayRank(charger) {
  const type = chargerTypeForDisplay(charger);
  if (type === "AC") return 0;
  if (type === "DC") return 1;
  return 2;
}

function compareChargersForDisplay(a = {}, b = {}) {
  const siteCompare = chargerNameCollator.compare(String(a.siteName || ""), String(b.siteName || ""));
  if (siteCompare !== 0) return siteCompare;

  const typeCompare = chargerTypeDisplayRank(a) - chargerTypeDisplayRank(b);
  if (typeCompare !== 0) return typeCompare;

  const nameCompare = chargerNameCollator.compare(String(a.name || ""), String(b.name || ""));
  if (nameCompare !== 0) return nameCompare;

  const codeCompare = chargerNameCollator.compare(String(a.code || ""), String(b.code || ""));
  return codeCompare || 0;
}

function sortChargersForDisplay(chargers = []) {
  return [...chargers].sort(compareChargersForDisplay);
}

const state = {
  authenticated: false,
  authUser: null,
  currentUser: "",
  currentUserEmail: "",
  currentUserRole: "",
  currentUserRoleKey: "",
  mustChangePassword: false,
  users: [],
  currentSiteName: "",
  currentChargerId: "",
  currentVisitId: "",
  currentFaultId: "",
  pendingLegacyReplacementId: "",
  currentContentRecordId: "",
  currentLegacyContentId: "",
  currentContactId: "",
  currentSiteTab: "Overview",
  currentChargerTab: "Overview",
  backendLoading: false,
  backendError: "",
  sites: sites.map((name) => ({ name, location: "To Be Updated", status: "Pending Data", client: "Not Available Yet", notes: "", image: "", chargers: [] })),
  dashboardChargers: [],
  archive: { tab: "sites", sites: [], chargers: [], loading: false, error: "", search: "", feedback: "" },
  uploads: [],
  faults: [],
  visits: [],
  requests: [],
  contacts: [],
  homepageRequestsLoading: false,
  homepageRequestsError: "",
  requestUsers: [],
  faultCatalogue: [],
  counts: { faults: null, visits: null, chargers: null },
  recent: [],
};

window.QatarOpsRequests = Object.freeze({
  statuses: Object.freeze([
    Object.freeze({ value: "open", label: "Open", color: "#4f8dff" }),
    Object.freeze({ value: "in_progress", label: "In Progress", color: "#dca94b" }),
    Object.freeze({ value: "completed", label: "Completed", color: "#37c985" }),
  ]),
  canAccess() {
    return ["admin", "hq_user"].includes(normalizedRoleKey(state.currentUserRoleKey || state.currentUserRole));
  },
});

const modalConfigs = {
  site: { title: "Site Details", fields: [["Site name", "text"], ["Location", "text"], ["Client / organization", "text"], ["Status", "select:Active"], ["Description", "textarea"], ["Notes", "textarea"], ["Upload site image", "file"]] },
  charger: { title: "Charger Details", fields: [["Charger name", "text"], ["Charger type", "select:AC,DC"], ["Site", "select:Musheireb,Mowasalat,Al Mana"], ["Operator", "text"], ["Administrator", "text"], ["Manufacturer", "text"], ["Model", "text"], ["Serial number", "text"], ["Capacity", "text"], ["Installation date", "date"], ["Status", "select:Active,Maintenance,Faulted"], ["Notes", "textarea"], ["Upload charger image", "file"]] },
  siteVisit: { title: "Add Site Visit", fields: [["Site", "select:Musheireb,Mowasalat,Al Mana"], ["Charger", "charger-select"], ["Visit date", "date"], ["Visit status", "select:Scheduled,Ongoing,Completed,Cancelled,Follow-Up Required"], ["Time in", "time"], ["Time out", "time"], ["Visit type", "text"], ["Engineer name", "text"], ["Technician name", "text"], ["Purpose", "textarea"], ["Work completed", "textarea"], ["Findings", "textarea"], ["Notes", "textarea"], ["Site Visit Report upload", "file"]] },
  visitReport: { title: "Upload Site Visit Report", fields: [["Site", "select:Musheireb,Mowasalat,Al Mana"], ["Charger", "charger-select"], ["Visit date", "date"], ["Report title", "text"], ["File upload", "file"], ["Notes", "textarea"]] },
  fault: { title: "Report Fault", fields: [["Site", "select:Musheireb,Mowasalat,Al Mana"], ["Charger", "charger-select"], ["Generated Fault ID", "fault-id"], ["DTC Catalogue", "fault-catalogue-search"], ["DTC code", "text"], ["FTB code", "text"], ["Component ECU", "text"], ["Fault title", "text"], ["Catalogue description", "textarea"], ["Possible causes", "textarea"], ["Recommended actions", "textarea"], ["Severity", "text"], ["Category", "text"], ["Fault status", "select:Open,In Progress,Resolved"], ["Date reported", "date"], ["Time reported", "time"], ["Description", "textarea"], ["Photo evidence", "image-file"], ["Comments", "textarea"]] },
  document: { title: "Document", fields: [["Related site", "select:Musheireb,Mowasalat,Al Mana"], ["Charger", "charger-select"], ["Document title", "text"], ["Document category", "select:Specification,Warranty,Installation,Commissioning,Electrical Drawing,Certificate,Manual,Asset Record,Inspection Certificate,Other"], ["Document date", "date"], ["Description", "textarea"], ["File upload", "file"]] },
  weeklyReport: { title: "Upload Weekly Report", fields: [["Site", "select:Musheireb,Mowasalat,Al Mana"], ["Week start", "date"], ["Week end", "date"], ["Report title", "text"], ["Summary", "textarea"], ["File upload", "file"]] },
  guide: { title: "Troubleshooting Record", fields: [["Site", "select:Musheireb,Mowasalat,Al Mana"], ["Charger", "charger-select"], ["Guide title", "text"], ["Category", "select:Reset Procedure,Replacement Guide,Error-Code Troubleshooting,Communication Failure,Preventive Maintenance,Manufacturer Repair,Other"], ["Symptoms", "textarea"], ["Possible cause", "textarea"], ["Troubleshooting steps", "textarea"], ["Resolution", "textarea"], ["Notes", "textarea"], ["File upload", "file"]] },
  contact: { title: "Contact", fields: [["Name", "text"], ["Role", "text"], ["Organization / Department", "text"], ["Phone", "tel"], ["Email", "email"], ["Assigned Site", "select:Not site-specific"], ["Notes", "textarea"]] },
  profile: { title: "Profile", fields: [["Name", "text"], ["Department", "text"]] },
  user: { title: "Add User", fields: [["Full Name", "text"], ["Work Email", "email"], ["Role", "select:Operations Staff,Viewer,Administrator"], ["Department", "select:Operations,Maintenance,Administration,Management"], ["Account Status", "select:Active,Invited,Disabled,Locked"], ["Temporary Password", "text"], ["Require Password Change on First Login", "select:Yes,No"]] },
  faultCode: { title: "Fault Catalogue Entry", fields: [["Fault code", "text"], ["Fault name", "text"], ["Meaning", "textarea"], ["Severity", "select:Low,Medium,High,Critical,Not Classified"], ["Recommended action", "textarea"], ["Status", "select:Active,Disabled"]] },
  deleteCharger: { title: "Remove Charger", fields: [["Type REMOVE to confirm", "text"]] },
  confirmDelete: { title: "Delete Record", fields: [["Confirmation notes", "textarea"]] },
};

const personalSettingsItems = ["Profile", "Security"];
const administrationSettingsItems = ["User Management", "Site & Charger Configuration", "Archive", "Audit Logs"];
const systemSettingsItems = ["Platform Health"];
const settingsItems = [...personalSettingsItems, ...administrationSettingsItems, ...systemSettingsItems];

function normalizeUser(user, fallbackName = "User") {
  if (!user.id) user.id = `user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  if (!user.name) user.name = fallbackName;
  if (!user.department) user.department = "Qatar Operations";
  if (!user.status) user.status = "Active";
  if (!user.lastLogin) user.lastLogin = "Not Available Yet";
  if (!user.lastPasswordChange) user.lastPasswordChange = "Not Available Yet";
  if (!user.createdAt) user.createdAt = new Date().toISOString().slice(0, 10);
  if (!user.createdBy) user.createdBy = "System";
  if (typeof user.mustChangePassword !== "boolean") user.mustChangePassword = false;
  return user;
}

function loadStoredState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    let migrated = false;
    if (saved.counts) state.counts = { ...state.counts, ...saved.counts };
    if (Array.isArray(saved.recent)) state.recent = normalizeActivityLog(saved.recent);
    if (Array.isArray(saved.uploads)) state.uploads = saved.uploads.filter((file) => file.module !== "fault" && file.kind !== "fault").map(normalizeUploadRecord);
    if (Array.isArray(saved.visits)) state.visits = saved.visits.map(normalizeVisitRecord);
    if (Array.isArray(saved.faultCatalogue)) state.faultCatalogue = saved.faultCatalogue.map(normalizeFaultCatalogueRecord);
    migrated = recoverUnlinkedSiteVisitReports() || migrated;
    if (migrated) saveState();
  } catch {
    // Leave malformed or legacy browser data untouched for supervised recovery.
  }
}

function loadUsers() {
  try {
    const savedUsers = JSON.parse(localStorage.getItem(USERS_KEY) || "[]");
    state.users = Array.isArray(savedUsers) ? savedUsers.map((user) => normalizeUser(user)) : [];
  } catch {
    localStorage.removeItem(USERS_KEY);
    state.users = [];
  }
}

function saveUsers() {
  const safeUsers = state.users.map(({ passwordHash, ...user }) => user);
  localStorage.setItem(USERS_KEY, JSON.stringify(safeUsers));
}

function renderDevCredentials() {
  const panel = document.getElementById("dev-credentials");
  if (!panel) return;
  panel.innerHTML = "";
}

function getCurrentUserRecord() {
  return state.authUser || state.users.find((user) => user.email === state.currentUserEmail);
}

function isAdmin() {
  return [state.currentUserRoleKey, state.currentUserRole].some((role) => normalizedRoleKey(role) === "admin");
}

function canManageOperations() {
  return [state.currentUserRoleKey, state.currentUserRole]
    .map(normalizedRoleKey)
    .some((role) => ["admin", "hq_user", "operations_staff"].includes(role));
}

function normalizedRoleKey(role) {
  const normalized = String(role || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (["admin", "administrator"].includes(normalized)) return "admin";
  if (["operations", "operations_staff", "operation_staff"].includes(normalized)) return "operations_staff";
  if (normalized === "viewer") return "viewer";
  return normalized;
}

function saveState() {
  let existing = {};
  try { existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch { return; }
  const preservedFaultUploads = Array.isArray(existing.uploads) ? existing.uploads.filter((file) => file.module === "fault" || file.kind === "fault") : [];
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    ...existing,
    uploads: [...preservedFaultUploads, ...state.uploads.filter((file) => file.module !== "fault" && file.kind !== "fault")],
    visits: state.visits,
    faultCatalogue: state.faultCatalogue,
    counts: state.counts,
    recent: state.recent,
  }));
}

function getSite(name = state.currentSiteName) {
  return state.sites.find((site) => site.name === name) || state.sites[0];
}

function getCharger(siteName = state.currentSiteName, chargerId = state.currentChargerId) {
  return getSite(siteName)?.chargers?.find((charger) => charger.id === chargerId);
}

function valueOrPlaceholder(value) {
  return value && String(value).trim() ? value : "Not Available Yet";
}

function formatDate(value) {
  if (!value || value === "Not Available Yet" || value === "To Be Updated") return value || "Not Available Yet";
  const parsed = parseDateValue(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return `${String(parsed.getDate()).padStart(2, "0")}/${String(parsed.getMonth() + 1).padStart(2, "0")}/${parsed.getFullYear()}`;
}

function formatDateTime(value) {
  const parsed = parseDateValue(value);
  if (Number.isNaN(parsed.getTime())) return value || "Not Available Yet";
  return `${String(parsed.getDate()).padStart(2, "0")}/${String(parsed.getMonth() + 1).padStart(2, "0")}/${parsed.getFullYear()} at ${String(parsed.getHours()).padStart(2, "0")}:${String(parsed.getMinutes()).padStart(2, "0")}`;
}

function formatMediumDate(value) {
  if (!value || value === "Not Available Yet" || value === "To Be Updated") return value || "Not Available Yet";
  const parsed = parseDateValue(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(parsed);
}

function formatMediumDateTime(value) {
  if (!value || value === "Not Available Yet" || value === "To Be Updated") return value || "Not Available Yet";
  const parsed = parseDateValue(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return `${formatMediumDate(value)} at ${String(parsed.getHours()).padStart(2, "0")}:${String(parsed.getMinutes()).padStart(2, "0")}`;
}

function parseDateValue(value) {
  if (!value || value === "Not Available Yet" || value === "To Be Updated") return new Date(Number.NaN);
  if (value instanceof Date) return value;
  const text = String(value).trim();
  const isoDateOnly = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoDateOnly) return new Date(Number(isoDateOnly[1]), Number(isoDateOnly[2]) - 1, Number(isoDateOnly[3]));
  const isoDateTimeNoZone = text.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (isoDateTimeNoZone && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(text)) {
    return new Date(Number(isoDateTimeNoZone[1]), Number(isoDateTimeNoZone[2]) - 1, Number(isoDateTimeNoZone[3]), Number(isoDateTimeNoZone[4]), Number(isoDateTimeNoZone[5]));
  }
  return new Date(text.replace(" ", "T"));
}

function relativeTime(value) {
  const parsed = parseDateValue(value);
  if (Number.isNaN(parsed.getTime())) return "Not Available Yet";
  const diffMs = Date.now() - parsed.getTime();
  const absMs = Math.max(0, diffMs);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (absMs < minute) return "Just now";
  if (absMs < hour) return `${Math.floor(absMs / minute)} minutes ago`;
  if (absMs < day) return `${Math.floor(absMs / hour)} hours ago`;
  if (absMs < 2 * day) return "Yesterday";
  if (absMs < 7 * day) return `${Math.floor(absMs / day)} days ago`;
  return formatDateTime(value);
}

function normalizeActivityLog(items) {
  return items.map((item, index) => {
    if (typeof item === "string") {
      const occurredAt = new Date(Date.now() - (index + 1) * 24 * 60 * 60 * 1000).toISOString();
      return {
        id: `activity-migrated-${index}-${occurredAt}`,
        actionType: "legacy",
        entityType: "record",
        entityId: "",
        description: item,
        userName: state.currentUser || "System",
        siteName: "",
        chargerName: "",
        occurredAt,
      };
    }
    return {
      id: item.id || `activity-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      actionType: item.actionType || item.action_type || "record_updated",
      entityType: item.entityType || item.entity_type || "record",
      entityId: item.entityId || item.entity_id || "",
      description: item.description || "Record updated",
      userName: item.userName || item.user_id || item.user || state.currentUser || "System",
      siteName: item.siteName || item.site_id || "",
      chargerName: item.chargerName || item.charger_id || "",
      occurredAt: item.occurredAt || item.occurred_at || item.created_at || item.updated_at || new Date().toISOString(),
    };
  });
}

function normalizeUploadRecord(file) {
  const module = file.module || moduleForUpload(file);
  return {
    ...file,
    module,
    category: file.category || categoryForUpload(file),
    siteVisitId: file.siteVisitId || "",
    faultId: file.faultId || "",
    weeklyReportId: file.weeklyReportId || "",
    troubleshootingGuideId: file.troubleshootingGuideId || "",
    documentType: file.documentType || documentTypeForUpload(file),
    weekStart: file.weekStart || "",
    weekEnd: file.weekEnd || "",
    guideCategory: file.guideCategory || "",
    guideVersion: file.guideVersion || "",
    faultCatalogueId: file.faultCatalogueId || "",
    description: file.description || "",
    fileName: file.fileName || file.name || "Uploaded file",
    originalFileName: file.originalFileName || file.name || "Uploaded file",
    mimeType: file.mimeType || file.type || "application/octet-stream",
    fileSize: file.fileSize || file.size || 0,
    storagePath: file.storagePath || `prototype-storage/${file.siteName || "unassigned"}/${file.siteVisitId || "general"}/${file.name || "uploaded-file"}`,
  };
}

function documentTypeForUpload(file) {
  if (file.documentType) return file.documentType;
  if (file.siteVisitId || file.kind === "siteVisit" || file.kind === "visitReport") return "site_visit_report";
  if (file.faultId || file.kind === "fault") return (file.type || file.mimeType || "").startsWith("image/") ? "fault_photo" : "needs_classification";
  if (file.kind === "weeklyReport") return "weekly_report";
  if (file.kind === "guide") return "troubleshooting_guide";
  if (file.kind === "document") return "charger_document";
  return "needs_classification";
}

function moduleForUpload(file) {
  if (file.siteVisitId || file.kind === "siteVisit" || file.kind === "visitReport") return "siteVisit";
  if (file.faultId || file.kind === "fault") return (file.type || file.mimeType || "").startsWith("image/") ? "fault" : "needsClassification";
  if (file.kind === "weeklyReport") return "weeklyReport";
  if (file.kind === "guide") return "troubleshooting";
  if (file.kind === "document") return "chargerDocument";
  return "needsClassification";
}

function categoryForUpload(file) {
  if (file.category) return file.category;
  if (file.siteVisitId || file.kind === "siteVisit" || file.kind === "visitReport") return "Site Visit Report";
  if (file.faultId || file.kind === "fault") return (file.type || file.mimeType || "").startsWith("image/") ? "Fault Photo" : "Needs Classification";
  if (file.kind === "weeklyReport") return "Weekly Report";
  if (file.kind === "guide") return "Troubleshooting Guide";
  if (file.kind === "document") return "Charger Document";
  return "Needs Classification";
}

function normalizeFaultCatalogueRecord(record) {
  return {
    id: record.id || `fault-code-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    faultCode: record.faultCode || record.fault_code || record.dtc_code || "",
    ftbCode: record.ftbCode || record.ftb_code || "",
    faultName: record.faultName || record.fault_name || record.fault_title || "",
    meaning: record.meaning || record.description || "",
    possibleCauses: record.possibleCauses || record.possible_causes || "",
    severity: record.severity || "Not Classified",
    category: record.category || "",
    chargerModel: record.chargerModel || record.charger_model || "",
    component: record.component || "",
    sourceVersion: record.sourceVersion || record.source_version || "",
    sourceSheet: record.sourceSheet || record.source_sheet || "",
    recommendedAction: record.recommendedAction || record.recommended_action || record.recommended_actions || "",
    active: record.active !== false && record.is_active !== false,
    createdAt: record.createdAt || record.created_at || new Date().toISOString(),
    updatedAt: record.updatedAt || record.updated_at || new Date().toISOString(),
  };
}

function normalizeVisitRecord(visit) {
  const attachments = Array.isArray(visit.attachments)
    ? visit.attachments
    : state.uploads.filter((file) => file.siteVisitId === visit.id).map((file) => file.id);
  return {
    ...visit,
    visitDate: visit.visitDate || visit.visit_date || visit.createdAt || visit.created_at || "",
    timeIn: visit.timeIn || visit.time_in || "",
    timeOut: visit.timeOut || visit.time_out || "",
    duration: visit.duration || calculateDurationFromTimes(visit.timeIn || visit.time_in, visit.timeOut || visit.time_out),
    attachments,
    updatedAt: visit.updatedAt || visit.createdAt || new Date().toISOString(),
  };
}

function normalizeFaultRecord(fault, index = 0) {
  const year = new Date(fault.reportedAt || fault.reported_at || fault.createdAt || fault.created_at || Date.now()).getFullYear();
  const faultId = fault.faultId || fault.fault_reference || `FLT-${year}-${String(index + 1).padStart(4, "0")}`;
  return {
    ...fault,
    faultId,
    faultCatalogueId: fault.faultCatalogueId || fault.fault_catalogue_id || "",
    faultCode: fault.faultCode || fault.fault_code || fault.errorCode || "",
    ftbCode: fault.ftbCode || fault.ftb_code || "", component: fault.component || "",
    faultName: fault.faultName || fault.title || fault.category || "Needs Catalogue Classification",
    faultDescription: fault.faultDescription || fault.technician_observation || "",
    siteName: fault.siteName || fault.site_name || "", chargerId: fault.chargerId || fault.charger_id || "", chargerName: fault.chargerName || fault.charger_name || "",
    possibleCauses: fault.possibleCauses || fault.possible_causes || "", recommendedAction: fault.recommendedAction || fault.recommended_actions || "",
    technicalCategory: fault.technicalCategory || fault.technical_category || "", chargerStatus: fault.chargerStatus || fault.charger_status || "Active",
    siteVisitRequired: fault.siteVisitRequired ?? fault.requires_site_visit ?? false, reportedBy: fault.reportedBy || fault.reported_by_name || fault.created_by_name || "",
    reportedAt: fault.reportedAt || fault.reported_at || "", reportedDate: fault.reportedDate || String(fault.reported_at || "").slice(0,10), reportedTime: fault.reportedTime || String(fault.reported_at || "").slice(11,16),
    createdAt: fault.createdAt || fault.created_at, updatedAt: fault.updatedAt || fault.updated_at,
    status: ({ open:"Open", in_progress:"In Progress", resolved:"Resolved" }[fault.status] || fault.status),
    priority: normalizedFaultSeverity(fault.priority, "Medium"), category: fault.category || fault.fault_type || "Other",
    comments: fault.comments || fault.resolution_notes || "", attachmentRecords: fault.attachments || [],
    severity: normalizedFaultSeverity(fault.severity),
    recommendedAction: fault.recommendedAction || "",
    photos: Array.isArray(fault.attachments) ? fault.attachments.map((file) => file.id) : Array.isArray(fault.photos) ? fault.photos : [],
  };
}

function normalizedFaultSeverity(value, fallback = "Not Classified") {
  const normalized = String(value || "").trim().toLowerCase();
  return { low: "Low", medium: "Medium", high: "High", critical: "Critical", "not classified": "Not Classified", not_classified: "Not Classified" }[normalized] || fallback;
}

function calculateDurationFromTimes(timeIn, timeOut) {
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

function addActivity({ actionType, entityType, entityId = "", description, siteName = "", chargerName = "" }) {
  const occurredAt = new Date().toISOString();
  const duplicate = state.recent.find((item) => item?.actionType === actionType && item?.entityType === entityType && item?.entityId === entityId && item?.description === description && Date.now() - parseDateValue(item.occurredAt).getTime() < 1500);
  if (duplicate) return duplicate;
  const activity = {
    id: `activity-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    actionType,
    entityType,
    entityId,
    description,
    userName: state.currentUser || "System",
    siteName,
    chargerName,
    occurredAt,
  };
  state.recent.unshift(activity);
  state.recent = state.recent.slice(0, 80);
  return activity;
}

function getRecentActivities(limit = 5) {
  return [...state.recent]
    .filter((item) => item?.occurredAt)
    .sort((a, b) => parseDateValue(b.occurredAt).getTime() - parseDateValue(a.occurredAt).getTime())
    .slice(0, limit);
}

function isValidUploadRecord(file) {
  if (!file?.id || file.module === "needsClassification" || file.category === "Needs Classification" || file.documentType === "needs_classification") return false;
  if (file.module === "siteVisit") return !!file.siteVisitId && state.visits.some((visit) => visit.id === file.siteVisitId);
  if (file.module === "fault") return !!file.faultId && state.faults.some((fault) => fault.faultId === file.faultId);
  if (file.module === "weeklyReport") return !!file.weeklyReportId;
  if (file.module === "troubleshooting") return !!file.troubleshootingGuideId;
  if (file.module === "chargerDocument") return !!file.chargerId || !!file.siteName;
  return false;
}

function getValidUploads() {
  return state.uploads.filter(isValidUploadRecord);
}

function recoverUnlinkedSiteVisitReports() {
  let changed = false;
  const reportFiles = state.uploads
    .filter((file) => file.module === "siteVisit" && !file.siteVisitId)
    .sort((a, b) => parseDateValue(a.uploadedAt).getTime() - parseDateValue(b.uploadedAt).getTime());
  reportFiles.forEach((file) => {
    const matchingVisits = state.visits
      .filter((visit) => visit.siteName === file.siteName && (!file.chargerId || visit.chargerId === file.chargerId))
      .filter((visit) => !state.uploads.some((upload) => upload.siteVisitId === visit.id && upload.id !== file.id))
      .map((visit) => ({
        visit,
        distance: Math.abs(parseDateValue(file.uploadedAt).getTime() - parseDateValue(visit.createdAt || visit.visitDate).getTime()),
      }))
      .filter((item) => Number.isFinite(item.distance))
      .sort((a, b) => a.distance - b.distance);
    const bestMatch = matchingVisits[0];
    const secondMatch = matchingVisits[1];
    const isSafeSingleMatch = matchingVisits.length === 1;
    const isSafeNearestMatch = bestMatch && bestMatch.distance <= 10 * 60 * 1000 && (!secondMatch || secondMatch.distance - bestMatch.distance > 30 * 1000);
    if (bestMatch && (isSafeSingleMatch || isSafeNearestMatch)) {
      file.siteVisitId = bestMatch.visit.id;
      file.documentType = "site_visit_report";
      file.category = "Site Visit Report";
      bestMatch.visit.attachments = Array.from(new Set([...(bestMatch.visit.attachments || []), file.id]));
      changed = true;
      return;
    }
    file.module = "needsClassification";
    file.category = "Needs Site Visit Assignment";
    file.documentType = "needs_classification";
    changed = true;
  });
  return changed;
}

function getRecordDate(record, fallback = record?.createdAt) {
  return record?.reportedAt || record?.visitDate || record?.uploadedAt || record?.createdAt || fallback || "";
}

function refreshDerivedCounts() {
  const chargerTotal = state.sites.reduce((total, site) => total + (site.chargers?.length || 0), 0);
  state.counts.chargers = chargerTotal;
  state.counts.faults = state.faults.filter((fault) => ["Open", "In Progress"].includes(fault.status)).length;
  state.counts.visits = state.visits.length;
  return state.counts;
}

function imageBlock(src, label, className = "") {
  const imageSource = typeof src === "object" ? src?.display || src?.original : src;
  const resolvedImageSource = typeof apiAssetUrl === "function" ? apiAssetUrl(imageSource) : imageSource;
  const placeholderText = className.includes("charger") ? "No Charger Image Available" : "No Site Image Available";
  return src
    ? `<div class="image-placeholder ${className} has-image" data-placeholder-text="${placeholderText}"><img src="${resolvedImageSource}" alt="${label}" loading="lazy" onerror="showImageFallback(this)" /></div>`
    : `<div class="image-placeholder ${className} branded-placeholder"><div class="brand-mark"><strong>ZEEDA</strong><span>ENERGY</span></div><small>${placeholderText}</small></div>`;
}

function showImageFallback(image) {
  const wrapper = image?.closest?.(".image-placeholder");
  if (!wrapper) return;
  const placeholderText = wrapper.dataset.placeholderText || "No Site Image Available";
  wrapper.classList.remove("has-image");
  wrapper.classList.add("branded-placeholder");
  wrapper.innerHTML = `<div class="brand-mark"><strong>ZEEDA</strong><span>ENERGY</span></div><small>${placeholderText}</small>`;
}

function placeholder(label, value = "Not Available Yet") {
  return `<div class="data-row"><span>${label}</span><strong>${value}</strong></div>`;
}

function bump(key) {
  state.counts[key] = state.counts[key] == null ? 1 : state.counts[key] + 1;
}
