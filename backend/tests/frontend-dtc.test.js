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
    const sitesPageSource = readRootFile("js/sites-page.js");

    expect(sitesPageSource).toContain('DtcApi.list({ status: "all", limit: 100 })');
    expect(sitesPageSource).toContain("state.faultCatalogue");
    expect(sitesPageSource).toContain("normalizeFaultCatalogueRecord");
  });

  it("renders searchable and importable DTC catalogue settings", () => {
    const settingsSource = readRootFile("js/settings-page.js");
    const appSource = readRootFile("app.js");

    expect(settingsSource).toContain("DTC Catalogue");
    expect(settingsSource).toContain("Import Excel Catalogue");
    expect(settingsSource).toContain("loadDtcCatalogue");
    expect(settingsSource).toContain("importDtcCatalogue");
    expect(appSource).toContain("dtc-import-file");
    expect(appSource).toContain("searchDtcCatalogue");
  });

  it("allows faults without a DTC code and shows catalogue details when selected", () => {
    const modalsSource = readRootFile("js/modals.js");

    expect(modalsSource).toContain("Unknown / No DTC Code");
    expect(modalsSource).toContain("Possible Causes");
    expect(modalsSource).toContain("catalogueItem?.possibleCauses");
    expect(modalsSource).toContain("await DtcApi.create(payload)");
  });
});
