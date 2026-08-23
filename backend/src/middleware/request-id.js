import crypto from "node:crypto";

export function requestId(req, res, next) {
  const existingRequestId = req.get("x-request-id");
  req.id = existingRequestId || crypto.randomUUID();
  res.setHeader("x-request-id", req.id);
  next();
}
