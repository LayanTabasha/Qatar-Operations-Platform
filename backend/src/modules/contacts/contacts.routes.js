import { Router } from "express";
import { authenticate, authorizeRoles } from "../auth/auth.middleware.js";
import { ROLE_GROUPS } from "../auth/permissions.js";
import { createContactRecord, deleteContactRecord, getContactRecord, listContactRecords, updateContactRecord } from "./contacts.controller.js";

export const contactsRouter = Router();
contactsRouter.use(authenticate);
contactsRouter.get("/", authorizeRoles(...ROLE_GROUPS.authenticatedRead), listContactRecords);
contactsRouter.get("/:id", authorizeRoles(...ROLE_GROUPS.authenticatedRead), getContactRecord);
contactsRouter.post("/", authorizeRoles(...ROLE_GROUPS.adminOnly), createContactRecord);
contactsRouter.patch("/:id", authorizeRoles(...ROLE_GROUPS.adminOnly), updateContactRecord);
contactsRouter.delete("/:id", authorizeRoles(...ROLE_GROUPS.adminOnly), deleteContactRecord);
