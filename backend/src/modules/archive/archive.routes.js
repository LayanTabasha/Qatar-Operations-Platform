import { Router } from "express";
import { authenticate, authorizeRoles } from "../auth/auth.middleware.js";
import { getArchivedChargers, getArchivedSites } from "./archive.controller.js";

export const archiveRouter = Router();

archiveRouter.use(authenticate, authorizeRoles("admin"));
archiveRouter.get("/sites", getArchivedSites);
archiveRouter.get("/chargers", getArchivedChargers);
