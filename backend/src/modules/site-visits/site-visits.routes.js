import { Router } from "express";
import { authenticate, authorizeRoles } from "../auth/auth.middleware.js";
import {
  createSiteVisitRecord,
  deleteSiteVisitRecord,
  getSiteVisitRecord,
  listSiteVisitRecords,
  updateSiteVisitRecord,
} from "./site-visits.controller.js";
import { ROLE_GROUPS } from "../auth/permissions.js";

export const siteVisitsRouter = Router();

siteVisitsRouter.use(authenticate);

siteVisitsRouter.get("/", authorizeRoles(...ROLE_GROUPS.authenticatedRead), listSiteVisitRecords);
siteVisitsRouter.get("/:id", authorizeRoles(...ROLE_GROUPS.authenticatedRead), getSiteVisitRecord);
siteVisitsRouter.post("/", authorizeRoles(...ROLE_GROUPS.operationalManage), createSiteVisitRecord);
siteVisitsRouter.patch("/:id", authorizeRoles(...ROLE_GROUPS.operationalManage), updateSiteVisitRecord);
siteVisitsRouter.delete("/:id", authorizeRoles(...ROLE_GROUPS.operationalManage), deleteSiteVisitRecord);
