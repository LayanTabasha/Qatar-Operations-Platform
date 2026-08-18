import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(process.cwd(), "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const index = read("index.html");
const api = read("js/api-client.js");
const page = read("js/requests-page.js");
const auth = read("js/auth-router.js");
const settings = read("js/settings-page.js");
const state = read("js/state.js");

describe("Operations Requests frontend", () => {
  it("uses the explicit API namespace for list, detail, create, update, and delete", () => {
    expect(api).toContain("const RequestsApi");
    for (const method of ["list(params", "get(id)", "create(request)", "update(id, request)"]) expect(api).toContain(method);
    expect(api).toContain("Requests: RequestsApi");
    expect(page).toContain("window.QatarOpsApi.Requests.create(payload)");
    expect(api).toContain('remove(id) { return apiRequest(`/requests/${id}`, { method: "DELETE" })');
    expect(page).not.toContain("localStorage");
  });

  it("shows deletion only for the owning admin and requires exact DELETE", () => {
    expect(page).toContain("item.requested_by === state.authUser.id");
    expect(page).toContain('data-request-delete="');
    expect(page).toContain("Type DELETE to confirm");
    expect(page).toContain('!== "DELETE"');
    expect(page).toContain("window.QatarOpsApi.Requests.remove(form.dataset.requestId)");
    expect(page).toContain("await loadRequestsPageFresh()");
    const tableMarkup = page.slice(page.indexOf("function renderRequestResults"), page.indexOf("async function loadRequestsPage"));
    expect(tableMarkup).not.toContain("data-request-delete");
  });

  it("gates navigation and route data access to admin and HQ", () => {
    expect(index).toContain('id="requests-nav"');
    expect(state).toContain('["admin", "hq_user", "operations_staff"]');
    expect(auth).toContain('route === "requests" && !window.QatarOpsRequests.canAccess()');
    expect(page).toContain("if (!window.QatarOpsRequests.canAccess() || requestPageLoading) return");
  });

  it("gives Operations Staff the responder UI without admin create/edit controls", () => {
    expect(page).toContain('["hq_user", "operations_staff"].includes');
    expect(page).toContain("isRequestResponder()");
    expect(page).toContain('isAdmin() ? `<button class="primary-button" data-request-new');
    expect(page).toContain("if (!isAdmin() || !window.QatarOpsRequests.canAccess()) return");
  });

  it("provides admin create/edit and HQ response behavior", () => {
    expect(page).toContain('isAdmin() ? `<button class="primary-button" data-request-new');
    expect(page).toContain('form.dataset.requestMode === "hq-edit"');
    expect(page).toContain("HQ Response is required before completing a request.");
    expect(page).toContain('window.QatarOpsApi.Attachments.upload("requests", requestId, file)');
    for (const field of ["site_id", "charger_id", "assigned_to"]) expect(page).toContain(field);
  });

  it("prioritizes the Request and inline HQ response workflow", () => {
    expect(page).toContain("Description / What Qatar is requesting");
    expect(page).toContain("<h3>REQUEST</h3>");
    expect(page).toContain("<h3>HQ RESPONSE</h3>");
    expect(page).toContain("This is where you tell Qatar what you did.");
    expect(page).toContain("Awaiting response from HQ");
    expect(page).toContain("Response / Action Taken");
    expect(page).toContain("✓ HQ Responded");
    expect(page).toContain("Responded At");
  });

  it("places the response before context and keeps the timeline collapsed", () => {
    const detailMarkup = page.slice(page.indexOf('<header class="request-detail-header'));
    expect(detailMarkup.indexOf('<section class="request-response')).toBeLessThan(detailMarkup.indexOf('<section class="request-detail-section request-context'));
    expect(page).toContain('<details class="request-detail-section request-timeline-details full"><summary>Activity Timeline</summary>');
    expect(page).not.toContain('<details class="request-detail-section request-timeline-details full" open>');
  });

  it("supports inline table status updates while preserving View", () => {
    expect(page).toContain('data-request-status="');
    expect(page).toContain("updateRequestStatusFromTable(requestStatus)");
    expect(page).toContain("window.QatarOpsApi.Requests.update(requestItem.id, { status: select.value })");
    expect(page).toContain('button[data-request-view]');
  });

  it("makes Request status editable only for HQ and Operations Staff", () => {
    expect(page).toContain("const statusControl = isRequestResponder()");
    expect(page).toContain('data-request-status="');
    expect(page).toContain('`<span class="request-pill status-${requestText(item.status)}">');
    expect(page).toContain("if (!isRequestResponder()) return;");
    expect(page).not.toContain('payload.status = document.getElementById("request-status").value');
    expect(page).toContain('["hq_user", "operations_staff"].includes');
  });

  it("separates request and response files using existing attachment uploader metadata", () => {
    expect(page).toContain('["hq_user", "operations_staff"].includes(file.uploaded_by_role)');
    expect(page).toContain("requestAttachmentList(item, true)");
    expect(page).toContain("data-file-preview");
    expect(page).toContain("data-file-download");
  });

  it("renders filters, valid labels, overdue, metadata, and no forbidden workflow", () => {
    for (const filter of ["requests-search", "requests-status", "requests-priority", "requests-category", "requests-site", "requests-charger", "requests-assignee"]) expect(page).toContain(filter);
    for (const status of ["open", "in_progress", "completed"]) expect(page).toContain(status);
    for (const forbidden of ["Awaiting Verification", "Start Work", "data-request-comment", "request-chat"]) expect(page).not.toContain(forbidden);
    expect(page).toContain("requestIsOverdue");
    expect(page).toContain("responded_by_name");
    expect(page).toContain("requestTimeline");
  });

  it("adds HQ User to existing user management without redesigning it", () => {
    expect(settings).toContain('<option value="hq_user">HQ User</option>');
    expect(settings).toContain('hq_user: "HQ User"');
  });
});
