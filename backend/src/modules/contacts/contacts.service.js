import { ApiError } from "../../utils/api-error.js";
import { deactivateContactById, findContactById, insertContact, listContacts, updateContactById } from "./contacts.repository.js";

function writeError(error) {
  if (error.code === "23503") throw new ApiError(400, "INVALID_CONTACT_SITE", "Choose a valid site");
  throw error;
}
export const getContacts = (options) => listContacts(options);
export async function getContact(id) { const contact = await findContactById(id); if (!contact) throw new ApiError(404, "CONTACT_NOT_FOUND", "Contact not found"); return contact; }
export async function createContact(input, actor) { try { return await insertContact(input, actor); } catch (error) { writeError(error); } }
export async function updateContact(id, input) {
  await getContact(id);
  try { const contact = await updateContactById(id, input); if (!contact) throw new ApiError(404, "CONTACT_NOT_FOUND", "Contact not found"); return contact; } catch (error) { writeError(error); }
}
export async function deleteContact(id) { if (!await deactivateContactById(id)) throw new ApiError(404, "CONTACT_NOT_FOUND", "Contact not found"); }
