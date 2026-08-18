import { ApiError } from "../../utils/api-error.js";
import { archiveFaultById, findFaultById, insertFault, listFaults, updateFaultById } from "./faults.repository.js";
import { chargerBelongsToSite } from "../operational-relations/operational-relations.repository.js";

function writeError(error) {
  if (error.code === "23503") throw new ApiError(400, "INVALID_FAULT_RELATIONSHIP", "Choose an active site, charger, catalogue record, and assignee");
  if (error.code === "23514") throw new ApiError(400, "INVALID_FAULT_VALUE", "One or more fault values are invalid");
  throw error;
}
export const getFaults = (query) => listFaults(query);
export async function getFault(id) { const fault = await findFaultById(id); if (!fault) throw new ApiError(404, "FAULT_NOT_FOUND", "Fault not found"); return fault; }
async function validateRelationship(siteId, chargerId) { if (!(await chargerBelongsToSite(chargerId, siteId))) throw new ApiError(400, "INVALID_FAULT_RELATIONSHIP", "The selected charger does not belong to the selected active site"); }
export async function createFault(input, userId) { try { await validateRelationship(input.site_id, input.charger_id); return await insertFault({ ...input, photo_path: null, created_by: userId, updated_by: userId }); } catch (error) { writeError(error); } }
export async function updateFault(id, input, userId, audit = {}) { try { const current=await getFault(id); await validateRelationship(input.site_id ?? current.site_id, input.charger_id ?? current.charger_id); const fault = await updateFaultById(id, { ...input, updated_by: userId }, audit); if (!fault) throw new ApiError(404, "FAULT_NOT_FOUND", "Fault not found"); return fault; } catch (error) { writeError(error); } }
export async function archiveFault(id, userId, audit = {}) { const current=await getFault(id); const result = await archiveFaultById(id, userId, current, audit); if (!result) throw new ApiError(404, "FAULT_NOT_FOUND", "Fault not found"); }
