const operationalRecordFilters = new Map();

function normalizedFilterText(value) {
  return String(value ?? "").trim().toLowerCase();
}

function includesFilterText(values, query) {
  const normalizedQuery = normalizedFilterText(query);
  return !normalizedQuery || values.some((value) => normalizedFilterText(value).includes(normalizedQuery));
}

function latestVisitForSite(siteName) {
  const visit = state.visits.filter((item) => item.siteName === siteName).sort((a, b) => new Date(getRecordDate(b)).getTime() - new Date(getRecordDate(a)).getTime())[0];
  return visit ? formatDate(visit.visitDate || visit.createdAt) : "Not Available Yet";
}

function uploadKindForTitle(title) {
  if (title === "Site Visits") return ["siteVisit", "visitReport"];
  if (title === "Faults") return ["fault"];
  if (title === "Documents") return ["document"];
  if (title === "Weekly Reports") return ["weeklyReport"];
  return ["guide"];
}

function fileIcon(type) {
  const paths = {
    download: `<path d="M12 3v11m0 0 4-4m-4 4-4-4M5 19h14"/>`,
    edit: `<path d="m4 16-.8 4 4-.8L18.5 7.9l-3.4-3.4L4 16Z"/><path d="m13.8 5.8 3.4 3.4"/>`,
    delete: `<path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5"/>`,
    preview: `<path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="3"/>`,
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[type] || paths.preview}</svg>`;
}

function moduleFilterKey(title) {
  return [state.currentSiteName || "all-sites", state.currentChargerId || "all-chargers", title].join("::");
}

function moduleFilters(title) {
  const key = moduleFilterKey(title);
  if (!operationalRecordFilters.has(key)) operationalRecordFilters.set(key, { search: "", charger: "", date: "", status: "", faultCode: "", documentType: "", category: "" });
  return operationalRecordFilters.get(key);
}

function uniqueFilterOptions(values) {
  return Array.from(new Map(values.filter(Boolean).map((value) => [normalizedFilterText(value), String(value)])).values()).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));
}

function filterOption(value, selected) {
  return `<option value="${safeDetailValue(value)}"${String(value) === String(selected) ? " selected" : ""}>${safeDetailValue(value)}</option>`;
}
