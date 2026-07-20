import { Router } from "express";
import { authRouter } from "../modules/auth/auth.routes.js";
import { chargersRouter } from "../modules/chargers/chargers.routes.js";
import { healthRouter } from "../modules/health/health.routes.js";
import { sitesRouter } from "../modules/sites/sites.routes.js";
import { usersRouter } from "../modules/users/users.routes.js";

export const apiRouter = Router();

apiRouter.use("/auth", authRouter);
apiRouter.use("/chargers", chargersRouter);
apiRouter.use("/health", healthRouter);
apiRouter.use("/sites", sitesRouter);
apiRouter.use("/users", usersRouter);
