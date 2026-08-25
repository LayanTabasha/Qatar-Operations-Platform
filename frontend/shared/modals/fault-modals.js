let faultCatalogueSearchTimer = null;
function faultFormSection(title, body) {
  return `<section class="fault-form-section full"><h3>${title}</h3><div class="fault-form-grid">${body}</div></section>`;
}
function faultFormMarkup() {
  const siteOptions = state.sites.map((site) => `<option value="${site.id}">${safeDetailValue(site.name)}</option>`).join("");
  const categories = ["Connectivity / Wi-Fi", "Screen or interface", "Charging issue", "Connector or cable", "Power or electrical", "Physical damage", "Software or system", "DTC / technical alarm", "Other"];
  const now = new Date();
  const location = `<label><span>Site <b>Required</b></span><select id="site" data-required="true">${siteOptions}</select></label>${chargerSelectMarkup("Charger", "charger", ' data-required="true"')}`;
  const happened = `<label><span>Fault date <b>Required</b></span><input id="date-reported" type="date" value="${now.toISOString().slice(0, 10)}" data-required="true" /></label><label><span>Fault time <b>Required</b></span><input id="time-reported" type="time" value="${now.toTimeString().slice(0, 5)}" data-required="true" /></label><label><span>Reported by <b>Required</b></span><input id="reported-by" value="${safeDetailValue(state.currentUser)}" data-required="true" /></label><label><span>Fault category <b>Required</b></span><select id="fault-category" data-required="true">${categories.map((item) => `<option>${item}</option>`).join("")}</select></label><label class="full"><span>Short fault title <b>Required</b></span><input id="fault-title" placeholder="Example: Charger screen flickering" data-required="true" /></label><label class="full"><span>Description / what happened <b>Required</b></span><textarea id="description" rows="4" data-required="true"></textarea></label>`;
  const impact = `<label><span>Current charger status</span><select id="current-charger-status"><option>Active</option><option>Offline</option><option>Faulted</option><option>Maintenance</option><option>Inactive</option></select></label><label><span>Priority</span><select id="priority"><option>Low</option><option selected>Medium</option><option>High</option><option>Critical</option></select></label><label><span>Severity</span><select id="severity"><option>Low</option><option selected>Medium</option><option>High</option><option>Critical</option><option>Not Classified</option></select><small>Select the technical impact of the fault.</small></label><label><span>Site visit required</span><select id="site-visit-required"><option selected>No</option><option>Yes</option></select></label>`;
  const photos = `<label class="full"><span>Photos <small>Optional</small></span><input id="photo-evidence" type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" multiple /><small>JPG, PNG, or WebP. Existing photos are preserved when editing.</small></label>`;
  const technical = `<details class="fault-technical-details full"><summary>Technical Details <small>Optional</small></summary><div class="fault-form-grid"><label><span>Is a DTC or technical error code available?</span><select id="has-technical-code"><option selected>No</option><option>Yes</option></select></label><div id="technical-code-fields" class="fault-form-grid full hidden">${fieldMarkup("DTC Catalogue", "fault-catalogue-search")}<label><span>DTC code</span><input id="dtc-code" /></label><label><span>FTB code</span><input id="ftb-code" /></label><label><span>Component / ECU</span><input id="component-ecu" /></label><label><span>Technical category</span><input id="technical-category" /></label><label class="full"><span>Technical fault description</span><textarea id="catalogue-description" rows="3"></textarea></label><label class="full"><span>Possible causes</span><textarea id="catalogue-possible-causes" rows="3"></textarea></label><label class="full"><span>Recommended repair action</span><textarea id="catalogue-recommended-actions" rows="3"></textarea></label></div></div></details>`;
  const followUp = `<label><span>Fault status</span><select id="fault-status">${FAULT_STATUS_OPTIONS.map((status) => `<option>${status}</option>`).join("")}</select></label><label class="full"><span>Possible Causes <small>Optional</small></span><textarea id="possible-causes" rows="3" placeholder="Enter suspected cause(s) of the fault..."></textarea></label><label class="full"><span>Recommended Actions <small>Optional</small></span><textarea id="recommended-actions" rows="3" placeholder="Enter recommended troubleshooting or repair actions..."></textarea></label><label class="full"><span>Follow-up Notes <small>Optional</small></span><textarea id="comments" rows="3"></textarea></label><div id="fault-resolution-details" class="fault-form-grid full hidden"><div class="full"><h4>Resolution Details</h4></div><label class="full"><span>Confirmed Cause <b>Required</b></span><textarea id="confirmed-cause" rows="3" placeholder="Enter the confirmed cause of the fault..."></textarea></label><label class="full"><span>Resolution / Action Taken <b>Required</b></span><textarea id="resolution-action-taken" rows="3" placeholder="Describe the action taken to resolve the fault..."></textarea></label><label class="full"><span>Resolution Notes <small>Optional</small></span><textarea id="resolution-notes" rows="3"></textarea></label></div><input id="generated-fault-id" type="hidden" value="${nextFaultId()}" />`;
  return faultFormSection("A. Fault Location", location) + faultFormSection("B. What Happened?", happened) + faultFormSection("C. Impact and Priority", impact) + faultFormSection("D. Photos", photos) + faultFormSection("E. Technical Details — optional", technical) + faultFormSection("F. Follow-up and Resolution", followUp);
}

function siteFromFaultSelection(value) {
  return state.sites.find((site) => site.id === value || site.name === value);
}

