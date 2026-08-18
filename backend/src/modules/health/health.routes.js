import { Router } from "express";
import { authenticate, authorizeRoles } from "../auth/auth.middleware.js";
import { getDatabaseHealth, getDetailedPlatformHealth, getHealth } from "./health.controller.js";

export const healthRouter = Router();

healthRouter.get("/", getHealth);
healthRouter.get("/database", getDatabaseHealth);
healthRouter.get("/platform", authenticate, authorizeRoles("admin"), getDetailedPlatformHealth);
