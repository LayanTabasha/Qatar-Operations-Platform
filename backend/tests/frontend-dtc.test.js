import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(process.cwd(), "..");

function readRootFile(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("frontend DTC catalogue workflow", () => {
  it("defines a centralized DTC API client", () => {
    const apiClientSource = readRootFile("js/api-client.js");

    expect(apiClientSource).toContain("const DtcApi");
    expect(apiClientSource).toContain("apiRequest(`/dtc");
    expect(apiClientSource).toContain("importWorkbook(file)");
    expect(apiClientSource).toContain('formData.append("file", file)');
  });

  it("loads DTC records from the backend with operational data", () => {
    const sitesPageSource = readRootFile("frontend/pages/sites/sites-data.js");

    expect(sitesPageSource).toContain('window.QatarOpsApi.Dtc.list({ status: "all", limit: 100 })');
    expect(sitesPageSource).toContain("state.faultCatalogue");
    expect(sitesPageSource).toContain("normalizeFaultCatalogueRecord");
  });

  it("keeps the intentionally removed DTC catalogue out of Settings", () => {
    const settingsSource = ["frontend/pages/settings/settings-shared.js", "frontend/pages/settings/account-settings.js", "frontend/pages/settings/platform-health.js", "frontend/pages/settings/user-management.js", "frontend/pages/settings/settings-page.js"].map(readRootFile).join("\n");

    expect(settingsSource).not.toContain('"DTC Catalogue"');
    expect(settingsSource).not.toContain("Import Excel Catalogue");
  });

  it("allows faults without a DTC code and shows catalogue details when selected", () => {
    const modalsSource = readRootFile("js/modals.js");

    expect(modalsSource).toContain("Search DTC, FTB, ECU, title, or description");
    expect(modalsSource).toContain("async function searchFaultCatalogue");
    expect(modalsSource).toContain("selectFaultCatalogueRecord");
    expect(modalsSource).toContain('document.getElementById("fault-catalogue-id")');
    expect(modalsSource).toContain('document.getElementById("possible-causes")');
    expect(modalsSource).toContain('document.getElementById("recommended-actions")');
    expect(modalsSource).toContain("await window.QatarOpsApi.Dtc.create(payload)");
  });

  it("keeps catalogue search available to operational fault workflows", () => {
    const repositorySource = fs.readFileSync(path.join(repoRoot, "backend/src/modules/dtc/dtc.repository.js"), "utf8");

    expect(repositorySource).toContain("OR ftb_code ILIKE");
    expect(repositorySource).toContain("OR component ILIKE");
  });

  it("keeps DTC optional in the simplified operational Fault form", () => {
    const modalsSource = readRootFile("js/modals.js");

    expect(modalsSource).toContain("A. Fault Location");
    expect(modalsSource).toContain("B. What Happened?");
    expect(modalsSource).toContain("Connectivity / Wi-Fi");
    expect(modalsSource).toContain("Screen or interface");
    expect(modalsSource).toContain("Physical damage");
    expect(modalsSource).toContain('id="has-technical-code"');
    expect(modalsSource).toContain("<option selected>No</option><option>Yes</option>");
    expect(modalsSource).toContain("const catalogueItem = hasTechnicalCode ?");
  });

  it("allows manual saving when DTC search is empty or unavailable", () => {
    const modalsSource = readRootFile("js/modals.js");

    expect(modalsSource).toContain("No matching DTC records found. You can continue recording the fault manually.");
    expect(modalsSource).toContain("The DTC catalogue is temporarily unavailable. You can continue recording the fault manually.");
    expect(modalsSource).toContain("fault_catalogue_id: catalogueItem?.id || null");
  });

  it("keeps Fault Code optional and provides a separate severity selector", () => {
    const modalsSource = readRootFile("js/modals.js");
    const sitesSource = readRootFile("frontend/pages/sites/faults.js");

    expect(modalsSource).toContain('id="severity"');
    expect(modalsSource).toContain("Select the technical impact of the fault.");
    expect(modalsSource).toContain('setFieldValue("severity", normalizedFaultSeverity(item.severity, "Medium"))');
    expect(modalsSource).toContain('fault.faultCode ? detailRow("Fault Code / DTC"');
    expect(modalsSource).toContain("Priority (response urgency)");
    expect(modalsSource).toContain("Severity (technical impact)");
    expect(sitesSource).toContain('fault.faultCode ? safeDetailValue(fault.faultCode) : "—"');
    expect(sitesSource).toContain("normalizedFaultSeverity(fault.severity)");
  });
});
