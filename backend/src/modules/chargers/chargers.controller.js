import { asyncHandler } from "../../utils/async-handler.js";
import { createCharger, getCharger, getChargers, updateCharger, updateChargerStatus } from "./chargers.service.js";
import {
  chargerIdParamsSchema,
  createChargerSchema,
  listChargersQuerySchema,
  updateChargerSchema,
  updateChargerStatusSchema,
} from "./chargers.validation.js";

export const listChargers = asyncHandler(async (req, res) => {
  const query = listChargersQuerySchema.parse(req.query);
  const chargers = await getChargers(query);

  res.json({
    success: true,
    chargers,
  });
});

export const getChargerById = asyncHandler(async (req, res) => {
  const { id } = chargerIdParamsSchema.parse(req.params);
  const charger = await getCharger(id);

  res.json({
    success: true,
    charger,
  });
});

export const createChargerRecord = asyncHandler(async (req, res) => {
  const input = createChargerSchema.parse(req.body);
  const charger = await createCharger(input);

  res.status(201).json({
    success: true,
    charger,
  });
});

export const updateChargerRecord = asyncHandler(async (req, res) => {
  const { id } = chargerIdParamsSchema.parse(req.params);
  const input = updateChargerSchema.parse(req.body);
  const charger = await updateCharger(id, input);

  res.json({
    success: true,
    charger,
  });
});

export const updateChargerStatusRecord = asyncHandler(async (req, res) => {
  const { id } = chargerIdParamsSchema.parse(req.params);
  const { status } = updateChargerStatusSchema.parse(req.body);
  const charger = await updateChargerStatus(id, status);

  res.json({
    success: true,
    charger,
  });
});
