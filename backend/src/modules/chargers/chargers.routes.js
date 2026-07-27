import { Router } from "express";
import { authenticate, authorizeRoles } from "../auth/auth.middleware.js";
import {
  archiveChargerRecord,
  createChargerRecord,
  deleteChargerRecord,
  getChargerById,
  listChargers,
  restoreChargerRecord,
  updateChargerRecord,
  updateChargerStatusRecord,
} from "./chargers.controller.js";

export const chargersRouter = Router();

chargersRouter.use(authenticate);

chargersRouter.get("/", authorizeRoles("admin", "operations_staff", "viewer"), listChargers);
chargersRouter.get("/:id", authorizeRoles("admin", "operations_staff", "viewer"), getChargerById);
chargersRouter.post("/", authorizeRoles("admin", "operations_staff"), createChargerRecord);
chargersRouter.patch("/:id/archive", authorizeRoles("admin", "operations_staff"), archiveChargerRecord);
chargersRouter.patch("/:id/restore", authorizeRoles("admin", "operations_staff"), restoreChargerRecord);
chargersRouter.patch("/:id/status", authorizeRoles("admin", "operations_staff"), updateChargerStatusRecord);
chargersRouter.patch("/:id", authorizeRoles("admin", "operations_staff"), updateChargerRecord);
chargersRouter.delete("/:id", authorizeRoles("admin"), deleteChargerRecord);
