function renderContactsPage() {
  const contactsPage = document.getElementById("contacts");
  if (!contactsPage) return;

  contactsPage.innerHTML = `
          <div class="page-title-row">
            <div><p class="eyebrow">Directory</p><h1>Contacts</h1></div>
            <button class="primary-button" data-modal="contact" type="button">Add Contact</button>
          </div>
          <div class="toolbar"><input type="search" placeholder="Search contacts" /><select><option>Filter by role</option></select><select><option>Filter by related site</option></select></div>
          <div class="contact-grid">
            <article class="contact-card"><h2>Name</h2><p>Role</p><dl><dt>Company / Department</dt><dd>--</dd><dt>Phone</dt><dd>--</dd><dt>Email</dt><dd>--</dd><dt>Related Site</dt><dd>--</dd><dt>Notes</dt><dd>--</dd></dl><div class="card-actions"><button data-modal="contact">Edit</button><button data-modal="confirmDelete">Delete</button></div></article>
            <article class="contact-card"><h2>Name</h2><p>Role</p><dl><dt>Company / Department</dt><dd>--</dd><dt>Phone</dt><dd>--</dd><dt>Email</dt><dd>--</dd><dt>Related Site</dt><dd>--</dd><dt>Notes</dt><dd>--</dd></dl><div class="card-actions"><button data-modal="contact">Edit</button><button data-modal="confirmDelete">Delete</button></div></article>
          </div>
  `;
}

renderContactsPage();
