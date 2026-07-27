import { Router } from "express";
import { authenticate, authorizeRoles } from "../auth/auth.middleware.js";
import {
  createSiteRecord,
  ensureSiteExistsForImage,
  getSiteById,
  listSites,
  updateSiteRecord,
  updateSiteStatusRecord,
  uploadSiteImageRecord,
} from "./sites.controller.js";
import { siteImageUpload } from "./site-image-upload.middleware.js";

export const sitesRouter = Router();

sitesRouter.use(authenticate);

sitesRouter.get("/", authorizeRoles("admin", "operations_staff", "viewer"), listSites);
sitesRouter.get("/:id", authorizeRoles("admin", "operations_staff", "viewer"), getSiteById);
sitesRouter.post("/", authorizeRoles("admin", "operations_staff"), createSiteRecord);
sitesRouter.post("/:id/image", authorizeRoles("admin", "operations_staff"), ensureSiteExistsForImage, siteImageUpload, uploadSiteImageRecord);
sitesRouter.patch("/:id/status", authorizeRoles("admin", "operations_staff"), updateSiteStatusRecord);
sitesRouter.patch("/:id", authorizeRoles("admin", "operations_staff"), updateSiteRecord);
