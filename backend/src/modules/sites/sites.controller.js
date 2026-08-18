import fs from "node:fs/promises";
import { logger } from "../../config/logger.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { ApiError } from "../../utils/api-error.js";
import { publicPathForSiteImage } from "./site-image-upload.middleware.js";
import { archiveSite, createSite, getSite, getSites, permanentlyDeleteSite, restoreSite, updateSite, updateSiteImage, updateSiteStatus } from "./sites.service.js";
import {
  createSiteSchema,
  archiveReasonSchema,
  listSitesQuerySchema,
  siteIdParamsSchema,
  updateSiteSchema,
  updateSiteStatusSchema,
} from "./sites.validation.js";

function auditContext(req) {
  return { ipAddress: req.ip, requestId: req.id };
}

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

export const ensureSiteExistsForImage = asyncHandler(async (req, _res, next) => {
  const { id } = siteIdParamsSchema.parse(req.params);
  req.site = await getSite(id);
  next();
});

export const uploadSiteImageRecord = asyncHandler(async (req, res) => {
  const { id } = siteIdParamsSchema.parse(req.params);

  if (!req.file) {
    throw new ApiError(400, "IMAGE_REQUIRED", "Choose a site image before uploading");
  }

  const imagePath = publicPathForSiteImage(req.file);
  let site;

  try {
    site = await updateSiteImage(id, imagePath);
  } catch (err) {
    logger.error(
      {
        err,
        siteId: id,
        filename: req.file.filename,
        statusCode: err.statusCode || 500,
      },
      "Site image database update failed",
    );
    await fs.unlink(req.file.path).catch(() => {});
    throw err;
  }

  logger.info(
    {
      siteId: id,
      filename: req.file.filename,
      imagePath,
    },
    "Site image uploaded",
  );

  res.json({
    success: true,
    image_path: imagePath,
    site,
  });
});

export const archiveSiteRecord = asyncHandler(async (req, res) => {
  const { id } = siteIdParamsSchema.parse(req.params);
  const { reason } = archiveReasonSchema.parse(req.body || {});
  const site = await archiveSite(id, req.user.id, reason, auditContext(req));
  res.json({ success: true, site });
});

export const restoreSiteRecord = asyncHandler(async (req, res) => {
  const { id } = siteIdParamsSchema.parse(req.params);
  const site = await restoreSite(id, req.user.id, auditContext(req));
  res.json({ success: true, site });
});

export const permanentlyDeleteSiteRecord = asyncHandler(async (req, res) => {
  const { id } = siteIdParamsSchema.parse(req.params);
  await permanentlyDeleteSite(id, req.user.id, auditContext(req));
  res.status(204).send();
});
