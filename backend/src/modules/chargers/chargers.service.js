import { ApiError } from "../../utils/api-error.js";
import {
  findChargerById,
  insertCharger,
  listChargers,
  updateChargerById,
  updateChargerStatusById,
} from "./chargers.repository.js";

function handleChargerWriteError(err) {
  if (err.code === "23505") {
    throw new ApiError(409, "CHARGER_CODE_ALREADY_EXISTS", "A charger with this code already exists");
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
  try {
    return await insertCharger(input);
  } catch (err) {
    handleChargerWriteError(err);
  }
}

export async function updateCharger(id, input) {
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
  const charger = await updateChargerStatusById(id, status);

  if (!charger) {
    throw new ApiError(404, "CHARGER_NOT_FOUND", "Charger not found");
  }

  return charger;
}
