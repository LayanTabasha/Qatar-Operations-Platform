function baseFaultRecords() {
  return state.faults.filter((fault) => (!state.currentSiteName || fault.siteName === state.currentSiteName) && (!state.currentChargerId || fault.chargerId === state.currentChargerId));
}

function filteredFaultRecords() {
  const filters = moduleFilters("Faults");
  return baseFaultRecords().filter((fault) => includesFilterText([fault.faultId, fault.faultCode, fault.faultName, fault.title, fault.description, fault.siteName, fault.chargerName, fault.severity, fault.status], filters.search)
    && (!filters.charger || String(fault.chargerId || fault.chargerName || "") === filters.charger)
    && (!filters.date || String(fault.reportedAt || "").slice(0, 10) === filters.date)
    && (!filters.status || normalizedFilterText(fault.status) === normalizedFilterText(filters.status))
    && (!filters.faultCode || normalizedFilterText(fault.faultCode) === normalizedFilterText(filters.faultCode)));
}

function faultRecordRows() {
  const records = filteredFaultRecords();
  if (!records.length) return `<tr><td colspan="10">No fault records entered yet.</td></tr>`;
  return records.map((fault) => `<tr>
    <td>${valueOrPlaceholder(fault.faultId)}</td>
    <td>${formatDate(fault.reportedAt)}</td>
    <td>${valueOrPlaceholder(fault.siteName)}</td>
    <td>${valueOrPlaceholder(fault.chargerName)}</td>
    <td>${fault.faultCode ? safeDetailValue(fault.faultCode) : "—"}</td>
    <td>${valueOrPlaceholder(fault.faultName)}</td>
    <td>${normalizedFaultSeverity(fault.severity)}</td>
    <td>${canManageOperations() ? `<select class="inline-select" data-fault-status="${fault.id}">${FAULT_STATUS_OPTIONS.map((status) => `<option${status === fault.status ? " selected" : ""}>${status}</option>`).join("")}</select>` : safeDetailValue(fault.status)}</td>
    <td>${faultPhotosMarkup(fault)}</td>
    <td><div class="file-actions"><button class="secondary-button" data-fault-detail="${fault.id}" type="button">View Details</button>${canManageOperations() ? `<button class="secondary-button" data-modal="fault" data-mode="edit" data-fault-id="${fault.id}" type="button">Edit</button><button class="danger-button" data-operational-delete="${fault.id}" data-delete-type="fault" type="button">Delete</button>` : ""}</div></td>
  </tr>`).join("");
}

function faultPhotosMarkup(fault) {
  const files = getValidUploads().filter((file) => file.faultId === fault.faultId && file.module === "fault");
  if (!files.length) return "No photos attached";
  return `<div class="fault-photo-list">${files.map((file) => `<div class="fault-photo-item">${file.dataUrl ? `<img src="${file.dataUrl}" alt="${safeDetailValue(file.name || "Fault photo")}" />` : ""}<span>${safeDetailValue(file.name || "Fault photo")}</span><div class="file-actions"><button class="secondary-button" data-file-preview="${file.id}" type="button">View</button><button class="secondary-button" data-file-download="${file.id}" type="button">Download</button></div></div>`).join("")}</div>`;
}
