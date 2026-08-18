function archiveCount(record, key) {
  return Number(record?.[key] ?? 0);
}

function archiveText(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function archiveValue(value) {
  return value === null || value === undefined || String(value).trim() === ""
    ? "—"
    : archiveText(value);
}

function archiveDate(value) {
  return value ? archiveText(formatMediumDateTime(value)) : "—";
}

function archiveFact(label, value, className = "") {
  return `<div class="archive-fact ${className}"><span>${label}</span><strong>${archiveValue(value)}</strong></div>`;
}

function archiveCountPill(label, count) {
  return `<span class="archive-count-pill"><b>${archiveCount({ count }, "count")}</b> ${label}</span>`;
}

function archiveDependencies(error) {
  return error?.payload?.error?.details?.dependencies || error?.payload?.details?.dependencies || null;
}

function readableDependencies(dependencies) {
  if (!dependencies) return "";
  const linked = Object.entries(dependencies)
    .filter(([, count]) => Number(count) > 0)
    .map(([type, count]) => `${count} ${type.replaceAll("_", " ")}`);
  return linked.length ? ` Linked records: ${linked.join(", ")}. Remove or reassign them before trying again.` : "";
}

function renderArchiveFeedback() {
  return state.archive.feedback
    ? `<div class="archive-feedback" role="status">${formatSettingValue(state.archive.feedback)}</div>`
    : "";
}

function archiveActionButtons(type, item) {
  return `<div class="file-actions archive-actions">
    <button class="secondary-button" data-archive-details="${type}" data-archive-id="${item.id}" type="button">View Details</button>
    <button class="secondary-button" data-archive-restore="${type}" data-archive-id="${item.id}" data-archive-name="${formatSettingValue(item.name)}" type="button">Restore</button>
    <button class="danger-button" data-archive-delete="${type}" data-archive-id="${item.id}" data-archive-name="${formatSettingValue(item.name)}" type="button">Delete Permanently</button>
  </div>`;
}

function archiveSiteCards(items) {
  return items.map((site) => `<article class="archive-card archive-site-card">
    <header class="archive-card-header"><div><p class="eyebrow">Archived Site</p><h3>${archiveValue(site.name)}</h3>${site.code ? `<small>${archiveText(site.code)}</small>` : ""}</div><span class="status-pill warning">Archived</span></header>
    <div class="archive-facts">
      ${archiveFact("Location", site.location)}
      ${archiveFact("Client / Organization", site.client || site.organization)}
      ${archiveFact("Archived Date", site.archived_at ? formatMediumDateTime(site.archived_at) : "")}
      ${archiveFact("Archived By", site.archived_by_name)}
      ${archiveFact("Archive Reason", site.archive_reason, "archive-fact-wide archive-reason")}
    </div>
    <div class="archive-related" aria-label="Related record counts">
      ${archiveCountPill("chargers", site.charger_count)}${archiveCountPill("visits", site.site_visit_count)}
      ${archiveCountPill("documents", archiveCount(site, "document_count") + archiveCount(site, "report_count"))}
      ${archiveCountPill("faults", site.fault_count)}${archiveCountPill("troubleshooting", site.troubleshooting_count)}
    </div>
    <p class="archive-updated">Last updated <strong>${archiveDate(site.updated_at)}</strong></p>
    <footer class="archive-card-footer">${archiveActionButtons("site", site)}</footer>
  </article>`).join("");
}

function archiveChargerCards(items) {
  return items.map((charger) => `<article class="archive-card archive-charger-card">
    <header class="archive-card-header"><div><p class="eyebrow">Archived Charger</p><h3>${archiveValue(charger.name)}</h3>${charger.code ? `<small>${archiveText(charger.code)}</small>` : ""}</div><span class="status-pill warning">Archived</span></header>
    <div class="archive-facts">
      ${archiveFact("Parent Site", charger.site_name)}
      ${archiveFact("Charger Type", charger.type)}
      ${archiveFact("Manufacturer / Model", [charger.manufacturer, charger.model].filter(Boolean).join(" / "))}
      ${archiveFact("Serial Number", charger.serial_number)}
      ${archiveFact("Archived Date", charger.archived_at ? formatMediumDateTime(charger.archived_at) : "")}
      ${archiveFact("Archived By", charger.archived_by_name)}
      ${archiveFact("Archive Reason", charger.archive_reason, "archive-fact-wide archive-reason")}
    </div>
    <div class="archive-related" aria-label="Related record counts">
      ${archiveCountPill("visits", charger.site_visit_count)}${archiveCountPill("faults", charger.fault_count)}
      ${archiveCountPill("documents", charger.document_count)}${archiveCountPill("troubleshooting", charger.troubleshooting_count)}
    </div>
    <p class="archive-updated">Last updated <strong>${archiveDate(charger.updated_at)}</strong></p>
    <footer class="archive-card-footer">${archiveActionButtons("charger", charger)}</footer>
  </article>`).join("");
}

function filteredArchiveItems() {
  const query = state.archive.search.trim().toLowerCase();
  const items = state.archive.tab === "sites" ? state.archive.sites : state.archive.chargers;
  if (!query) return items;
  return items.filter((item) => Object.values(item).some((value) => String(value ?? "").toLowerCase().includes(query)));
}

function renderArchiveResults() {
  const target = document.getElementById("archive-results");
  if (!target) return;
  if (state.archive.loading) {
    target.innerHTML = `<div class="empty-state"><h2>Loading archive...</h2><p>Fetching archived records from the backend.</p></div>`;
    return;
  }
  if (state.archive.error) {
    target.innerHTML = `<div class="empty-state"><h2>Could not load Archive</h2><p>${formatSettingValue(state.archive.error)}</p><button class="primary-button" data-archive-retry type="button">Retry</button></div>`;
    return;
  }
  const items = filteredArchiveItems();
  const label = state.archive.tab === "sites" ? "sites" : "chargers";
  const singularLabel = state.archive.tab === "sites" ? "site" : "charger";
  const count = document.getElementById("archive-result-count");
  if (count) count.textContent = `${items.length} archived ${items.length === 1 ? singularLabel : label}`;
  if (!items.length) {
    target.innerHTML = `<div class="empty-state archive-empty"><h2>No archived ${label}</h2><p>${state.archive.search ? "Try a different search." : `Archived ${label} will appear here.`}</p></div>`;
    return;
  }
  target.innerHTML = `<div class="archive-card-grid">${state.archive.tab === "sites" ? archiveSiteCards(items) : archiveChargerCards(items)}</div>`;
}

function renderArchivePage() {
  return `<div class="settings-section archive-page">
    <div class="panel-head"><div><h2>Archive</h2><p>Restore archived operational records or permanently delete eligible records.</p></div></div>
    ${renderArchiveFeedback()}
    <div class="subtabs archive-tabs" role="tablist">
      <button class="${state.archive.tab === "sites" ? "active" : ""}" data-archive-tab="sites" role="tab" type="button">Archived Sites</button>
      <button class="${state.archive.tab === "chargers" ? "active" : ""}" data-archive-tab="chargers" role="tab" type="button">Archived Chargers</button>
    </div>
    <div class="archive-toolbar"><label><span class="sr-only">Search archive</span><input id="archive-search" type="search" value="${archiveText(state.archive.search)}" placeholder="Search archived ${state.archive.tab}" /></label><strong id="archive-result-count">0 archived ${state.archive.tab}</strong></div>
    <div id="archive-results"></div>
  </div>`;
}

async function loadArchiveData() {
  if (!isAdmin()) return;
  state.archive.loading = true;
  state.archive.error = "";
  renderArchiveResults();
  try {
    const [sitesResponse, chargersResponse] = await Promise.all([window.QatarOpsApi.Archive.listSites(), window.QatarOpsApi.Archive.listChargers()]);
    state.archive.sites = sitesResponse.sites || [];
    state.archive.chargers = chargersResponse.chargers || [];
  } catch (error) {
    if ([401, 403].includes(error.status)) state.archive.error = "Your session does not have Administrator access to the Archive.";
    else state.archive.error = error.message || "The Archive could not be loaded.";
  } finally {
    state.archive.loading = false;
    renderArchiveResults();
  }
}

function closeArchiveModal() {
  document.getElementById("archive-action-backdrop")?.remove();
  document.body.classList.remove("modal-open");
}

function showArchiveModal({ title, note, fields = "", confirmLabel = "Confirm", danger = false, onConfirm }) {
  closeArchiveModal();
  document.body.insertAdjacentHTML("beforeend", `<div class="modal-backdrop" id="archive-action-backdrop" role="dialog" aria-modal="true"><div class="modal archive-action-modal"><div class="modal-head"><div><p class="eyebrow">Archive</p><h2>${formatSettingValue(title)}</h2></div><button class="icon-button" data-archive-modal-close type="button">Close</button></div><form class="modal-form" id="archive-action-form"><p class="modal-note ${danger ? "" : "archive-modal-note"}">${formatSettingValue(note)}</p>${fields}<div class="modal-error" id="archive-action-error" aria-live="polite"></div><div class="modal-actions"><button class="secondary-button" data-archive-modal-close type="button">Cancel</button><button class="${danger ? "danger-button" : "primary-button"}" type="submit">${formatSettingValue(confirmLabel)}</button></div></form></div></div>`);
  document.body.classList.add("modal-open");
  document.getElementById("archive-action-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const submit = event.submitter;
    submit.disabled = true;
    try { await onConfirm(event.currentTarget); closeArchiveModal(); } catch (error) {
      const dependencyText = readableDependencies(archiveDependencies(error));
      document.getElementById("archive-action-error").textContent = `${error.message || "The action failed."}${dependencyText}`;
      submit.disabled = false;
    }
  });
}

