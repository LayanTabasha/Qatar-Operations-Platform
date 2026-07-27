import { ApiError } from "../../utils/api-error.js";
import {
  findSiteById,
  insertSite,
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
  const site = await findSiteById(id);

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
