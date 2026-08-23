import cors from "cors";
import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { siteImageUploadRoot } from "./modules/sites/site-image-upload.middleware.js";
import { corsOptions } from "./config/cors.js";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { errorHandler } from "./middleware/error-handler.js";
import { notFound } from "./middleware/not-found.js";
import { apiRateLimit } from "./middleware/rate-limit.js";
import { requestId } from "./middleware/request-id.js";
import { getHealth } from "./modules/health/health.controller.js";
import { apiRouter } from "./routes/index.js";

export const app = express();

app.set("trust proxy", env.TRUST_PROXY);

app.use(helmet());
app.use(cors(corsOptions));
app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(requestId);
app.use(
  pinoHttp({
    logger,
    genReqId: (req) => req.id,
  }),
);
app.use(apiRateLimit);

app.get("/api/health", getHealth);
app.use("/uploads/site-images", express.static(siteImageUploadRoot));
app.use("/api/v1", apiRouter);

app.use(notFound);
app.use(errorHandler);
