function siteTab(tab, site) {
  const siteRecord = getSite(site);
  if (tab === "Overview") {
    return `<div class="overview-grid compact-overview">${imageBlock(siteRecord?.image, site, "compact-image")}<div class="panel flat"><h2>Site Snapshot</h2><div class="data-list">${placeholder("Location", valueOrPlaceholder(siteRecord?.location))}${placeholder("Client / Organization", valueOrPlaceholder(siteRecord?.client))}${placeholder("Site Status", valueOrPlaceholder(siteRecord?.status))}${placeholder("Description", valueOrPlaceholder(siteRecord?.description))}${placeholder("Chargers at this site", siteRecord?.chargers?.length ? String(siteRecord.chargers.length) : "Not Available Yet")}${placeholder("Latest Activity", "To Be Updated")}${placeholder("Notes", valueOrPlaceholder(siteRecord?.notes))}</div></div></div>
      <div class="summary-grid"><article>${placeholder("Chargers", siteRecord?.chargers?.length ? String(siteRecord.chargers.length) : "Not Available Yet")}</article><article>${placeholder("Open Faults", String(state.faults.filter((fault) => fault.siteName === site && ["Open", "In Progress"].includes(fault.status)).length))}</article><article>${placeholder("Last Visit", latestVisitForSite(site))}</article><article>${placeholder("Uploaded Files", String(getValidUploads().filter((file) => file.siteName === site).length))}</article></div>`;
  }
  if (tab === "Chargers") {
    const chargers = sortChargersForDisplay(siteRecord?.chargers || []);
    const addCharger = isAdmin() && siteRecord?.id
      ? `<button class="primary-button" data-modal="charger" data-mode="create" data-site-context="${site}" data-site-id="${siteRecord.id}" data-lock-site="true" type="button">+ Add Charger</button>`
      : "";
    if (!chargers.length) {
      return `<div class="empty-state"><h2>No active chargers added yet</h2><p>Use Add Charger to create editable charger records for ${site}.</p>${addCharger}</div>`;
    }
    return `<div class="module-header"><div><h2>Chargers</h2></div><div class="quick-actions compact">${addCharger}</div></div><div class="charger-grid">${chargers.map((charger) => `<article class="charger-card">${imageBlock(charger.image, valueOrPlaceholder(charger.name), "charger-photo")}<h2>${valueOrPlaceholder(charger.name)}</h2><div class="data-list">${placeholder("Charger Type", valueOrPlaceholder(charger.type))}${placeholder("Status", valueOrPlaceholder(charger.status))}${placeholder("Manufacturer", valueOrPlaceholder(charger.manufacturer))}${placeholder("Capacity", valueOrPlaceholder(charger.capacity))}${placeholder("Operator", valueOrPlaceholder(charger.operator))}${placeholder("Administrator", valueOrPlaceholder(charger.administrator))}${placeholder("Model", valueOrPlaceholder(charger.model))}${placeholder("Serial Number", valueOrPlaceholder(charger.serialNumber))}${placeholder("Installation Date", formatDate(charger.installationDate))}${placeholder("Faults")}${placeholder("Last Visit")}</div><div class="card-actions split-actions"><button class="primary-button open-charger" data-site="${site}" data-charger="${charger.id}" type="button">Open Charger</button>${isAdmin() ? `<button class="danger-button" data-archive-active="charger" data-archive-id="${charger.id}" data-archive-name="${formatSettingValue(charger.name)}" type="button">Archive</button>` : ""}</div></article>`).join("")}</div>`;
  }
  const siteContext = { siteId: siteRecord?.id || "" };
  if (tab === "Site Visits") return recordsModule("Site Visits", [["Add new site visit", "siteVisit"]], ["Date", "Time in", "Time out", "Site", "Charger", "Purpose", "Notes", "Report file"], ["Search visits", "Filter by charger", "Filter by date"], "", siteContext);
  if (tab === "Faults") return recordsModule("Faults", [["Report fault", "fault"]], ["Fault ID", "Date", "Site", "Charger", "Fault Code", "Fault Name", "Severity", "Status", "Photos"], ["Search by Fault ID", "Filter by charger", "Filter by fault code", "Filter by status"], "Fault records support photo evidence only. General documents and reports belong in their own modules.", siteContext);
  if (tab === "Documents") return recordsModule("Documents", [["Upload charger document", "document"]], ["Document title", "Category", "Related site", "Related charger", "Uploaded by", "Upload date", "Actions"], ["Search charger documents", "Filter by document type", "Filter by charger"], "", siteContext);
  if (tab === "Weekly Reports") return recordsModule("Weekly Reports", [["Upload weekly report", "weeklyReport"]], ["Week number", "Date range", "Related site", "Related charger", "Uploaded by", "Upload date", "Summary", "Attachment", "Actions"], ["View reports by week", "Filter by charger"], "", siteContext);
  return recordsModule("Troubleshooting", [["Add troubleshooting guide", "guide"]], ["Guide title", "Category", "Version", "Related charger", "Uploaded by", "Upload date", "Actions"], ["Search guides", "Filter by charger", "Filter by category"], "", siteContext);
}

