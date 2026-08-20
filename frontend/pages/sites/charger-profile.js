function chargerTab(tab, site, chargerId = state.currentChargerId) {
  const charger = getCharger(site, chargerId);
  if (tab === "Overview") {
    return `<div class="overview-grid compact-overview">${imageBlock(charger?.image, "Charger Photo", "compact-image charger-overview-image")}<div class="panel flat"><h2>Charger Snapshot</h2><div class="data-list">${placeholder("Site", site)}${placeholder("Charger Name", valueOrPlaceholder(charger?.name))}${placeholder("Charger Type", valueOrPlaceholder(charger?.type))}${placeholder("Status", valueOrPlaceholder(charger?.status))}${placeholder("Manufacturer", valueOrPlaceholder(charger?.manufacturer))}${placeholder("Capacity", valueOrPlaceholder(charger?.capacity))}${placeholder("Installation Date", formatDate(charger?.installationDate))}${placeholder("Operator", valueOrPlaceholder(charger?.operator))}${placeholder("Administrator", valueOrPlaceholder(charger?.administrator))}${placeholder("Model", valueOrPlaceholder(charger?.model))}${placeholder("Serial Number", valueOrPlaceholder(charger?.serialNumber))}${placeholder("Notes", valueOrPlaceholder(charger?.notes))}${placeholder("Faults")}${placeholder("Last Visit")}</div></div></div>`;
  }
  const modal = tab === "Faults" ? "fault" : tab === "Documents" ? "document" : tab === "Weekly Reports" ? "weeklyReport" : tab === "Troubleshooting" ? "guide" : "siteVisit";
  const label = tab === "Faults" ? "Report fault" : tab === "Site Visits" ? "Add site visit" : "Upload";
  return recordsModule(tab, [[label, modal]], ["Date", "Site", "Charger", "Uploaded by", "Status", "Attachments", "Actions"], ["Search", "Filter by date", "Filter by status"], "", {
    siteId: getSite(site)?.id || "",
    chargerId: charger?.id || chargerId,
  });
}

function openCharger(site, chargerId, initialTab = "Overview") {
  if (!requireAuth()) return;
  const profile = document.getElementById("charger-profile");
  const tabs = ["Overview", "Site Visits", "Faults", "Documents", "Weekly Reports", "Troubleshooting"];
  if (!tabs.includes(initialTab)) initialTab = "Overview";
  state.currentSiteName = site;
  state.currentChargerId = chargerId;
  state.currentChargerTab = initialTab;
  const charger = getCharger(site, chargerId);
  profile.classList.remove("hidden");
  profile.innerHTML = `<div class="profile-head compact-profile-head"><div><p class="eyebrow">Charger Profile</p><h1>${valueOrPlaceholder(charger?.name)}</h1></div><div class="profile-meta"><span>Site: ${site}</span><span>Status: ${valueOrPlaceholder(charger?.status)}</span><span>Type: ${valueOrPlaceholder(charger?.type)}</span></div><div class="charger-profile-actions">${isAdmin() ? `<button class="secondary-button" data-modal="charger" type="button">Edit Charger Information</button>` : ""}${isAdmin() ? `<button class="danger-button" data-archive-active="charger" data-archive-id="${charger?.id}" data-archive-name="${formatSettingValue(charger?.name)}" type="button">Archive</button>` : ""}</div></div><div class="subtabs">${tabs.map((tab) => `<button class="${tab === initialTab ? "active" : ""}" data-tab="${tab}" type="button">${tab}</button>`).join("")}</div><div class="tab-body">${chargerTab(initialTab, site, chargerId)}</div>`;
  profile.querySelector(".subtabs").addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    profile.querySelectorAll(".subtabs button").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    state.currentChargerTab = button.dataset.tab;
    profile.querySelector(".tab-body").innerHTML = chargerTab(button.dataset.tab, site, chargerId);
    saveViewContext({ route: "sites", siteName: state.currentSiteName, chargerId: state.currentChargerId, chargerTab: state.currentChargerTab });
  });
  saveViewContext({ route: "sites", siteName: state.currentSiteName, chargerId: state.currentChargerId, chargerTab: state.currentChargerTab });
  profile.scrollIntoView({ behavior: "smooth", block: "start" });
}
