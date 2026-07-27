import { Router } from "express";
import { authRouter } from "../modules/auth/auth.routes.js";
import { chargersRouter } from "../modules/chargers/chargers.routes.js";
import { dtcRouter } from "../modules/dtc/dtc.routes.js";
import { healthRouter } from "../modules/health/health.routes.js";
import { siteVisitsRouter } from "../modules/site-visits/site-visits.routes.js";
import { sitesRouter } from "../modules/sites/sites.routes.js";
import { usersRouter } from "../modules/users/users.routes.js";

export const apiRouter = Router();

apiRouter.use("/auth", authRouter);
apiRouter.use("/chargers", chargersRouter);
apiRouter.use("/dtc", dtcRouter);
apiRouter.use("/health", healthRouter);
apiRouter.use("/site-visits", siteVisitsRouter);
apiRouter.use("/sites", sitesRouter);
apiRouter.use("/users", usersRouter);
