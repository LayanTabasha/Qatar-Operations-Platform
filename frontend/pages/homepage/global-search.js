function globalSearchRecords(query) {
  const normalizedQuery = String(query || "").trim().toLowerCase();
  if (!normalizedQuery) return [];
  const matches = (values) => values.some((value) => String(value ?? "").toLowerCase().includes(normalizedQuery));
  const results = [];
  state.sites.forEach((site) => {
    if (matches([site.name, site.code, site.location, site.description])) results.push({ type: "Site", title: site.name, detail: site.location, siteName: site.name, tab: "Overview" });
    (site.chargers || []).forEach((charger) => {
      if (matches([charger.name, charger.code, charger.serialNumber, charger.manufacturer, charger.model])) results.push({ type: "Charger", title: charger.name, detail: site.name, siteName: site.name, chargerId: charger.id });
    });
  });
  state.faults.forEach((fault) => {
    if (matches([fault.faultId, fault.faultCode, fault.faultName, fault.title, fault.description, fault.siteName, fault.chargerName])) results.push({ type: "Fault", title: fault.faultId || fault.faultName, detail: fault.siteName, siteName: fault.siteName, tab: "Faults" });
  });
  state.visits.forEach((visit) => {
    if (matches([visit.purpose, visit.notes, visit.siteName, visit.chargerName, visit.createdBy])) results.push({ type: "Site Visit", title: visit.purpose || "Site Visit", detail: visit.siteName, siteName: visit.siteName, tab: "Site Visits" });
  });
  getValidUploads().forEach((file) => {
    if (!matches([file.title, file.name, file.category, file.documentType, file.guideCategory, file.siteName, file.chargerName])) return;
    const tab = file.kind === "weeklyReport" ? "Weekly Reports" : file.kind === "guide" ? "Troubleshooting" : "Documents";
    results.push({ type: tab.slice(0, -1), title: file.title || file.name, detail: file.siteName, siteName: file.siteName, tab });
  });
  return results.slice(0, 50);
}

function renderGlobalSearchResults(query) {
  const input = document.getElementById("global-search");
  if (!input) return;
  let target = document.getElementById("global-search-results");
  if (!target) {
    target = document.createElement("section");
    target.id = "global-search-results";
    target.className = "panel recent-panel hidden";
    document.querySelector("#home .hero-row")?.insertAdjacentElement("afterend", target);
  }
  const trimmed = String(query || "").trim();
  target.classList.toggle("hidden", !trimmed);
  if (!trimmed) { target.innerHTML = ""; return; }
  const results = globalSearchRecords(trimmed);
  target.innerHTML = `<div class="panel-head"><h2>Search Results</h2><strong>${results.length} result${results.length === 1 ? "" : "s"}</strong></div>${results.length ? `<div class="activity-list">${results.map((item, index) => `<button type="button" class="activity-row" data-global-result="${index}"><span>${item.type}</span><strong><b>${safeDetailValue(item.title)}</b><small>${safeDetailValue(item.detail || "")}</small></strong></button>`).join("")}</div>` : `<div class="empty-state"><h2>No matching records</h2><p>Try a different search.</p></div>`}`;
  target._searchResults = results;
}

if (typeof document !== "undefined") {
  document.addEventListener("input", (event) => {
    if (event.target.id === "global-search") renderGlobalSearchResults(event.target.value);
  });
  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-global-result]");
    if (!button) return;
    const result = document.getElementById("global-search-results")?._searchResults?.[Number(button.dataset.globalResult)];
    if (!result) return;
    setRoute("sites");
    if (result.chargerId) openCharger(result.siteName, result.chargerId);
    else if (result.siteName) openSite(result.siteName, result.tab || "Overview");
  });
}
