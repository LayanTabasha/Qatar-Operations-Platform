import { env } from "../../config/env.js";
import { ApiError } from "../../utils/api-error.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { getCurrentUser, verifyAuthToken } from "./auth.service.js";

export const authenticate = asyncHandler(async (req, _res, next) => {
  const token = req.cookies?.[env.AUTH_COOKIE_NAME];

  if (!token) {
    throw new ApiError(401, "UNAUTHENTICATED", "Authentication required");
  }

  const payload = verifyAuthToken(token);
  req.user = await getCurrentUser(payload.sub);
  next();
});

export function authorizeRoles(...allowedRoles) {
  return (req, _res, next) => {
    if (!req.user) {
      next(new ApiError(401, "UNAUTHENTICATED", "Authentication required"));
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      next(new ApiError(403, "FORBIDDEN", "You do not have permission to perform this action"));
      return;
    }

    next();
  };
}
