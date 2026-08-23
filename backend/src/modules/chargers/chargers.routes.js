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
import { ROLE_GROUPS } from "../auth/permissions.js";

export const chargersRouter = Router();

chargersRouter.use(authenticate);

chargersRouter.get("/", authorizeRoles(...ROLE_GROUPS.authenticatedRead), listChargers);
chargersRouter.get("/:id", authorizeRoles(...ROLE_GROUPS.authenticatedRead), getChargerById);
chargersRouter.post("/", authorizeRoles(...ROLE_GROUPS.adminOnly), createChargerRecord);
chargersRouter.patch("/:id/archive", authorizeRoles("admin"), archiveChargerRecord);
chargersRouter.patch("/:id/restore", authorizeRoles("admin"), restoreChargerRecord);
chargersRouter.patch("/:id/status", authorizeRoles(...ROLE_GROUPS.adminOnly), updateChargerStatusRecord);
chargersRouter.patch("/:id", authorizeRoles(...ROLE_GROUPS.adminOnly), updateChargerRecord);
chargersRouter.delete("/:id/permanent", authorizeRoles("admin"), deleteChargerRecord);
