function contactAssociation(contact) {
  return contact.site_id ? (contact.site_name || "Unknown Site") : "Not site-specific";
}

function contactSafeValue(value) {
  const display = value === undefined || value === null || value === "" ? "--" : String(value);
  return display.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function renderContactsPage() {
  const page = document.getElementById("contacts");
  if (!page) return;
  const contacts = Array.isArray(state.contacts) ? state.contacts.filter((contact) => contact && typeof contact === "object") : [];
  const availableSites = Array.isArray(state.sites) ? state.sites.filter((site) => site && typeof site === "object") : [];
  const roles = [...new Set(contacts.map((contact) => contact.job_title).filter(Boolean))].sort();
  const cards = contacts.map((contact) => {
    const association = contactAssociation(contact);
    const associationKey = contact.site_id ? `site:${contact.site_id}` : "unassigned";
    return `<article class="contact-card" data-contact-id="${contactSafeValue(contact.id || "")}" data-role="${contactSafeValue(contact.job_title || "")}" data-association="${contactSafeValue(associationKey)}"><h2>${contactSafeValue(contact.contact_name)}</h2><p>${contactSafeValue(contact.job_title || "Not Available Yet")}</p><dl><dt>Organization / Department</dt><dd>${contactSafeValue(contact.organization)}</dd><dt>Phone</dt><dd>${contactSafeValue(contact.phone)}</dd><dt>Email</dt><dd>${contactSafeValue(contact.email)}</dd><dt>Assigned Site</dt><dd>${contactSafeValue(association)}</dd><dt>Notes</dt><dd>${contactSafeValue(contact.notes)}</dd></dl>${isAdmin() ? `<div class="card-actions"><button data-modal="contact" data-mode="edit" data-contact-id="${contactSafeValue(contact.id || "")}" type="button">Edit</button><button data-contact-delete="${contactSafeValue(contact.id || "")}" class="danger-button" type="button">Delete</button></div>` : ""}</article>`;
  }).join("");
  page.innerHTML = `<div class="page-title-row"><div><p class="eyebrow">Directory</p><h1>Contacts</h1></div>${isAdmin() ? '<button class="primary-button" data-modal="contact" data-mode="create" type="button">Add Contact</button>' : ""}</div>
    <div class="toolbar"><input id="contacts-search" type="search" placeholder="Search contacts" /><select id="contacts-role-filter"><option value="">Filter by role</option>${roles.map((role) => `<option>${contactSafeValue(role)}</option>`).join("")}</select><select id="contacts-site-filter"><option value="">All Contacts</option><option value="unassigned">Not site-specific</option>${availableSites.map((site) => `<option value="site:${contactSafeValue(site.id || "")}">${contactSafeValue(site.name || "Unknown Site")}</option>`).join("")}</select></div>
    <div class="contact-grid">${cards}</div><div id="contacts-filter-empty" class="empty-state ${cards ? "hidden" : ""}"><h2>${cards ? "No contacts match the selected filters" : "No contacts yet"}</h2><p>${cards ? "Try a different search, role, or assigned site." : "Add a contact to build the directory."}</p></div>`;
  document.getElementById("contacts-search")?.addEventListener("input", filterContacts);
  document.getElementById("contacts-role-filter")?.addEventListener("change", filterContacts);
  document.getElementById("contacts-site-filter")?.addEventListener("change", filterContacts);
}

function filterContacts() {
  const query = document.getElementById("contacts-search")?.value.trim().toLowerCase() || "";
  const role = document.getElementById("contacts-role-filter")?.value.toLowerCase() || "";
  const association = document.getElementById("contacts-site-filter")?.value || "";
  let visible = 0;
  document.querySelectorAll("#contacts .contact-card").forEach((card) => {
    const matches = (!query || card.textContent.toLowerCase().includes(query)) && (!role || card.dataset.role.toLowerCase() === role) && (!association || card.dataset.association === association);
    card.classList.toggle("hidden", !matches); if (matches) visible += 1;
  });
  document.getElementById("contacts-filter-empty")?.classList.toggle("hidden", visible > 0);
}

renderContactsPage();
