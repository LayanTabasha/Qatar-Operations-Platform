import { env } from "../../config/env.js";

export function authCookieOptions() {
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAME_SITE,
    maxAge: 8 * 60 * 60 * 1000,
    path: "/",
  };
}

export function setAuthCookie(res, token) {
  res.cookie(env.AUTH_COOKIE_NAME, token, authCookieOptions());
}

export function clearAuthCookie(res) {
  res.clearCookie(env.AUTH_COOKIE_NAME, {
    ...authCookieOptions(),
    maxAge: undefined,
  });
}
