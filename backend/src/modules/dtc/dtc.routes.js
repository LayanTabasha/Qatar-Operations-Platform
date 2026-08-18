import { Router } from "express";
import { authenticate, authorizeRoles } from "../auth/auth.middleware.js";
import { createDtc, getDtcById, importDtc, listDtc, updateDtc, updateDtcStatus } from "./dtc.controller.js";
import { dtcWorkbookUpload } from "./dtc-upload.middleware.js";
import { ROLE_GROUPS } from "../auth/permissions.js";

export const dtcRouter = Router();

dtcRouter.use(authenticate);

dtcRouter.get("/", authorizeRoles(...ROLE_GROUPS.authenticatedRead), listDtc);
dtcRouter.post("/", authorizeRoles("admin"), createDtc);
dtcRouter.post("/import", authorizeRoles("admin"), dtcWorkbookUpload, importDtc);
dtcRouter.get("/:id", authorizeRoles(...ROLE_GROUPS.authenticatedRead), getDtcById);
dtcRouter.patch("/:id/status", authorizeRoles("admin"), updateDtcStatus);
dtcRouter.patch("/:id", authorizeRoles("admin"), updateDtc);
