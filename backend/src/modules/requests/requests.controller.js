import { asyncHandler } from "../../utils/async-handler.js";
import { ApiError } from "../../utils/api-error.js";
import { createRequest, deleteRequest, getRequest, getRequests, updateRequest } from "./requests.service.js";
import { adminUpdateRequestSchema, createRequestSchema, hqUpdateRequestSchema, listRequestsQuerySchema, requestIdParamsSchema } from "./requests.validation.js";

const audit = (req) => ({ ipAddress: req.ip, requestId: req.id });
export const listRequestRecords = asyncHandler(async (req, res) => res.json({ success: true, requests: await getRequests(listRequestsQuerySchema.parse(req.query)) }));
export const getRequestRecord = asyncHandler(async (req, res) => res.json({ success: true, request: await getRequest(requestIdParamsSchema.parse(req.params).id) }));
export const createRequestRecord = asyncHandler(async (req, res) => res.status(201).json({ success: true, request: await createRequest(createRequestSchema.parse(req.body), req.user.id, audit(req)) }));
export const updateRequestRecord = asyncHandler(async (req, res) => {
  if (req.user.role === "admin" && Object.hasOwn(req.body, "hq_response")) {
    throw new ApiError(403, "FORBIDDEN", "Only HQ users can update the HQ response");
  }
  const schema = req.user.role === "admin" ? adminUpdateRequestSchema : hqUpdateRequestSchema;
  res.json({ success: true, request: await updateRequest(requestIdParamsSchema.parse(req.params).id, schema.parse(req.body), req.user.id, audit(req), req.user.role) });
});
export const deleteRequestRecord = asyncHandler(async (req, res) => {
  const id = requestIdParamsSchema.parse(req.params).id;
  await deleteRequest(id, req.user.id, audit(req));
  res.json({ success: true, message: "Request removed from active Operations Requests" });
});
