import { ApiError } from "../../utils/api-error.js";
import { findSiteById } from "../sites/sites.repository.js";
import {
  findChargerById,
  findAnyChargerById,
  archiveChargerById,
  insertCharger,
  listChargers,
  restoreChargerById,
  permanentlyDeleteChargerById,
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
  const existingCharger = await findAnyChargerById(id);
  if (!existingCharger) throw new ApiError(404, "CHARGER_NOT_FOUND", "Charger not found");
  if (existingCharger.status === "archived") {
    throw new ApiError(409, "CHARGER_ARCHIVED", "Use the administrator restore endpoint to restore an archived charger");
  }
  await ensureWritableParentSite(existingCharger.site_id);

  const charger = await updateChargerStatusById(id, status);

  if (!charger) {
    throw new ApiError(404, "CHARGER_NOT_FOUND", "Charger not found");
  }

  return charger;
}

export async function archiveCharger(id, currentUserId, reason, audit) {
  const existingCharger = await findAnyChargerById(id);
  if (!existingCharger) throw new ApiError(404, "CHARGER_NOT_FOUND", "Charger not found");
  if (existingCharger.status === "archived") throw new ApiError(409, "CHARGER_ALREADY_ARCHIVED", "Charger is already archived");
  const previousStatus = existingCharger.status;
  const charger = await archiveChargerById(id, currentUserId, previousStatus, reason, audit);

  if (!charger) {
    throw new ApiError(404, "CHARGER_NOT_FOUND", "Charger not found");
  }

  return charger;
}

export async function restoreCharger(id, currentUserId, audit) {
  const existingCharger = await findAnyChargerById(id);

  if (!existingCharger) throw new ApiError(404, "CHARGER_NOT_FOUND", "Charger not found");

  if (existingCharger.status !== "archived") {
    throw new ApiError(409, "CHARGER_NOT_ARCHIVED", "Only archived chargers can be restored");
  }

  await ensureWritableParentSite(existingCharger.site_id);
  const charger = await restoreChargerById(id, currentUserId, audit);

  if (!charger) {
    throw new ApiError(404, "CHARGER_NOT_FOUND", "Charger not found");
  }

  return charger;
}

export async function deleteArchivedCharger(id, currentUserId, audit) {
  const result = await permanentlyDeleteChargerById(id, currentUserId, audit);
  if (result.state === "not_found") throw new ApiError(404, "CHARGER_NOT_FOUND", "Charger not found");
  if (result.state === "not_archived") throw new ApiError(409, "CHARGER_NOT_ARCHIVED", "Only archived chargers can be permanently deleted");
  if (result.state === "dependencies") {
    const error = new ApiError(409, "CHARGER_HAS_DEPENDENCIES", "Charger cannot be permanently deleted while linked records exist");
    error.details = { dependencies: result.dependencies };
    throw error;
  }
  return result.charger;
}
