import { Router } from "express";
import { authenticate, authorizeRoles } from "../auth/auth.middleware.js";
import {
  createSiteRecord,
  getSiteById,
  listSites,
  updateSiteRecord,
  updateSiteStatusRecord,
} from "./sites.controller.js";

export const sitesRouter = Router();

sitesRouter.use(authenticate);

sitesRouter.get("/", authorizeRoles("admin", "operator", "viewer"), listSites);
sitesRouter.get("/:id", authorizeRoles("admin", "operator", "viewer"), getSiteById);
sitesRouter.post("/", authorizeRoles("admin", "operator"), createSiteRecord);
sitesRouter.patch("/:id/status", authorizeRoles("admin", "operator"), updateSiteStatusRecord);
sitesRouter.patch("/:id", authorizeRoles("admin", "operator"), updateSiteRecord);
