import { Router } from "express";
import { authenticate, authorizeRoles } from "../auth/auth.middleware.js";
import { createRequestRecord, deleteRequestRecord, getRequestRecord, listRequestRecords, updateRequestRecord } from "./requests.controller.js";
import { ROLE_GROUPS } from "../auth/permissions.js";

export const requestsRouter = Router();
requestsRouter.use(authenticate);
requestsRouter.get("/", authorizeRoles(...ROLE_GROUPS.requestRead), listRequestRecords);
requestsRouter.get("/:id", authorizeRoles(...ROLE_GROUPS.requestRead), getRequestRecord);
requestsRouter.post("/", authorizeRoles("admin"), createRequestRecord);
requestsRouter.patch("/:id", authorizeRoles(...ROLE_GROUPS.requestStatusEdit), updateRequestRecord);
requestsRouter.delete("/:id", authorizeRoles("admin"), deleteRequestRecord);
