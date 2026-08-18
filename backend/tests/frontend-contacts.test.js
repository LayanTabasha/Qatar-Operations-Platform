import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { JSDOM, VirtualConsole } from "jsdom";

const root = path.resolve(process.cwd(), "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

describe("Contacts optional Site frontend", () => {
  it("removes Scope and exposes the optional Assigned Site contract", () => {
    const contacts = read("frontend/pages/contacts/contacts-page.js");
    const state = read("js/state.js");
    const modals = read("js/modals.js");
    expect(state).toContain('["Assigned Site", "select:Not site-specific"]');
    expect(state).toContain('["Organization / Department", "text"]');
    expect(state).not.toContain('["Scope"');
    expect(contacts).toContain("Not site-specific");
    expect(contacts).toContain("Assigned Site");
    expect(contacts).toContain('value="unassigned"');
    expect(contacts).not.toContain("All Sites / HQ");
    expect(contacts).not.toContain("External / No Site");
    expect(modals).toContain('site_id: site?.id || null');
    expect(modals).toContain('setFieldValue("assigned-site", contact.site_name || "")');
  });

  it("runs the Contacts lifecycle with valid and nullable Site records", () => {
    const contactsScript = read("frontend/pages/contacts/contacts-page.js");
    const errors = [];
    const virtualConsole = new VirtualConsole();
    virtualConsole.on("jsdomError", (error) => errors.push(error));
    const dom = new JSDOM(`<!doctype html><section id="contacts"></section>
      <script>var state={contacts:[],sites:[{id:"site-1",name:"Msheireb"},{id:"site-2",name:"Al Mana"}]};function canManageOperations(){return true;}</script>
      <script>${contactsScript}</script>`, { runScripts: "dangerously", virtualConsole });
    dom.window.state.contacts = [
      { id: "contact-site", contact_name: "Site Technician", job_title: "Site Technician", organization: "Zeeda Energy", site_id: "site-1", site_name: "Msheireb" },
      { id: "contact-hq", contact_name: "HQ Contact", job_title: "HQ Admin", organization: "Operations", site_id: null, site_name: null },
      { id: "contact-external", contact_name: "Vendor", job_title: "External Operator", organization: "Vendor Co", site_id: null, site_name: null },
    ];
    dom.window.renderContactsPage();

    expect(errors).toEqual([]);
    expect(dom.window.document.querySelectorAll(".contact-card")).toHaveLength(3);
    expect(dom.window.document.body.textContent).toContain("Msheireb");
    expect([...dom.window.document.querySelectorAll(".contact-card")].filter((card) => card.textContent.includes("Not site-specific"))).toHaveLength(2);
    expect(dom.window.document.body.textContent).not.toContain("Scope");
    expect(dom.window.document.querySelector("#contacts-search")).not.toBeNull();
    expect(dom.window.document.querySelector("#contacts-site-filter")).not.toBeNull();

    const search = dom.window.document.querySelector("#contacts-search");
    search.value = "vendor co";
    search.dispatchEvent(new dom.window.Event("input"));
    expect([...dom.window.document.querySelectorAll(".contact-card:not(.hidden)")].map((card) => card.dataset.contactId)).toEqual(["contact-external"]);

    search.value = "";
    search.dispatchEvent(new dom.window.Event("input"));
    const filter = dom.window.document.querySelector("#contacts-site-filter");
    filter.value = "unassigned";
    filter.dispatchEvent(new dom.window.Event("change"));
    expect([...dom.window.document.querySelectorAll(".contact-card:not(.hidden)")].map((card) => card.dataset.contactId)).toEqual(["contact-hq", "contact-external"]);
    filter.value = "site:site-1";
    filter.dispatchEvent(new dom.window.Event("change"));
    expect([...dom.window.document.querySelectorAll(".contact-card:not(.hidden)")].map((card) => card.dataset.contactId)).toEqual(["contact-site"]);
  });

  it("opens Add/Edit forms with the correct optional Site selection", () => {
    const stateScript = read("js/state.js");
    const contactsScript = read("frontend/pages/contacts/contacts-page.js");
    const modalsScript = read("js/modals.js");
    const virtualConsole = new VirtualConsole();
    const errors = [];
    virtualConsole.on("jsdomError", (error) => errors.push(error));
    const dom = new JSDOM(`<!doctype html><section id="contacts"></section><div id="modal-backdrop" class="hidden"><div class="modal"><h2 id="modal-title"></h2><p id="modal-eyebrow"></p><form id="modal-form"></form></div></div>
      <script>HTMLElement.prototype.scrollTo=function(){};</script><script>${stateScript}</script><script>${contactsScript}</script><script>${modalsScript}</script>
      <script>
        state.currentUserRoleKey="operations_staff";
        state.sites=[{id:"site-1",name:"Msheireb",chargers:[]}];
        openModal("contact","create");
        document.body.dataset.createSite=document.getElementById("assigned-site").value;
        document.body.dataset.hasScope=String(Boolean(document.getElementById("scope")));
        state.contacts=[{id:"contact-null",contact_name:"HQ Admin",job_title:"HQ Admin",site_id:null,site_name:null},{id:"contact-site",contact_name:"Technician",job_title:"Site Technician",site_id:"site-1",site_name:"Msheireb"}];
        state.currentContactId="contact-null"; openModal("contact","edit"); document.body.dataset.nullSite=document.getElementById("assigned-site").value;
        state.currentContactId="contact-site"; openModal("contact","edit"); document.body.dataset.selectedSite=document.getElementById("assigned-site").value;
      </script>`, { runScripts: "dangerously", virtualConsole });
    expect(errors).toEqual([]);
    expect(dom.window.document.body.dataset.createSite).toBe("");
    expect(dom.window.document.body.dataset.nullSite).toBe("");
    expect(dom.window.document.body.dataset.selectedSite).toBe("Msheireb");
    expect(dom.window.document.body.dataset.hasScope).toBe("false");
    expect(dom.window.document.querySelector("#organization-department")).not.toBeNull();
  });
});