function toggleFaultTechnicalDetails() {
  const enabled = document.getElementById("has-technical-code")?.value === "Yes";
  document.getElementById("technical-code-fields")?.classList.toggle("hidden", !enabled);
  if (!enabled) {
    const selectedId = document.getElementById("fault-catalogue-id");
    if (selectedId) selectedId.value = "";
  }
}

function toggleFaultResolutionDetails() {
  const resolved = document.getElementById("fault-status")?.value === "Resolved";
  document.getElementById("fault-resolution-details")?.classList.toggle("hidden", !resolved);
}

function nextFaultId() {
  const year = new Date().getFullYear();
  const maxForYear = state.faults
    .map((fault) => fault.faultId || "")
    .filter((id) => id.startsWith(`FLT-${year}-`))
    .map((id) => Number(id.split("-").pop()))
    .filter((number) => Number.isFinite(number))
    .reduce((max, number) => Math.max(max, number), 0);
  return `FLT-${year}-${String(maxForYear + 1).padStart(4, "0")}`;
}

function selectedFaultCatalogueItem(selectId = "fault-code") {
  const selectedId = document.getElementById("fault-catalogue-id")?.value || document.getElementById(selectId)?.value || "";
  return state.faultCatalogue.find((item) => item.id === selectedId);
}

function renderFaultCodeDetails(selectId = "fault-code") {
  const panel = document.getElementById("fault-code-details");
  if (!panel) return;
  const item = selectedFaultCatalogueItem(selectId);
  panel.innerHTML = item
    ? `<span>DTC / FTB</span><strong>${valueOrPlaceholder(item.faultCode)}${item.ftbCode ? ` / ${safeDetailValue(item.ftbCode)}` : ""}</strong><span>Fault Title</span><strong>${valueOrPlaceholder(item.faultName)}</strong><span>ECU / Component</span><p>${valueOrPlaceholder(item.component)}</p><span>Category / Severity</span><p>${valueOrPlaceholder(item.category)} / ${valueOrPlaceholder(item.severity)}</p><span>Catalogue Description</span><p>${valueOrPlaceholder(item.meaning)}</p><span>Possible Causes</span><p>${valueOrPlaceholder(item.possibleCauses)}</p><span>Recommended Action</span><p>${valueOrPlaceholder(item.recommendedAction)}</p><span>Manufacturer Data</span><p>${safeDetailValue(JSON.stringify(item.manufacturerData || {}))}</p>`
    : `<span>Fault Title</span><strong>Unknown / No DTC Code</strong><span>Catalogue Description</span><p>No catalogue record selected.</p><span>Possible Causes</span><p>Not Available Yet</p><span>Recommended Action</span><p>Not Available Yet</p>`;
}

function faultCatalogueResultMarkup(records) {
  if (!records.length) return `<p>No matching DTC records found. You can continue recording the fault manually.</p>`;
  return records.slice(0, 20).map((item) => `<button class="dtc-catalogue-result" data-dtc-select="${item.id}" type="button"><strong>${safeDetailValue(item.faultCode)}${item.ftbCode ? ` / ${safeDetailValue(item.ftbCode)}` : ""}</strong><span>${safeDetailValue(item.component || "No ECU")} · ${safeDetailValue(item.faultName)}</span></button>`).join("");
}

async function searchFaultCatalogue(value) {
  const results = document.getElementById("dtc-catalogue-results");
  if (!results) return;
  const query = value.trim();
  if (!query) { results.innerHTML = ""; return; }
  results.innerHTML = `<p>Searching catalogue…</p>`;
  try {
    const response = await window.QatarOpsApi.Dtc.list({ query, status: "active", limit: 100 });
    const records = (response.dtc_records || []).map(normalizeFaultCatalogueRecord);
    const known = new Map(state.faultCatalogue.map((item) => [item.id, item]));
    records.forEach((item) => known.set(item.id, item));
    state.faultCatalogue = Array.from(known.values());
    results.innerHTML = faultCatalogueResultMarkup(records);
  } catch (error) {
    results.innerHTML = `<p>The DTC catalogue is temporarily unavailable. You can continue recording the fault manually.</p>`;
  }
}

function queueFaultCatalogueSearch(value) {
  clearTimeout(faultCatalogueSearchTimer);
  const selectedId = document.getElementById("fault-catalogue-id");
  if (selectedId) selectedId.value = "";
  faultCatalogueSearchTimer = setTimeout(() => searchFaultCatalogue(value), 250);
}

function selectFaultCatalogueRecord(id) {
  const item = state.faultCatalogue.find((record) => record.id === id);
  if (!item) return;
  setFieldValue("fault-catalogue-id", item.id);
  setFieldValue("dtc-catalogue-search", `${item.faultCode}${item.ftbCode ? ` / ${item.ftbCode}` : ""} — ${item.faultName}`);
  setFieldValue("dtc-code", item.faultCode); setFieldValue("ftb-code", item.ftbCode);
  setFieldValue("component-ecu", item.component); setFieldValue("fault-title", item.faultName);
  setFieldValue("catalogue-description", item.meaning); setFieldValue("catalogue-possible-causes", item.possibleCauses);
  setFieldValue("catalogue-recommended-actions", item.recommendedAction); setFieldValue("possible-causes", item.possibleCauses);
  setFieldValue("recommended-actions", item.recommendedAction); setFieldValue("severity", normalizedFaultSeverity(item.severity, "Medium"));
  setFieldValue("technical-category", item.category);
  const results = document.getElementById("dtc-catalogue-results");
  if (results) results.innerHTML = "";
}