function confirmArchiveActive(type, id, name) {
  if (!isAdmin()) return;
  showArchiveModal({
    title: `Archive ${name}`,
    note: `Archive this ${type}? It will leave active operational views and can be restored later.`,
    fields: `<label class="full"><span>Archive reason (optional)</span><textarea id="archive-reason" placeholder="Why is this record being archived?"></textarea></label>`,
    confirmLabel: "Archive",
    onConfirm: async () => {
      const reason = document.getElementById("archive-reason").value.trim();
      await (type === "site" ? window.QatarOpsApi.Sites.archive(id, reason) : window.QatarOpsApi.Chargers.archive(id, reason));
      state.archive.feedback = `${name} was archived successfully.`;
      if (type === "charger") state.currentChargerId = "";
      await Promise.all([loadOperationalData(), loadArchiveData()]);
      document.getElementById("site-profile")?.classList.add("hidden");
      document.getElementById("charger-profile")?.classList.add("hidden");
    },
  });
}

function confirmArchiveRestore(type, id, name) {
  showArchiveModal({ title: `Restore ${name}`, note: `Restore this ${type} to active operational views?`, confirmLabel: "Restore", onConfirm: async () => {
    await (type === "site" ? window.QatarOpsApi.Sites.restore(id) : window.QatarOpsApi.Chargers.restore(id));
    state.archive.feedback = `${name} was restored successfully.`;
    await Promise.all([loadArchiveData(), loadOperationalData()]);
    renderSettings("Archive");
  } });
}

