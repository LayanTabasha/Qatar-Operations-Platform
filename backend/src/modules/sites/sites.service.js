import { ApiError } from "../../utils/api-error.js";
import {
  findSiteById,
  findOperationalSiteById,
  archiveSiteById,
  insertSite,
  permanentlyDeleteSiteById,
  restoreSiteById,
  listSites,
  updateSiteById,
  updateSiteImagePathById,
  updateSiteStatusById,
} from "./sites.repository.js";

function handleSiteWriteError(err) {
  if (err.code === "23505") {
    throw new ApiError(409, "SITE_CODE_ALREADY_EXISTS", "A site with this code already exists");
  }

  throw err;
}

export async function getSites(options) {
  return listSites(options);
}

export async function getSite(id) {
  const site = await findOperationalSiteById(id);

  if (!site) {
    throw new ApiError(404, "SITE_NOT_FOUND", "Site not found");
  }

  return site;
}

export async function createSite(input) {
  try {
    return await insertSite(input);
  } catch (err) {
    handleSiteWriteError(err);
  }
}

export async function updateSite(id, input) {
  try {
    const site = await updateSiteById(id, input);

    if (!site) {
      throw new ApiError(404, "SITE_NOT_FOUND", "Site not found");
    }

    return site;
  } catch (err) {
    handleSiteWriteError(err);
  }
}

export async function updateSiteStatus(id, status) {
  const existing = await findSiteById(id);
  if (!existing) throw new ApiError(404, "SITE_NOT_FOUND", "Site not found");
  if (existing.status === "archived") {
    throw new ApiError(409, "SITE_ARCHIVED", "Use the administrator restore endpoint to restore an archived site");
  }
  const site = await updateSiteStatusById(id, status);

  if (!site) {
    throw new ApiError(404, "SITE_NOT_FOUND", "Site not found");
  }

  return site;
}

export async function updateSiteImage(id, imagePath) {
  const site = await updateSiteImagePathById(id, imagePath);

  if (!site) {
    throw new ApiError(404, "SITE_NOT_FOUND", "Site not found");
  }

  return site;
}

export async function archiveSite(id, userId, reason, audit) {
  const existing = await findSiteById(id);
  if (!existing) throw new ApiError(404, "SITE_NOT_FOUND", "Site not found");
  if (existing.status === "archived") throw new ApiError(409, "SITE_ALREADY_ARCHIVED", "Site is already archived");
  return archiveSiteById(id, userId, reason, audit);
}

export async function restoreSite(id, userId, audit) {
  const existing = await findSiteById(id);
  if (!existing) throw new ApiError(404, "SITE_NOT_FOUND", "Site not found");
  if (existing.status !== "archived") throw new ApiError(409, "SITE_NOT_ARCHIVED", "Only archived sites can be restored");
  return restoreSiteById(id, userId, audit);
}

export async function permanentlyDeleteSite(id, userId, audit) {
  const result = await permanentlyDeleteSiteById(id, userId, audit);
  if (result.state === "not_found") throw new ApiError(404, "SITE_NOT_FOUND", "Site not found");
  if (result.state === "not_archived") throw new ApiError(409, "SITE_NOT_ARCHIVED", "Only archived sites can be permanently deleted");
  if (result.state === "dependencies") {
    const error = new ApiError(409, "SITE_HAS_DEPENDENCIES", "Site cannot be permanently deleted while linked records exist");
    error.details = { dependencies: result.dependencies };
    throw error;
  }
  return result.site;
}
