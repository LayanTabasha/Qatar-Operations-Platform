import { Router } from "express";
import { z } from "zod";
import { authenticate, authorizeRoles } from "../auth/auth.middleware.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { ApiError } from "../../utils/api-error.js";
import { deleteContentRecord, findContentRecord, insertContentRecord, listContentRecords, updateContentRecord } from "./content-records.repository.js";
import { removeDeletedAttachmentFiles } from "../attachments/attachments.service.js";
import { chargerBelongsToSite } from "../operational-relations/operational-relations.repository.js";
import { ROLE_GROUPS } from "../auth/permissions.js";

const idSchema=z.string().uuid();
const nullableUuid=z.string().uuid().nullable().optional();
const common={site_id:nullableUuid,charger_id:nullableUuid,title:z.string().trim().min(1).max(200)};
const schemas={
  documents:z.object({...common,document_type:z.string().trim().min(1).max(100),description:z.string().trim().max(5000).nullable().optional(),document_date:z.coerce.date().transform((d)=>d.toISOString().slice(0,10))}),
  "weekly-reports":z.object({site_id:nullableUuid,title:common.title,period_start:z.coerce.date().transform((d)=>d.toISOString().slice(0,10)),period_end:z.coerce.date().transform((d)=>d.toISOString().slice(0,10)),notes:z.string().trim().max(10000).nullable().optional()}),
  troubleshooting:z.object({...common,issue_category:z.string().trim().min(1).max(100),symptoms:z.string().trim().max(5000).nullable().optional(),possible_cause:z.string().trim().max(5000).nullable().optional(),troubleshooting_steps:z.string().trim().max(10000).nullable().optional(),resolution:z.string().trim().max(5000).nullable().optional(),notes:z.string().trim().max(5000).nullable().optional()}),
};

async function validateContentRelationship(type, input, current = {}) {
  if (type === "weekly-reports") return;
  const siteId = input.site_id !== undefined ? input.site_id : current.site_id;
  const chargerId = input.charger_id !== undefined ? input.charger_id : current.charger_id;
  if (!(await chargerBelongsToSite(chargerId, siteId))) throw new ApiError(400, "INVALID_CONTENT_RELATIONSHIP", "The selected charger does not belong to the selected operational site");
}

export function contentRecordsRouter(type) {
  const router=Router(); router.use(authenticate);
  const audit=(req)=>({ipAddress:req.ip,requestId:req.id});
  router.get("/",authorizeRoles(...ROLE_GROUPS.authenticatedRead),asyncHandler(async(_req,res)=>res.json({success:true,records:await listContentRecords(type)})));
  router.get("/:id",authorizeRoles(...ROLE_GROUPS.authenticatedRead),asyncHandler(async(req,res)=>{const record=await findContentRecord(type,idSchema.parse(req.params.id));if(!record)throw new ApiError(404,"RECORD_NOT_FOUND","Record not found");res.json({success:true,record});}));
  router.post("/",authorizeRoles(...ROLE_GROUPS.operationalManage),asyncHandler(async(req,res)=>{const input=schemas[type].parse(req.body);await validateContentRelationship(type,input);res.status(201).json({success:true,record:await insertContentRecord(type,input,req.user.id)});}));
  router.patch("/:id",authorizeRoles(...ROLE_GROUPS.operationalManage),asyncHandler(async(req,res)=>{const id=idSchema.parse(req.params.id);const input=schemas[type].partial().parse(req.body);const current=await findContentRecord(type,id);if(!current)throw new ApiError(404,"RECORD_NOT_FOUND","Record not found");await validateContentRelationship(type,input,current);const record=await updateContentRecord(type,id,input,req.user.id,audit(req));if(!record)throw new ApiError(404,"RECORD_NOT_FOUND","Record not found");res.json({success:true,record});}));
  router.delete("/:id",authorizeRoles(...ROLE_GROUPS.operationalManage),asyncHandler(async(req,res)=>{const id=idSchema.parse(req.params.id);const record=await findContentRecord(type,id);if(!record)throw new ApiError(404,"RECORD_NOT_FOUND","Record not found");const deleted=await deleteContentRecord(type,id,req.user.id,record,audit(req));if(!deleted)throw new ApiError(404,"RECORD_NOT_FOUND","Record not found");await removeDeletedAttachmentFiles(deleted.attachments);res.status(204).end();}));
  return router;
}
