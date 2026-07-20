import { Router } from "express";
import { authenticate, authorizeRoles } from "../auth/auth.middleware.js";
import {
  createChargerRecord,
  getChargerById,
  listChargers,
  updateChargerRecord,
  updateChargerStatusRecord,
} from "./chargers.controller.js";

export const chargersRouter = Router();

chargersRouter.use(authenticate);

chargersRouter.get("/", authorizeRoles("admin", "operator", "viewer"), listChargers);
chargersRouter.get("/:id", authorizeRoles("admin", "operator", "viewer"), getChargerById);
chargersRouter.post("/", authorizeRoles("admin", "operator"), createChargerRecord);
chargersRouter.patch("/:id/status", authorizeRoles("admin", "operator"), updateChargerStatusRecord);
chargersRouter.patch("/:id", authorizeRoles("admin", "operator"), updateChargerRecord);
