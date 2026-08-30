let requestFaultOptions = [];
let selectedRequestFaultId = "";

function requestFaultVisitMarkup(fault) {
  const visits = fault?.related_site_visits || [];
  return `<div class="request-linked-visits"><div><h4>Linked Site Visits</h4><small>From the selected Fault</small></div>${visits.length ? visits.map((visit) => `<article><div><strong>${requestText(formatMediumDate(visit.visit_date))}${visit.time_in || visit.time_out ? ` • ${requestText(visit.time_in || "—")}–${requestText(visit.time_out || "—")}` : ""}</strong><span>${requestText(visit.purpose || visit.visit_type || "Site Visit")}</span><small>${requestText(requestLabel(visit.status || visit.visit_status || visit.status_after_visit || ""))}${visit.engineer ? ` • ${requestText(visit.engineer)}` : ""}</small></div><button class="secondary-button" data-visit-detail="${requestText(visit.site_visit_id || visit.id)}" type="button">View Visit</button></article>`).join("") : `<p class="request-muted">No Site Visits linked to this Fault yet.</p>`}</div>`;
}

function renderRequestFaultSelection() {
  const target = document.getElementById("request-fault-selection");
  if (!target) return;
  const fault = requestFaultOptions.find((item) => item.id === selectedRequestFaultId);
  target.innerHTML = fault ? `<article class="request-selected-fault"><header><div><strong>${requestText(fault.fault_reference)} • ${requestText(fault.title)}</strong><small>${requestText(fault.site_name)}${fault.charger_name ? ` • ${requestText(fault.charger_name)}` : ""}</small></div><span class="request-pill status-${requestText(fault.status)}">${requestText(requestLabel(fault.status))}</span></header><div class="request-fault-actions"><button class="secondary-button" data-fault-detail="${requestText(fault.id)}" type="button">View Fault</button><button class="secondary-button" id="remove-request-fault" type="button">× Remove</button></div></article>${requestFaultVisitMarkup(fault)}` : `<p class="request-muted">No related Fault selected.</p>`;
}

function filterRequestFaultCards() {
  const query = document.getElementById("request-fault-search")?.value.trim().toLowerCase() || "";
  document.querySelectorAll("[data-request-fault-card]").forEach((card) => { card.classList.toggle("hidden", Boolean(query) && !card.dataset.requestFaultSearch.includes(query)); });
}

function renderRequestFaultPicker() {
  const picker = document.getElementById("request-fault-picker");
  if (!picker) return;
  const siteId = document.getElementById("request-site")?.value || "";
  const chargerId = document.getElementById("request-charger")?.value || "";
  const faults = requestFaultOptions.filter((fault) => !siteId || fault.site_id === siteId).sort((a, b) => Number(b.charger_id === chargerId) - Number(a.charger_id === chargerId));
  picker.innerHTML = `<label><span class="sr-only">Search Faults</span><input id="request-fault-search" type="search" placeholder="Search Fault ID, title, status, site or charger" /></label><div class="request-fault-picker-list">${faults.length ? faults.map((fault) => { const search = [fault.fault_reference, fault.title, fault.status, fault.site_name, fault.charger_name].join(" ").toLowerCase(); return `<button class="request-fault-card${fault.id === selectedRequestFaultId ? " is-selected" : ""}" data-request-fault-card="${requestText(fault.id)}" data-request-fault-search="${requestText(search)}" type="button"><span><strong>${requestText(fault.fault_reference)}</strong><em>${requestText(requestLabel(fault.status))}</em></span><b>${requestText(fault.title)}</b><small>${requestText(fault.site_name)}${fault.charger_name ? ` • ${requestText(fault.charger_name)}` : ""}</small>${fault.description ? `<p>${requestText(fault.description.slice(0, 140))}</p>` : ""}</button>`; }).join("") : `<p class="request-muted">No active Faults are available for the selected Site.</p>`}</div>`;
}

async function initializeRequestFaultSelector(item = {}) {
  selectedRequestFaultId = item.fault_id || "";
  const response = await window.QatarOpsApi.Faults.list({ limit: 500 });
  requestFaultOptions = response.faults || [];
  renderRequestFaultSelection();
}

