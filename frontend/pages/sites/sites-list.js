const siteListFilters = { search: "", status: "" };

function sitesFilterControl(target) {
  if (!target?.closest?.("#sites .site-header-tools")) return "";
  if (target.matches?.('#sites .site-header-tools input[type="search"]')) return "search";
  if (target.matches?.("#sites .site-header-tools select")) return "status";
  return "";
}

function handleSitesFilterEvent(event) {
  const filterName = sitesFilterControl(event.target);
  if (!filterName) return;
  siteListFilters[filterName] = event.target.value;
  buildSites();
}

function bindSitesFilters() {
  if (typeof document === "undefined" || document.documentElement?.dataset.sitesFiltersBound === "true") return;
  if (document.documentElement) document.documentElement.dataset.sitesFiltersBound = "true";
  document.addEventListener("input", (event) => {
    if (sitesFilterControl(event.target) === "search") handleSitesFilterEvent(event);
  });
  document.addEventListener("change", (event) => {
    if (sitesFilterControl(event.target) === "status") handleSitesFilterEvent(event);
  });
}

bindSitesFilters();

function buildSites() {
  const siteList = document.getElementById("site-list");
  const searchInput = document.querySelector('#sites .site-header-tools input[type="search"]');
  const statusFilter = document.querySelector("#sites .site-header-tools select");
  if (searchInput && searchInput.value !== siteListFilters.search) searchInput.value = siteListFilters.search;
  if (statusFilter) {
    const selectedStatus = siteListFilters.status;
    const statuses = Array.from(new Set(state.sites.map((site) => site.status).filter(Boolean))).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
    statusFilter.innerHTML = `<option value="">Filter by status</option>${statuses.map((status) => filterOption(status, selectedStatus)).join("")}`;
  }
  document.getElementById("add-site-button")?.classList.toggle("hidden", !isAdmin());
  if (state.backendLoading) {
    siteList.innerHTML = `<div class="empty-state"><h2>Loading sites...</h2><p>Fetching sites and chargers from the Qatar Operations backend.</p></div>`;
    return;
  }
  if (state.backendError) {
    siteList.innerHTML = `<div class="empty-state"><h2>Could not load sites</h2><p>${state.backendError}</p><button class="primary-button" id="retry-operational-data" type="button">Retry</button></div>`;
    return;
  }
  if (!state.sites.length) {
    siteList.innerHTML = `<div class="empty-state"><h2>No sites found</h2><p>No active site records are available from the backend yet.</p></div>`;
    return;
  }

  const filteredSites = state.sites.filter((site) => {
    const matchesSearch = includesFilterText([site.name, site.code, site.location, site.address, site.client, site.description], siteListFilters.search);
    const matchesStatus = !siteListFilters.status || normalizedFilterText(site.status) === normalizedFilterText(siteListFilters.status);
    return matchesSearch && matchesStatus;
  });
  if (!filteredSites.length) {
    siteList.innerHTML = `<div class="empty-state"><h2>No sites match the selected filters</h2><p>Try a different search or status.</p></div>`;
    return;
  }

  siteList.innerHTML = filteredSites.map((site) => `
    <article class="site-card">
      ${imageBlock(site.image, site.name)}
      <div class="site-content">
        <div class="card-heading"><h2>${site.name}</h2><span class="status-pill warning">${site.status}</span></div>
        <div class="data-list">
          ${placeholder("Location", site.location || "To Be Updated")}
          ${placeholder("Site Status", site.status || "Pending Data")}
          ${placeholder("Number of Chargers", valueOrPlaceholder(String(site.chargerCount ?? site.chargers?.length ?? "")))}
          ${placeholder("Open Faults", String(site.openFaultCount ?? state.faults.filter((fault) => fault.siteName === site.name && ["Open", "In Progress"].includes(fault.status)).length))}
          ${placeholder("Last Visit", site.lastSiteVisit ? formatDate(site.lastSiteVisit) : latestVisitForSite(site.name))}
        </div>
        <div class="card-actions site-card-actions">
          ${isAdmin() ? `<button class="secondary-button" data-modal="site" data-mode="edit" data-site-context="${site.name}" type="button">Edit</button>` : ""}
          <button class="primary-button open-site" data-site="${site.name}" type="button">Open Site</button>
          ${isAdmin() ? `<button class="danger-button" data-archive-active="site" data-archive-id="${site.id}" data-archive-name="${formatSettingValue(site.name)}" type="button">Archive</button>` : ""}
        </div>
      </div>
    </article>`).join("");
}
