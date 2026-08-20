import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(process.cwd(), "..");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const state = fs.readFileSync(path.join(root, "js/state.js"), "utf8");

const FRONTEND_STRUCTURE_VERSION = "20260818-frontend-structure-v1";
const HOMEPAGE_STRUCTURE_VERSION = "20260818-homepage-kpi-orchestrator-v1";
const HOME_SHARED_VERSION = "20260818-home-shared-v1";
const RECORDS_BY_SITE_VERSION = "20260818-records-by-site-v1";
const VISIT_ACTIVITY_VERSION = "20260818-visit-activity-v1";
const FAULT_STATUS_VERSION = "20260818-fault-status-v1";
const CHARGER_STATUS_VERSION = "20260818-charger-status-v1";
const RECENT_ACTIVITY_VERSION = "20260818-recent-activity-v1";
const REQUESTS_STATUS_VERSION = "20260818-requests-status-v1";
const GLOBAL_SEARCH_VERSION = "20260818-global-search-v1";
const FAULT_TREND_VERSION = "20260818-fault-trend-v1";
const KPI_CARDS_VERSION = "20260818-kpi-cards-v1";
const DISPLAY_UTILS_VERSION = "20260818-display-utils-v2";
const SITES_DATA_MAPPERS_VERSION = "20260818-sites-data-mappers-v1";
const SITES_SHARED_VERSION = "20260818-sites-shared-v1";
const SITES_LIST_VERSION = "20260818-sites-list-v1";
const SITE_VISITS_VERSION = "20260820-site-visits-lifecycle-v1";
const SITES_FAULTS_VERSION = "20260818-sites-faults-v1";
const OPERATIONAL_RECORDS_VERSION = "20260820-operational-records-v1";
const CHARGER_LIFECYCLE_VERSION = "20260820-charger-lifecycle-v1";
const SITE_PROFILE_VERSION = "20260820-site-profile-v1";
const CHARGER_PROFILE_VERSION = "20260820-charger-profile-v1";
const SITES_DATA_VERSION = "20260820-sites-data-refresh-v1";
const HOMEPAGE_REQUESTS_VERSION = "20260813-homepage-requests";
const REQUESTS_BOOTSTRAP_VERSION = "20260813-requests-bootstrap";
const REQUESTS_SHARED_VERSION = "20260820-requests-shared-v1";
const REQUESTS_LIST_VERSION = "20260820-requests-list-v1";
const REQUEST_DETAIL_VERSION = "20260820-request-detail-v1";
const REQUEST_FORM_VERSION = "20260820-request-form-v1";
const REQUESTS_PAGE_VERSION = "20260820-requests-page-v1";
const SETTINGS_SHARED_VERSION = "20260820-settings-shared-v1";
const ACCOUNT_SETTINGS_VERSION = "20260820-account-settings-v1";
const PLATFORM_HEALTH_VERSION = "20260820-platform-health-v1";
const USER_MANAGEMENT_VERSION = "20260820-user-management-v1";
const SETTINGS_PAGE_VERSION = "20260820-settings-page-v1";
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
    const requestsStatusIndex = sources.indexOf(`frontend/pages/homepage/requests-status.js?v=${REQUESTS_STATUS_VERSION}`);
    const globalSearchIndex = sources.indexOf(`frontend/pages/homepage/global-search.js?v=${GLOBAL_SEARCH_VERSION}`);
    const faultTrendIndex = sources.indexOf(`frontend/pages/homepage/fault-trend.js?v=${FAULT_TREND_VERSION}`);
    const kpiCardsIndex = sources.indexOf(`frontend/pages/homepage/kpi-cards.js?v=${KPI_CARDS_VERSION}`);
    const homepageIndex = sources.indexOf(`frontend/pages/homepage/home-page.js?v=${HOMEPAGE_STRUCTURE_VERSION}`);
    const sitesDataMappersIndex = sources.indexOf(`frontend/pages/sites/sites-data-mappers.js?v=${SITES_DATA_MAPPERS_VERSION}`);
    const sitesSharedIndex = sources.indexOf(`frontend/pages/sites/sites-shared.js?v=${SITES_SHARED_VERSION}`);
    const sitesListIndex = sources.indexOf(`frontend/pages/sites/sites-list.js?v=${SITES_LIST_VERSION}`);
    const siteVisitsIndex = sources.indexOf(`frontend/pages/sites/site-visits.js?v=${SITE_VISITS_VERSION}`);
    const sitesFaultsIndex = sources.indexOf(`frontend/pages/sites/faults.js?v=${SITES_FAULTS_VERSION}`);
    const operationalRecordsIndex = sources.indexOf(`frontend/pages/sites/operational-records.js?v=${OPERATIONAL_RECORDS_VERSION}`);
    const siteProfileIndex = sources.indexOf(`frontend/pages/sites/site-profile.js?v=${SITE_PROFILE_VERSION}`);
    const chargerProfileIndex = sources.indexOf(`frontend/pages/sites/charger-profile.js?v=${CHARGER_PROFILE_VERSION}`);
    const chargerLifecycleIndex = sources.indexOf(`frontend/pages/sites/charger-lifecycle.js?v=${CHARGER_LIFECYCLE_VERSION}`);
    const sitesDataIndex = sources.indexOf(`frontend/pages/sites/sites-data.js?v=${SITES_DATA_VERSION}`);

    expect(stateIndex).toBeGreaterThanOrEqual(0);
    expect(displayUtilsIndex).toBeGreaterThan(stateIndex);
    expect(homeSharedIndex).toBeGreaterThan(displayUtilsIndex);
    expect(recordsBySiteIndex).toBeGreaterThan(homeSharedIndex);
    expect(visitActivityIndex).toBeGreaterThan(recordsBySiteIndex);
    expect(faultStatusIndex).toBeGreaterThan(visitActivityIndex);
    expect(chargerStatusIndex).toBeGreaterThan(faultStatusIndex);
    expect(recentActivityIndex).toBeGreaterThan(chargerStatusIndex);
    expect(requestsStatusIndex).toBeGreaterThan(recentActivityIndex);
    expect(globalSearchIndex).toBeGreaterThan(requestsStatusIndex);
    expect(faultTrendIndex).toBeGreaterThan(globalSearchIndex);
    expect(kpiCardsIndex).toBeGreaterThan(faultTrendIndex);
    expect(homepageIndex).toBeGreaterThan(kpiCardsIndex);
    expect(sitesDataMappersIndex).toBeGreaterThan(homepageIndex);
    expect(sitesSharedIndex).toBeGreaterThan(sitesDataMappersIndex);
    expect(sitesListIndex).toBeGreaterThan(sitesSharedIndex);
    expect(siteVisitsIndex).toBeGreaterThan(sitesListIndex);
    expect(sitesFaultsIndex).toBeGreaterThan(siteVisitsIndex);
    expect(operationalRecordsIndex).toBeGreaterThan(sitesFaultsIndex);
    expect(siteProfileIndex).toBeGreaterThan(operationalRecordsIndex);
    expect(chargerProfileIndex).toBeGreaterThan(siteProfileIndex);
    expect(chargerLifecycleIndex).toBeGreaterThan(chargerProfileIndex);
    expect(sitesDataIndex).toBeGreaterThan(chargerLifecycleIndex);
    expect(sources.indexOf(`app.js?v=${CONTENT_RECORD_ACTIONS_VERSION}`)).toBeGreaterThan(stateIndex);
    expect(sitesDataIndex).toBeGreaterThan(stateIndex);
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
    expect(index).toContain(`frontend/pages/settings/settings-shared.js?v=${SETTINGS_SHARED_VERSION}`);
    expect(index).toContain(`frontend/pages/settings/account-settings.js?v=${ACCOUNT_SETTINGS_VERSION}`);
    expect(index).toContain(`frontend/pages/settings/platform-health.js?v=${PLATFORM_HEALTH_VERSION}`);
    expect(index).toContain(`frontend/pages/settings/user-management.js?v=${USER_MANAGEMENT_VERSION}`);
    expect(index).toContain(`frontend/pages/settings/settings-page.js?v=${SETTINGS_PAGE_VERSION}`);
    expect(index).not.toContain("js/settings-page.js?v=");
    expect(index).toContain(`frontend/pages/requests/requests-shared.js?v=${REQUESTS_SHARED_VERSION}`);
    expect(index).toContain(`frontend/pages/requests/requests-list.js?v=${REQUESTS_LIST_VERSION}`);
    expect(index).toContain(`frontend/pages/requests/request-detail.js?v=${REQUEST_DETAIL_VERSION}`);
    expect(index).toContain(`frontend/pages/requests/request-form.js?v=${REQUEST_FORM_VERSION}`);
    expect(index).toContain(`frontend/pages/requests/requests-page.js?v=${REQUESTS_PAGE_VERSION}`);
    expect(index).not.toContain("js/requests-page.js?v=");
    expect(index).toContain(`js/auth-router.js?v=${REQUESTS_BOOTSTRAP_VERSION}`);
    expect(index).toContain(`frontend/pages/homepage/home-page.js?v=${HOMEPAGE_STRUCTURE_VERSION}`);
    expect(index).toContain(`frontend/pages/sites/sites-data.js?v=${SITES_DATA_VERSION}`);
    expect(index).not.toContain("js/sites-page.js?v=");
    expect(index).toContain(`frontend/pages/contacts/contacts-page.js?v=${FRONTEND_STRUCTURE_VERSION}`);
    expect(index).toContain(`js/modals.js?v=${FAULT_LIFECYCLE_VERSION}`);
    expect(index).toContain(`app.js?v=${CONTENT_RECORD_ACTIONS_VERSION}`);
  });
});
