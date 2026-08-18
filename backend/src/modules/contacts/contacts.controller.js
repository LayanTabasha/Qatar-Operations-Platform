import { asyncHandler } from "../../utils/async-handler.js";
import { createContact, deleteContact, getContact, getContacts, updateContact } from "./contacts.service.js";
import { contactIdParamsSchema, createContactSchema, listContactsQuerySchema, updateContactSchema } from "./contacts.validation.js";

export const listContactRecords = asyncHandler(async (req, res) => res.json({ success: true, contacts: await getContacts(listContactsQuerySchema.parse(req.query)) }));
export const getContactRecord = asyncHandler(async (req, res) => res.json({ success: true, contact: await getContact(contactIdParamsSchema.parse(req.params).id) }));
export const createContactRecord = asyncHandler(async (req, res) => res.status(201).json({ success: true, contact: await createContact(createContactSchema.parse(req.body), req.user.id) }));
export const updateContactRecord = asyncHandler(async (req, res) => res.json({ success: true, contact: await updateContact(contactIdParamsSchema.parse(req.params).id, updateContactSchema.parse(req.body)) }));
export const deleteContactRecord = asyncHandler(async (req, res) => { await deleteContact(contactIdParamsSchema.parse(req.params).id); res.json({ success: true, message: "Contact deleted" }); });
