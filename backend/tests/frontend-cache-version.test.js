import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(process.cwd(), "..");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const state = fs.readFileSync(path.join(root, "js/state.js"), "utf8");

const FRONTEND_STRUCTURE_VERSION = "20260818-frontend-structure-v1";
const HOMEPAGE_STRUCTURE_VERSION = "20260818-homepage-recent-activity-v1";
const HOME_SHARED_VERSION = "20260818-home-shared-v1";
const RECORDS_BY_SITE_VERSION = "20260818-records-by-site-v1";
const VISIT_ACTIVITY_VERSION = "20260818-visit-activity-v1";
const FAULT_STATUS_VERSION = "20260818-fault-status-v1";
const CHARGER_STATUS_VERSION = "20260818-charger-status-v1";
const RECENT_ACTIVITY_VERSION = "20260818-recent-activity-v1";
const DISPLAY_UTILS_VERSION = "20260818-display-utils-v1";
const HOMEPAGE_REQUESTS_VERSION = "20260813-homepage-requests";
const REQUESTS_BOOTSTRAP_VERSION = "20260813-requests-bootstrap";
const ROLE_PERMISSIONS_VERSION = "20260817-charger-natural-sort";
const USER_DELETE_UI_VERSION = "20260816-permanent-user-delete";
const HOMEPAGE_COMPACT_VERSION = "20260816-homepage-compact";
const CONTENT_RECORD_ACTIONS_VERSION = "20260818-legacy-content-actions-v3";
const FAULT_LIFECYCLE_VERSION = "20260818-fault-lifecycle-v1";
const MOVED_FRONTEND_SCRIPTS = [
  "frontend/pages/contacts/contacts-page.js",
  "frontend/shared/files/file-preview.js",
  "frontend/pages/settings/archive-page.js",
];

function browserScriptSources() {
  return Array.from(index.matchAll(/<script\s+src="([^"]+)"/g), (match) => match[1]);
}

describe("frontend cache-version integrity", () => {
  it("uses the coherent cache token for every moved frontend script", () => {
    const sources = browserScriptSources();

    for (const script of MOVED_FRONTEND_SCRIPTS) {
      expect(sources, `${script} must be browser-loaded with the current cache token`).toContain(
        `${script}?v=${FRONTEND_STRUCTURE_VERSION}`,
      );
    }
  });

  it("loads state before scripts that consume its normalization helpers", () => {
    const sources = browserScriptSources();
    const stateIndex = sources.indexOf(`js/state.js?v=${FAULT_LIFECYCLE_VERSION}`);
    const displayUtilsIndex = sources.indexOf(`frontend/shared/utils/display-utils.js?v=${DISPLAY_UTILS_VERSION}`);
    const homeSharedIndex = sources.indexOf(`frontend/pages/homepage/home-shared.js?v=${HOME_SHARED_VERSION}`);
    const recordsBySiteIndex = sources.indexOf(`frontend/pages/homepage/records-by-site.js?v=${RECORDS_BY_SITE_VERSION}`);
    const visitActivityIndex = sources.indexOf(`frontend/pages/homepage/visit-activity.js?v=${VISIT_ACTIVITY_VERSION}`);
    const faultStatusIndex = sources.indexOf(`frontend/pages/homepage/fault-status.js?v=${FAULT_STATUS_VERSION}`);
    const chargerStatusIndex = sources.indexOf(`frontend/pages/homepage/charger-status.js?v=${CHARGER_STATUS_VERSION}`);
    const recentActivityIndex = sources.indexOf(`frontend/pages/homepage/recent-activity.js?v=${RECENT_ACTIVITY_VERSION}`);
    const homepageIndex = sources.indexOf(`frontend/pages/homepage/home-page.js?v=${HOMEPAGE_STRUCTURE_VERSION}`);

    expect(stateIndex).toBeGreaterThanOrEqual(0);
    expect(displayUtilsIndex).toBeGreaterThan(stateIndex);
    expect(homeSharedIndex).toBeGreaterThan(displayUtilsIndex);
    expect(recordsBySiteIndex).toBeGreaterThan(homeSharedIndex);
    expect(visitActivityIndex).toBeGreaterThan(recordsBySiteIndex);
    expect(faultStatusIndex).toBeGreaterThan(visitActivityIndex);
    expect(chargerStatusIndex).toBeGreaterThan(faultStatusIndex);
    expect(recentActivityIndex).toBeGreaterThan(chargerStatusIndex);
    expect(homepageIndex).toBeGreaterThan(recentActivityIndex);
    expect(sources.indexOf(`app.js?v=${CONTENT_RECORD_ACTIONS_VERSION}`)).toBeGreaterThan(stateIndex);
    expect(sources.indexOf(`js/sites-page.js?v=${FAULT_LIFECYCLE_VERSION}`)).toBeGreaterThan(stateIndex);
    expect(sources.indexOf(`js/api-client.js?v=${CONTENT_RECORD_ACTIONS_VERSION}`)).toBeGreaterThan(stateIndex);
    expect(sources.indexOf(`js/modals.js?v=${FAULT_LIFECYCLE_VERSION}`)).toBeGreaterThan(stateIndex);
  });

  it("pairs the post-Fault state token with the persisted Fault normalization contract", () => {
    expect(index).toContain(`js/state.js?v=${FAULT_LIFECYCLE_VERSION}`);
    expect(state).toContain("faultId = fault.faultId || fault.fault_reference");
    expect(state).toContain("siteName: fault.siteName || fault.site_name");
    expect(state).toContain("chargerId: fault.chargerId || fault.charger_id");
    expect(state).toContain("chargerName: fault.chargerName || fault.charger_name");
  });

  it("loads the Requests response UX with its current token", () => {
    expect(index).not.toContain(`styles.css?v=${HOMEPAGE_REQUESTS_VERSION}`);
    expect(index).toContain(`styles.css?v=${HOMEPAGE_COMPACT_VERSION}`);
    expect(index).toContain(`js/api-client.js?v=${CONTENT_RECORD_ACTIONS_VERSION}`);
    expect(index).toContain(`js/settings-page.js?v=${USER_DELETE_UI_VERSION}`);
    expect(index).toContain(`js/requests-page.js?v=${ROLE_PERMISSIONS_VERSION}`);
    expect(index).toContain(`js/auth-router.js?v=${REQUESTS_BOOTSTRAP_VERSION}`);
    expect(index).toContain(`frontend/pages/homepage/home-page.js?v=${HOMEPAGE_STRUCTURE_VERSION}`);
    expect(index).toContain(`js/sites-page.js?v=${FAULT_LIFECYCLE_VERSION}`);
    expect(index).toContain(`frontend/pages/contacts/contacts-page.js?v=${FRONTEND_STRUCTURE_VERSION}`);
    expect(index).toContain(`js/modals.js?v=${FAULT_LIFECYCLE_VERSION}`);
    expect(index).toContain(`app.js?v=${CONTENT_RECORD_ACTIONS_VERSION}`);
  });
});