function requestFormFields(item = {}, hqMode = false) {
  const siteId = item.site_id || "";
  if (hqMode) return `<div class="request-readonly full">${requestDetailFacts(item, true)}</div>
    <label><span>Status</span><select id="request-status">${window.QatarOpsRequests.statuses.map(({ value }) => requestOption(value, item.status)).join("")}</select></label>
    <label class="full"><span>HQ Response</span><textarea id="request-hq-response" rows="7" placeholder="Enter the official response to Qatar Operations">${requestText(item.hq_response || "")}</textarea></label>
    <label class="full"><span>Response Attachments</span><input id="request-files" type="file" multiple /><small>Supporting files use the managed Request attachment storage.</small></label>`;
  return `
    <label class="full"><span>Title *</span><input id="request-title" type="text" value="${requestText(item.title || "")}" required /></label>
    <label class="full"><span>Description *</span><textarea id="request-description" rows="6" required>${requestText(item.description || "")}</textarea></label>
    <label><span>Category</span><select id="request-category"><option value="">Select category</option>${REQUEST_CATEGORIES.map((v) => requestOption(v, item.category)).join("")}</select></label>
    <label><span>Priority *</span><select id="request-priority">${REQUEST_PRIORITIES.map((v) => requestOption(v, item.priority || "medium")).join("")}</select></label>
    <label><span>Site</span><select id="request-site"><option value="">No site</option>${siteOptions(siteId)}</select></label>
    <label><span>Charger</span><select id="request-charger"${siteId ? "" : " disabled"}><option value="">No charger</option>${chargerOptions(siteId, item.charger_id)}</select></label>
    <label><span>Assigned To HQ</span><select id="request-assigned"><option value="">Unassigned</option>${hqUserOptions(item.assigned_to)}</select></label>
    <label><span>Due Date</span><input id="request-due-date" type="date" value="${requestText(item.due_date || "")}" /></label>
    <label class="full"><span>Request Attachments</span><input id="request-files" type="file" multiple /></label>
    <section class="request-fault-section full"><div class="request-fault-heading"><div><h3>Related Fault</h3><p>Attach the fault related to this request. Any Site Visits linked to that Fault will appear automatically.</p></div><button class="secondary-button" id="select-request-fault" type="button">+ Select Fault</button></div><div id="request-fault-selection"></div><div id="request-fault-picker" class="request-fault-picker hidden"></div></section>`;
}

function openRequestModal(item = null) {
  if (!isAdmin() || !window.QatarOpsRequests.canAccess()) return;
  const form = document.getElementById("modal-form");
  form.dataset.requestId = item?.id || "";
  form.dataset.requestMode = item ? "admin-edit" : "create";
  document.querySelector(".modal")?.classList.add("request-modal");
  document.getElementById("modal-title").textContent = item ? "Edit Request" : "New Request";
  document.getElementById("modal-eyebrow").textContent = "Operations Requests";
  form.innerHTML = `<div class="modal-error" id="modal-error" aria-live="polite"></div>${requestFormFields(item || {})}<div class="modal-actions"><button class="secondary-button" id="cancel-modal" type="button">Cancel</button><button class="primary-button" type="submit">${item ? "Save Changes" : "Create Request"}</button></div>`;
  document.getElementById("modal-backdrop").classList.remove("hidden");
  initializeRequestFaultSelector(item || {}).catch((error) => { const target = document.getElementById("request-fault-selection"); if (target) target.innerHTML = `<p class="modal-error">${requestText(error.message)}</p>`; });
}

async function uploadRequestFiles(requestId) {
  const files = Array.from(document.getElementById("request-files")?.files || []);
  for (const file of files) await window.QatarOpsApi.Attachments.upload("requests", requestId, file);
}

async function submitRequestForm(form) {
  const errorBox = document.getElementById("modal-error");
  if (errorBox) errorBox.textContent = "";
  const button = form.querySelector("button[type='submit']");
  if (button) button.disabled = true;
  try {
    let request;
    if (form.dataset.requestMode === "delete") {
      if (document.getElementById("request-delete-confirmation").value !== "DELETE") throw new Error("Type DELETE exactly to confirm deletion.");
      await window.QatarOpsApi.Requests.remove(form.dataset.requestId);
      closeModal();
      await loadRequestsPageFresh();
      return;
    } else if (form.dataset.requestMode === "status-edit") {
      const status = document.getElementById("request-status").value;
      request = (await window.QatarOpsApi.Requests.update(form.dataset.requestId, { status })).request;
    } else if (form.dataset.requestMode === "hq-edit") {
      const status = document.getElementById("request-status").value;
      const hqResponse = document.getElementById("request-hq-response").value.trim();
      if (status === "completed" && !hqResponse) throw new Error("HQ Response is required before completing a request.");
      request = (await window.QatarOpsApi.Requests.update(form.dataset.requestId, { status, hq_response: hqResponse || null })).request;
    } else {
      const title = document.getElementById("request-title").value.trim();
      const description = document.getElementById("request-description").value.trim();
      if (!title || !description) throw new Error("Title and Description are required.");
      const payload = { title, description, category: document.getElementById("request-category").value || null,
        priority: document.getElementById("request-priority").value, site_id: document.getElementById("request-site").value || null,
        charger_id: document.getElementById("request-charger").value || null, assigned_to: document.getElementById("request-assigned").value || null,
        due_date: document.getElementById("request-due-date").value || null, fault_id: selectedRequestFaultId || null };
      request = form.dataset.requestMode === "admin-edit"
        ? (await window.QatarOpsApi.Requests.update(form.dataset.requestId, payload)).request
        : (await window.QatarOpsApi.Requests.create(payload)).request;
    }
    if (form.dataset.requestMode !== "status-edit") await uploadRequestFiles(request.id);
    await loadRequestsPageFresh();
    if (["hq-edit", "status-edit"].includes(form.dataset.requestMode)) await openRequestDetails(request.id);
    else closeModal();
  } catch (error) {
    if (errorBox) errorBox.textContent = error.message || "The request could not be saved.";
  } finally {
    if (button) button.disabled = false;
  }
}
