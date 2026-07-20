import { asyncHandler } from "../../utils/async-handler.js";
import { createSite, getSite, getSites, updateSite, updateSiteStatus } from "./sites.service.js";
import {
  createSiteSchema,
  listSitesQuerySchema,
  siteIdParamsSchema,
  updateSiteSchema,
  updateSiteStatusSchema,
} from "./sites.validation.js";

export const listSites = asyncHandler(async (req, res) => {
  const query = listSitesQuerySchema.parse(req.query);
  const sites = await getSites(query);

  res.json({
    success: true,
    sites,
  });
});

export const getSiteById = asyncHandler(async (req, res) => {
  const { id } = siteIdParamsSchema.parse(req.params);
  const site = await getSite(id);

  res.json({
    success: true,
    site,
  });
});

export const createSiteRecord = asyncHandler(async (req, res) => {
  const input = createSiteSchema.parse(req.body);
  const site = await createSite(input);

  res.status(201).json({
    success: true,
    site,
  });
});

export const updateSiteRecord = asyncHandler(async (req, res) => {
  const { id } = siteIdParamsSchema.parse(req.params);
  const input = updateSiteSchema.parse(req.body);
  const site = await updateSite(id, input);

  res.json({
    success: true,
    site,
  });
});

export const updateSiteStatusRecord = asyncHandler(async (req, res) => {
  const { id } = siteIdParamsSchema.parse(req.params);
  const { status } = updateSiteStatusSchema.parse(req.body);
  const site = await updateSiteStatus(id, status);

  res.json({
    success: true,
    site,
  });
});
