import { ApiError } from "../../utils/api-error.js";
import { logger } from "../../config/logger.js";
import { deleteSiteVisitAttachmentRecords } from "../attachments/attachments.repository.js";
import { removeDeletedAttachmentFiles } from "../attachments/attachments.service.js";
import { chargerBelongsToSite } from "../operational-relations/operational-relations.repository.js";
import { deleteSiteVisitById, findLinkedFaultIds, findSiteVisitById, insertSiteVisit, listSiteVisits, updateSiteVisitById } from "./site-visits.repository.js";
import { recalculateFaultStatuses, syncFaultLinks } from "./fault-site-visits.repository.js";
import { withTransaction } from "../../config/database.js";

function handleSiteVisitWriteError(err) {
  if (err.code === "23503") {
    throw new ApiError(400, "INVALID_SITE_VISIT_RELATIONSHIP", "Choose a valid site, charger, and user before saving the visit");
  }
  if (err.code === "23514") {
    throw new ApiError(400, "INVALID_SITE_VISIT_TIME", "Time Out cannot be earlier than Time In");
  }
  throw err;
}

export async function getSiteVisits(options) {
  return listSiteVisits(options);
}

export async function getSiteVisit(id) {
  const visit = await findSiteVisitById(id);
  if (!visit) throw new ApiError(404, "SITE_VISIT_NOT_FOUND", "Site visit not found");
  return visit;
}

async function validateRelationship(siteId, chargerId) {
  if (!(await chargerBelongsToSite(chargerId, siteId))) throw new ApiError(400, "INVALID_SITE_VISIT_RELATIONSHIP", "The selected charger does not belong to the selected operational site");
}

function validateCompletedVisit(record) {
  if (record.status === "completed" && !record.time_out) {
    throw new ApiError(400, "SITE_VISIT_TIME_OUT_REQUIRED", "Time Out is required when a Site Visit is completed.");
  }
}

export async function createSiteVisit(input, currentUserId) {
  try {
    await validateRelationship(input.site_id, input.charger_id);
    const { related_faults: relatedFaults = [], ...visitInput } = input;
    return await withTransaction(async (client) => {
      const visit = await insertSiteVisit({
        ...visitInput,
        follow_up_required: input.status === "follow_up_required" || input.follow_up_required === true,
        created_by: currentUserId,
        updated_by: currentUserId,
      }, client);
      if (relatedFaults.length) await syncFaultLinks(client, visit.id, visit.site_id, relatedFaults, currentUserId);
      return findSiteVisitById(visit.id, client);
    });
  } catch (err) {
    handleSiteVisitWriteError(err);
  }
}

export async function updateSiteVisit(id, input, currentUserId, audit = {}) {
  try {
    const current = await getSiteVisit(id);
    validateCompletedVisit({ ...current, ...input });
    await validateRelationship(input.site_id ?? current.site_id, Object.hasOwn(input, "charger_id") ? input.charger_id : current.charger_id);
    const { related_faults: relatedFaults, ...visitInput } = input;
    const updates = {
      ...visitInput,
      updated_by: currentUserId,
    };
    if (input.status) updates.follow_up_required = input.status === "follow_up_required";
    return await withTransaction(async (client) => {
      const visit = await updateSiteVisitById(id, updates, audit, client);
      if (!visit) throw new ApiError(404, "SITE_VISIT_NOT_FOUND", "Site visit not found");
      if (relatedFaults) await syncFaultLinks(client, id, visit.site_id, relatedFaults, currentUserId);
      return findSiteVisitById(id, client);
    });
  } catch (err) {
    handleSiteVisitWriteError(err);
  }
}

export async function deleteSiteVisit(id, currentUserId, audit = {}) {
  const visit = await getSiteVisit(id);
  const attachments = await withTransaction(async (client) => {
    const affectedFaults = await findLinkedFaultIds(id, client);
    const deletedAttachments = await deleteSiteVisitAttachmentRecords(id, client);
    if (!(await deleteSiteVisitById(id, currentUserId, visit, audit, client))) throw new ApiError(404, "SITE_VISIT_NOT_FOUND", "Site visit not found");
    await recalculateFaultStatuses(client, affectedFaults, currentUserId);
    return deletedAttachments;
  });
  try {
    await removeDeletedAttachmentFiles(attachments);
  } catch (err) {
    logger.error({ err, siteVisitId: id, attachmentCount: attachments.length }, "Site Visit deleted but attachment file cleanup failed");
  }
}