function confirmArchiveDelete(type, id, name) {
  showArchiveModal({
    title: `Permanently delete ${name}`,
    note: `This permanently deletes the archived ${type} and cannot be undone. Type DELETE or the exact item name to continue.`,
    danger: true,
    fields: `<label class="full"><span>Confirmation</span><input id="archive-delete-confirmation" autocomplete="off" /></label>`,
    confirmLabel: "Delete Permanently",
    onConfirm: async () => {
      const confirmation = document.getElementById("archive-delete-confirmation").value.trim();
      if (confirmation !== "DELETE" && confirmation !== name) throw new Error("Enter DELETE or the exact item name to confirm permanent deletion.");
      await (type === "site" ? window.QatarOpsApi.Sites.deleteArchived(id) : window.QatarOpsApi.Chargers.deleteArchived(id));
      state.archive.feedback = `${name} was permanently deleted.`;
      await Promise.all([loadArchiveData(), loadOperationalData()]);
      renderSettings("Archive");
    },
  });
}

function showArchiveDetails(type, id) {
  const item = state.archive[type === "site" ? "sites" : "chargers"].find((record) => record.id === id);
  if (!item) return;
  const ignored = new Set(["id", "archived_by"]);
  const fields = Object.entries(item).filter(([key]) => !ignored.has(key)).map(([key, value]) => `<div class="settings-info-item"><span>${archiveText(key.replaceAll("_", " "))}</span><strong>${key.endsWith("_at") ? archiveDate(value) : archiveValue(value)}</strong></div>`).join("");
  showArchiveModal({ title: item.name, note: `Archived ${type} details`, fields: `<div class="settings-info-grid full">${fields}</div>`, confirmLabel: "Close", onConfirm: async () => {} });
}
