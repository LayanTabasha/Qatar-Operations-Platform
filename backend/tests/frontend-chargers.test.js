import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(process.cwd(), "..");

function readRootFile(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("frontend charger archive workflow", () => {
  it("loads active and archived chargers separately", () => {
    const sitesPageSource = readRootFile("js/sites-page.js");

    expect(sitesPageSource).toContain('ChargersApi.list({ status: "active", limit: 100 })');
    expect(sitesPageSource).toContain('ChargersApi.list({ status: "archived", limit: 100 })');
    expect(sitesPageSource).toContain("state.archivedChargers");
    expect(sitesPageSource).toContain("state.counts.chargers = chargers.length");
  });

  it("renders an archived chargers section with restore and admin delete actions", () => {
    const sitesPageSource = readRootFile("js/sites-page.js");

    expect(sitesPageSource).toContain("Archived Chargers");
    expect(sitesPageSource).toContain("data-charger-restore");
    expect(sitesPageSource).toContain("data-charger-delete");
    expect(sitesPageSource).toContain("isAdmin()");
  });

  it("uses archive restore and delete API methods instead of local removal", () => {
    const apiClientSource = readRootFile("js/api-client.js");
    const modalsSource = readRootFile("js/modals.js");
    const appSource = readRootFile("app.js");

    expect(apiClientSource).toContain("archive(id)");
    expect(apiClientSource).toContain("restore(id)");
    expect(apiClientSource).toContain("deleteArchived(id)");
    expect(modalsSource).toContain("await ChargersApi.archive(chargerId)");
    expect(appSource).toContain("permanentlyDeleteArchivedCharger");
  });
});
