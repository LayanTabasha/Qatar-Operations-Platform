import { env } from "../config/env.js";
import { logger } from "../config/logger.js";

export function errorHandler(err, req, res, _next) {
  const isValidationError = err.name === "ZodError";
  const statusCode = isValidationError ? 400 : err.statusCode || 500;
  const code = isValidationError ? "VALIDATION_ERROR" : err.code || "INTERNAL_SERVER_ERROR";
  const message = statusCode === 500 ? "Internal server error" : err.message;

  const logMetadata = { err, requestId: req.id, statusCode };
  const logMessage = "Request failed";

  if (statusCode >= 500) {
    logger.error(logMetadata, logMessage);
  } else {
    logger.warn(logMetadata, logMessage);
  }

  const response = {
    success: false,
    error: {
      code,
      message,
      requestId: req.id,
    },
  };

  if (env.NODE_ENV !== "production" && err.stack) {
    response.error.stack = err.stack;
  }

  res.status(statusCode).json(response);
}
