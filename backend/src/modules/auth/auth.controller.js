import { asyncHandler } from "../../utils/async-handler.js";
import { clearAuthCookie, setAuthCookie } from "./auth.cookies.js";
import { getCurrentUser, loginUser } from "./auth.service.js";
import { loginSchema } from "./auth.validation.js";

export const login = asyncHandler(async (req, res) => {
  const credentials = loginSchema.parse(req.body);
  const { token, user } = await loginUser(credentials);

  setAuthCookie(res, token);

  res.json({
    success: true,
    user,
  });
});

export function logout(_req, res) {
  clearAuthCookie(res);

  res.json({
    success: true,
  });
}

export const me = asyncHandler(async (req, res) => {
  const user = await getCurrentUser(req.user.id);

  res.json({
    success: true,
    user,
  });
});
