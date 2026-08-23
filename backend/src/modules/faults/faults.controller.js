import { asyncHandler } from "../../utils/async-handler.js";
import { archiveFault, createFault, getFault, getFaults, updateFault } from "./faults.service.js";
import { createFaultSchema, faultIdParamsSchema, listFaultsQuerySchema, updateFaultSchema } from "./faults.validation.js";
export const listFaultRecords = asyncHandler(async (req,res) => res.json({ success:true, faults:await getFaults(listFaultsQuerySchema.parse(req.query)) }));
export const getFaultRecord = asyncHandler(async (req,res) => res.json({ success:true, fault:await getFault(faultIdParamsSchema.parse(req.params).id) }));
const audit = (req) => ({ ipAddress: req.ip, requestId: req.id });
export const createFaultRecord = asyncHandler(async (req,res) => res.status(201).json({ success:true, fault:await createFault(createFaultSchema.parse(req.body), req.user.id, audit(req)) }));
export const updateFaultRecord = asyncHandler(async (req,res) => res.json({ success:true, fault:await updateFault(faultIdParamsSchema.parse(req.params).id, updateFaultSchema.parse(req.body), req.user.id, audit(req)) }));
export const archiveFaultRecord = asyncHandler(async (req,res) => { await archiveFault(faultIdParamsSchema.parse(req.params).id, req.user.id, audit(req)); res.status(204).end(); });
