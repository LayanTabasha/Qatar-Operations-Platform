async function loadRequestsPageFresh() {
  requestPageLoading = false;
  requestPageError = "";
  await loadRequestsPage();
}

document.addEventListener("click", (event) => {
  if (event.target.closest("[data-requests-retry]")) loadRequestsPageFresh();
  if (event.target.closest("[data-request-new]")) openRequestModal();
  const view = event.target.closest("[data-request-view]");
  const directViewButton = event.target.closest("button[data-request-view]");
  if (view && (directViewButton || !event.target.closest("button, select, input, textarea, a"))) openRequestDetails(view.dataset.requestView);
  const edit = event.target.closest("[data-request-edit]");
  if (edit) openRequestEdit(edit.dataset.requestEdit);
  const remove = event.target.closest("[data-request-delete]");
  if (remove) openRequestDeleteConfirmation(remove.dataset.requestDelete);
  const hqEdit = event.target.closest("[data-request-hq-edit]");
  if (hqEdit) openRequestEdit(hqEdit.dataset.requestHqEdit, true);
  if (event.target.closest("#select-request-fault")) {
    const picker = document.getElementById("request-fault-picker");
    renderRequestFaultPicker();
    picker?.classList.toggle("hidden");
  }
  const faultChoice = event.target.closest("[data-request-fault-card]");
  if (faultChoice) { selectedRequestFaultId = faultChoice.dataset.requestFaultCard; renderRequestFaultSelection(); document.getElementById("request-fault-picker")?.classList.add("hidden"); }
  if (event.target.closest("#remove-request-fault")) { selectedRequestFaultId = ""; renderRequestFaultSelection(); }
});

document.addEventListener("input", (event) => {
  if (event.target.id === "request-fault-search") { filterRequestFaultCards(); return; }
  if (event.target.id !== "requests-search") return;
  requestFilters.search = event.target.value;
  updateRequestResults();
});

document.addEventListener("change", (event) => {
  const requestPriority = event.target.closest("[data-request-priority]");
  if (requestPriority) {
    updateRequestPriorityFromTable(requestPriority);
    return;
  }
  const requestStatus = event.target.closest("[data-request-status]");
  if (requestStatus) {
    updateRequestStatusFromTable(requestStatus);
    return;
  }
  const filterMap = { "requests-status": "status", "requests-priority": "priority", "requests-category": "category", "requests-site": "site_id", "requests-charger": "charger_id", "requests-assignee": "assigned_to" };
  if (filterMap[event.target.id]) {
    requestFilters[filterMap[event.target.id]] = event.target.value;
    if (event.target.id === "requests-site") { requestFilters.charger_id = ""; renderRequestsPage(); }
    else updateRequestResults();
  }
  if (event.target.id === "request-site") {
    const charger = document.getElementById("request-charger");
    charger.disabled = !event.target.value;
    charger.innerHTML = `<option value="">No charger</option>${chargerOptions(event.target.value)}`;
    const selectedFault = requestFaultOptions.find((fault) => fault.id === selectedRequestFaultId);
    if (selectedFault && event.target.value && selectedFault.site_id !== event.target.value) { selectedRequestFaultId = ""; renderRequestFaultSelection(); }
    if (!document.getElementById("request-fault-picker")?.classList.contains("hidden")) renderRequestFaultPicker();
  }
  if (event.target.id === "request-charger" && !document.getElementById("request-fault-picker")?.classList.contains("hidden")) renderRequestFaultPicker();
});

document.addEventListener("keydown", (event) => {
  const row = event.target.closest("tr[data-request-view]");
  if (row && ["Enter", " "].includes(event.key)) { event.preventDefault(); openRequestDetails(row.dataset.requestView); }
});
