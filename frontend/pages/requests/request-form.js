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
    <label class="full"><span>Request Attachments</span><input id="request-files" type="file" multiple /></label>`;
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
        due_date: document.getElementById("request-due-date").value || null };
      request = form.dataset.requestMode === "admin-edit"
        ? (await window.QatarOpsApi.Requests.update(form.dataset.requestId, payload)).request
        : (await window.QatarOpsApi.Requests.create(payload)).request;
    }
    await uploadRequestFiles(request.id);
    await loadRequestsPageFresh();
    if (form.dataset.requestMode === "hq-edit") await openRequestDetails(request.id);
    else closeModal();
  } catch (error) {
    if (errorBox) errorBox.textContent = error.message || "The request could not be saved.";
  } finally {
    if (button) button.disabled = false;
  }
}
