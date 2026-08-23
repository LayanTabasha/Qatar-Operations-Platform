import { asyncHandler } from "../../utils/async-handler.js";
import { createSiteVisit, deleteSiteVisit, getSiteVisit, getSiteVisits, updateSiteVisit } from "./site-visits.service.js";
import {
  createSiteVisitSchema,
  listSiteVisitsQuerySchema,
  siteVisitIdParamsSchema,
  updateSiteVisitSchema,
} from "./site-visits.validation.js";

export const listSiteVisitRecords = asyncHandler(async (req, res) => {
  const query = listSiteVisitsQuerySchema.parse(req.query);
  const siteVisits = await getSiteVisits(query);

  res.json({
    success: true,
    site_visits: siteVisits,
  });
});

export const getSiteVisitRecord = asyncHandler(async (req, res) => {
  const { id } = siteVisitIdParamsSchema.parse(req.params);
  const siteVisit = await getSiteVisit(id);

  res.json({
    success: true,
    site_visit: siteVisit,
  });
});

export const createSiteVisitRecord = asyncHandler(async (req, res) => {
  const input = createSiteVisitSchema.parse(req.body);
  const siteVisit = await createSiteVisit(input, req.user.id, { ipAddress: req.ip, requestId: req.id });

  res.status(201).json({
    success: true,
    site_visit: siteVisit,
  });
});

export const updateSiteVisitRecord = asyncHandler(async (req, res) => {
  const { id } = siteVisitIdParamsSchema.parse(req.params);
  const input = updateSiteVisitSchema.parse(req.body);
  const siteVisit = await updateSiteVisit(id, input, req.user.id, { ipAddress: req.ip, requestId: req.id });

  res.json({
    success: true,
    site_visit: siteVisit,
  });
});

export const deleteSiteVisitRecord = asyncHandler(async (req, res) => {
  const { id } = siteVisitIdParamsSchema.parse(req.params);
  await deleteSiteVisit(id, req.user.id, { ipAddress: req.ip, requestId: req.id });
  res.status(204).end();
});
