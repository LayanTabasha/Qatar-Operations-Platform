import { ApiError } from "../../utils/api-error.js";
import { findSiteById } from "../sites/sites.repository.js";
import {
  findChargerById,
  archiveChargerById,
  insertCharger,
  listChargers,
  restoreChargerById,
  softDeleteArchivedChargerById,
  updateChargerById,
  updateChargerStatusById,
} from "./chargers.repository.js";

async function ensureWritableParentSite(siteId) {
  const site = await findSiteById(siteId);

  if (!site) {
    throw new ApiError(404, "SITE_NOT_FOUND", "Site not found");
  }

  if (site.status === "archived") {
    throw new ApiError(409, "ARCHIVED_SITE_CONFLICT", "Archived sites cannot receive active chargers");
  }

  return site;
}

function handleChargerWriteError(err) {
  if (err.code === "23505") {
    throw new ApiError(409, "CHARGER_CODE_ALREADY_EXISTS", "A charger with this code already exists");
  }

  if (err.code === "23503") {
    throw new ApiError(404, "SITE_NOT_FOUND", "Site not found");
  }

  throw err;
}

export async function getChargers(options) {
  return listChargers(options);
}

export async function getCharger(id) {
  const charger = await findChargerById(id);

  if (!charger) {
    throw new ApiError(404, "CHARGER_NOT_FOUND", "Charger not found");
  }

  return charger;
}

export async function createCharger(input) {
  await ensureWritableParentSite(input.site_id);

  try {
    return await insertCharger(input);
  } catch (err) {
    handleChargerWriteError(err);
  }
}

export async function updateCharger(id, input) {
  if (input.site_id) {
    await ensureWritableParentSite(input.site_id);
  }

  try {
    const charger = await updateChargerById(id, input);

    if (!charger) {
      throw new ApiError(404, "CHARGER_NOT_FOUND", "Charger not found");
    }

    return charger;
  } catch (err) {
    handleChargerWriteError(err);
  }
}

export async function updateChargerStatus(id, status) {
  if (status !== "archived") {
    const existingCharger = await getCharger(id);
    await ensureWritableParentSite(existingCharger.site_id);
  }

  const charger = await updateChargerStatusById(id, status);

  if (!charger) {
    throw new ApiError(404, "CHARGER_NOT_FOUND", "Charger not found");
  }

  return charger;
}

export async function archiveCharger(id, currentUserId) {
  const existingCharger = await getCharger(id);
  const previousStatus = existingCharger.status === "archived" ? existingCharger.previous_status || "active" : existingCharger.status;
  const charger = await archiveChargerById(id, currentUserId, previousStatus);

  if (!charger) {
    throw new ApiError(404, "CHARGER_NOT_FOUND", "Charger not found");
  }

  return charger;
}

export async function restoreCharger(id, currentUserId) {
  const existingCharger = await getCharger(id);

  if (existingCharger.status !== "archived") {
    throw new ApiError(409, "CHARGER_NOT_ARCHIVED", "Only archived chargers can be restored");
  }

  await ensureWritableParentSite(existingCharger.site_id);
  const charger = await restoreChargerById(id, currentUserId);

  if (!charger) {
    throw new ApiError(404, "CHARGER_NOT_FOUND", "Charger not found");
  }

  return charger;
}

export async function deleteArchivedCharger(id, currentUserId) {
  const existingCharger = await getCharger(id);

  if (existingCharger.status !== "archived") {
    throw new ApiError(409, "CHARGER_NOT_ARCHIVED", "Only archived chargers can be permanently deleted");
  }

  const charger = await softDeleteArchivedChargerById(id, currentUserId);

  if (!charger) {
    throw new ApiError(404, "CHARGER_NOT_FOUND", "Charger not found");
  }

  return charger;
}
