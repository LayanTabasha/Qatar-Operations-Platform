import { ApiError } from "../../utils/api-error.js";
import { findSiteVisitById, insertSiteVisit, listSiteVisits, updateSiteVisitById } from "./site-visits.repository.js";

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

export async function createSiteVisit(input, currentUserId) {
  try {
    return await insertSiteVisit({
      ...input,
      follow_up_required: input.status === "follow_up_required" || input.follow_up_required === true,
      created_by: currentUserId,
      updated_by: currentUserId,
    });
  } catch (err) {
    handleSiteVisitWriteError(err);
  }
}

export async function updateSiteVisit(id, input, currentUserId) {
  try {
    const updates = {
      ...input,
      updated_by: currentUserId,
    };
    if (input.status) updates.follow_up_required = input.status === "follow_up_required";
    const visit = await updateSiteVisitById(id, updates);
    if (!visit) throw new ApiError(404, "SITE_VISIT_NOT_FOUND", "Site visit not found");
    return visit;
  } catch (err) {
    handleSiteVisitWriteError(err);
  }
}
