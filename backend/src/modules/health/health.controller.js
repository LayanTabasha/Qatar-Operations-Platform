import { testDatabaseConnection } from "../../config/database.js";
import { asyncHandler } from "../../utils/async-handler.js";

export function getHealth(_req, res) {
  res.json({
    success: true,
    status: "ok",
    service: "Qatar Operations API",
  });
}

export const getDatabaseHealth = asyncHandler(async (_req, res) => {
  await testDatabaseConnection();

  res.json({
    success: true,
    status: "ok",
    database: "reachable",
  });
});
