import { ApiError } from "../../utils/api-error.js";
import { chargerBelongsToSite } from "../operational-relations/operational-relations.repository.js";
import { findLinkableFaultById, findRequestById, findRequestByIdIncludingDeleted, insertRequest, listRequests, softDeleteRequestById, updateRequestById } from "./requests.repository.js";

const transitions = { open: new Set(["in_progress", "completed"]), in_progress: new Set(["completed"]), completed: new Set(["in_progress"]) };
function writeError(error) {
  if (error.code === "23503") throw new ApiError(400, "INVALID_REQUEST_RELATIONSHIP", "Choose a valid site, charger, or assignee");
  if (error.code === "23514") throw new ApiError(400, "INVALID_REQUEST_VALUE", "One or more request values are invalid");
  throw error;
}
async function validateAndNormalizeContext(input, current = {}) {
  const updates = { ...input };
  const resulting = { ...current, ...updates };

  if (resulting.fault_id) {
    const fault = await findLinkableFaultById(resulting.fault_id);
    if (!fault || fault.archived_at) throw new ApiError(400, "INVALID_REQUEST_FAULT", "Choose an active Fault");

    if (!resulting.site_id) {
      updates.site_id = fault.site_id;
      resulting.site_id = fault.site_id;
    } else if (resulting.site_id !== fault.site_id) {
      throw new ApiError(400, "REQUEST_FAULT_SITE_MISMATCH", "Selected fault does not belong to the selected site.");
    }

    if (fault.charger_id) {
      if (!resulting.charger_id) {
        updates.charger_id = fault.charger_id;
        resulting.charger_id = fault.charger_id;
      } else if (resulting.charger_id !== fault.charger_id) {
        throw new ApiError(400, "REQUEST_FAULT_CHARGER_MISMATCH", "Selected fault does not belong to the selected charger.");
      }
    }
  }

  if (resulting.charger_id && !(await chargerBelongsToSite(resulting.charger_id, resulting.site_id))) {
    throw new ApiError(400, "REQUEST_CHARGER_SITE_MISMATCH", "Selected charger does not belong to the selected site.");
  }

  return updates;
}
export const getRequests = (options) => listRequests(options);
export async function getRequest(id) { const item = await findRequestById(id); if (!item) throw new ApiError(404, "REQUEST_NOT_FOUND", "Request not found"); return item; }
export async function createRequest(input, actor, audit) {
  const normalized = await validateAndNormalizeContext(input);
  try { return await insertRequest(normalized, actor, audit); } catch (error) { writeError(error); }
}
export async function updateRequest(id, input, actor, audit, actorRole = "admin") {
  const current = await getRequest(id), updates = await validateAndNormalizeContext(input, current);
  const effectiveResponse = Object.hasOwn(input, "hq_response") ? input.hq_response : current.hq_response;
  if (actorRole !== "admin" && input.status === "completed" && !effectiveResponse) {
    throw new ApiError(400, "HQ_RESPONSE_REQUIRED", "HQ Response is required before completing a request");
  }
  if (input.status && input.status !== current.status) {
    if (!transitions[current.status]?.has(input.status)) throw new ApiError(400, "INVALID_STATUS_TRANSITION", `Cannot change request status from ${current.status} to ${input.status}`);
    if (input.status === "in_progress") { if (!current.started_at) updates.started_at = new Date().toISOString(); if (current.status === "completed") updates.completed_at = null; }
    if (input.status === "completed") updates.completed_at = new Date().toISOString();
  }
  if (Object.hasOwn(input, "hq_response")) { updates.responded_by = actor; updates.responded_at = new Date().toISOString(); }
  try { return await updateRequestById(id, updates, actor, audit); } catch (error) { writeError(error); }
}
export async function deleteRequest(id, actor, audit) {
  const current = await findRequestByIdIncludingDeleted(id);
  if (!current || current.deleted_at) throw new ApiError(404, "REQUEST_NOT_FOUND", "Request not found");
  if (current.requested_by !== actor) throw new ApiError(403, "REQUEST_DELETE_FORBIDDEN", "Administrators may delete only Requests they created");
  await softDeleteRequestById(id, actor, audit);
}
