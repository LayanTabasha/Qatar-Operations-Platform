import { asyncHandler } from "../../utils/async-handler.js";
import { listArchivedChargers } from "../chargers/chargers.repository.js";
import { listArchivedSites } from "../sites/sites.repository.js";

export const getArchivedSites = asyncHandler(async (_req, res) => {
  res.json({ success: true, sites: await listArchivedSites() });
});

export const getArchivedChargers = asyncHandler(async (_req, res) => {
  res.json({ success: true, chargers: await listArchivedChargers() });
});
