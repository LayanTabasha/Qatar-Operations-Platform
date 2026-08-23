import { Router } from "express";
import { authenticate, authorizeRoles } from "../auth/auth.middleware.js";
import {
  createSiteRecord,
  archiveSiteRecord,
  ensureSiteExistsForImage,
  getSiteById,
  listSites,
  permanentlyDeleteSiteRecord,
  restoreSiteRecord,
  updateSiteRecord,
  updateSiteStatusRecord,
  uploadSiteImageRecord,
} from "./sites.controller.js";
import { siteImageUpload } from "./site-image-upload.middleware.js";
import { ROLE_GROUPS } from "../auth/permissions.js";

export const sitesRouter = Router();

sitesRouter.use(authenticate);

sitesRouter.get("/", authorizeRoles(...ROLE_GROUPS.authenticatedRead), listSites);
sitesRouter.get("/:id", authorizeRoles(...ROLE_GROUPS.authenticatedRead), getSiteById);
sitesRouter.post("/", authorizeRoles(...ROLE_GROUPS.adminOnly), createSiteRecord);
sitesRouter.patch("/:id/archive", authorizeRoles("admin"), archiveSiteRecord);
sitesRouter.patch("/:id/restore", authorizeRoles("admin"), restoreSiteRecord);
sitesRouter.delete("/:id/permanent", authorizeRoles("admin"), permanentlyDeleteSiteRecord);
sitesRouter.post("/:id/image", authorizeRoles(...ROLE_GROUPS.adminOnly), ensureSiteExistsForImage, siteImageUpload, uploadSiteImageRecord);
sitesRouter.patch("/:id/status", authorizeRoles(...ROLE_GROUPS.adminOnly), updateSiteStatusRecord);
sitesRouter.patch("/:id", authorizeRoles(...ROLE_GROUPS.adminOnly), updateSiteRecord);
