import { Router } from "express";
import { getDatabaseHealth, getHealth } from "./health.controller.js";

export const healthRouter = Router();

healthRouter.get("/", getHealth);
healthRouter.get("/database", getDatabaseHealth);