function openSite(site, initialTab = "Overview") {
  if (!requireAuth()) return;
  const profile = document.getElementById("site-profile");
  document.getElementById("charger-profile").classList.add("hidden");
  const tabs = ["Overview", "Chargers", "Site Visits", "Faults", "Documents", "Weekly Reports", "Troubleshooting"];
  if (!tabs.includes(initialTab)) initialTab = "Overview";
  state.currentSiteName = site;
  state.currentChargerId = "";
  state.currentSiteTab = initialTab;
  const siteRecord = getSite(site);
  profile.classList.remove("hidden");
  if (initialTab === "Site Visits") closeModal();
  profile.innerHTML = `<div class="profile-head compact-profile-head">
    <div><p class="eyebrow">Site Profile</p><h1>${site}</h1></div>
    <div class="profile-meta">
      <span>Status: ${valueOrPlaceholder(siteRecord?.status)}</span><span>Location: ${valueOrPlaceholder(siteRecord?.location)}</span><span>Last updated: To Be Updated</span>
    </div>
    <div class="charger-profile-actions">${isAdmin() ? `<button class="secondary-button" data-modal="site" data-mode="edit" data-site-context="${site}" type="button">Edit Site</button>` : ""}${isAdmin() ? `<button class="danger-button" data-archive-active="site" data-archive-id="${siteRecord?.id}" data-archive-name="${formatSettingValue(site)}" type="button">Archive</button>` : ""}</div>
  </div><div class="subtabs">${tabs.map((tab) => `<button class="${tab === initialTab ? "active" : ""}" data-tab="${tab}" type="button">${tab}</button>`).join("")}</div><div class="tab-body">${siteTab(initialTab, site)}</div>`;
  profile.querySelector(".subtabs").addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    profile.querySelectorAll(".subtabs button").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    state.currentSiteTab = button.dataset.tab;
    const tabBody = profile.querySelector(".tab-body");
    try {
      if (button.dataset.tab === "Site Visits") closeModal();
      tabBody.innerHTML = siteTab(button.dataset.tab, site);
    } catch (error) {
      console.error("Site tab render failed", error);
      tabBody.innerHTML = `<div class="empty-state"><h2>Site Visits could not be displayed</h2><p>${safeDetailValue(error.message || "Unexpected rendering error")}</p></div>`;
    } finally {
      if (button.dataset.tab === "Site Visits") {
        document.getElementById("modal-backdrop")?.classList.add("hidden");
        document.body.classList.remove("modal-open", "is-loading");
      }
    }
    saveViewContext({ route: "sites", siteName: state.currentSiteName, chargerId: "", siteTab: state.currentSiteTab });
  });
  saveViewContext({ route: "sites", siteName: state.currentSiteName, chargerId: "", siteTab: state.currentSiteTab });
  profile.scrollIntoView({ behavior: "smooth", block: "start" });
}
