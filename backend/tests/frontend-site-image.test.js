import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(process.cwd(), "..");

function readRootFile(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("frontend site image workflow", () => {
  it("keeps the selected site image File separate from the temporary preview", () => {
    const modalsSource = readRootFile("js/modals.js");

    expect(modalsSource).toContain("let pendingModalImage = null;");
    expect(modalsSource).toContain("let pendingSiteImageFile = null;");
    expect(modalsSource).toContain("pendingModalImage = await readAndOptimizeSiteImage(file);");
    expect(modalsSource).toContain("pendingSiteImageFile = file;");
  });

  it("does not send Base64 image data in the normal site JSON save payload", () => {
    const modalsSource = readRootFile("js/modals.js");
    const saveWorkflowStart = modalsSource.indexOf("async function simulateUpdate");
    const siteBranchStart = modalsSource.indexOf('if (type === "site")', saveWorkflowStart);
    const chargerBranchStart = modalsSource.indexOf('if (type === "charger")', siteBranchStart);
    const siteBranch = modalsSource.slice(siteBranchStart, chargerBranchStart);

    expect(siteBranch).toContain("const payload = {");
    expect(siteBranch).not.toContain("image_path");
    expect(siteBranch).not.toContain("pendingModalImage");
  });

  it("uploads the selected File through the site image API before the modal closes", () => {
    const modalsSource = readRootFile("js/modals.js");

    expect(modalsSource).toContain("if (pendingSiteImageFile) {");
    expect(modalsSource).toContain("await window.QatarOpsApi.Sites.uploadImage(response.site.id, pendingSiteImageFile);");
    expect(modalsSource).toContain("Site details were saved, but the image upload failed");
    expect(modalsSource).toContain("setTimeout(closeModal, 300);");
  });

  it("uses multipart FormData with the Multer image field and credentials-safe API helper", () => {
    const apiClientSource = readRootFile("js/api-client.js");

    expect(apiClientSource).toContain('formData.append("image", file);');
    expect(apiClientSource).toContain("`/sites/${id}/image`");
    expect(apiClientSource).toContain('credentials: "include"');
    expect(apiClientSource).toContain("!(options.body instanceof FormData)");
  });

  it("renders saved uploads as public assets with cache-busting and fallback support", () => {
    const sitesPageSource = readRootFile("frontend/pages/sites/sites-data-mappers.js");
    const stateSource = readRootFile("js/state.js");

    expect(sitesPageSource).toContain("imagePathWithVersion(site.image_path, site.updated_at)");
    expect(stateSource).toContain("apiAssetUrl(imageSource)");
    expect(stateSource).toContain("showImageFallback(this)");
  });
});
