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

sitesRouter.get("/", authorizeRoles("admin", "operator", "viewer"), listSites);
sitesRouter.get("/:id", authorizeRoles("admin", "operator", "viewer"), getSiteById);
sitesRouter.post("/", authorizeRoles("admin", "operator"), createSiteRecord);
sitesRouter.post("/:id/image", authorizeRoles("admin", "operator"), ensureSiteExistsForImage, siteImageUpload, uploadSiteImageRecord);
sitesRouter.patch("/:id/status", authorizeRoles("admin", "operator"), updateSiteStatusRecord);
sitesRouter.patch("/:id", authorizeRoles("admin", "operator"), updateSiteRecord);
