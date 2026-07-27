import { Router } from "express";
import { authenticate, authorizeRoles } from "../auth/auth.middleware.js";
import {
  createSiteVisitRecord,
  getSiteVisitRecord,
  listSiteVisitRecords,
  updateSiteVisitRecord,
} from "./site-visits.controller.js";

export const siteVisitsRouter = Router();

siteVisitsRouter.use(authenticate);

siteVisitsRouter.get("/", authorizeRoles("admin", "operations_staff", "viewer"), listSiteVisitRecords);
siteVisitsRouter.get("/:id", authorizeRoles("admin", "operations_staff", "viewer"), getSiteVisitRecord);
siteVisitsRouter.post("/", authorizeRoles("admin", "operations_staff"), createSiteVisitRecord);
siteVisitsRouter.patch("/:id", authorizeRoles("admin", "operations_staff"), updateSiteVisitRecord);
