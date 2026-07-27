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

chargersRouter.get("/", authorizeRoles("admin", "operations_staff", "viewer"), listChargers);
chargersRouter.get("/:id", authorizeRoles("admin", "operations_staff", "viewer"), getChargerById);
chargersRouter.post("/", authorizeRoles("admin", "operations_staff"), createChargerRecord);
chargersRouter.patch("/:id/status", authorizeRoles("admin", "operations_staff"), updateChargerStatusRecord);
chargersRouter.patch("/:id", authorizeRoles("admin", "operations_staff"), updateChargerRecord);
