import { Router } from "express";
import { loginRateLimit } from "../../middleware/rate-limit.js";
import { authenticate } from "./auth.middleware.js";
import { login, logout, me } from "./auth.controller.js";

export const authRouter = Router();

authRouter.post("/login", loginRateLimit, login);
authRouter.post("/logout", logout);
authRouter.get("/me", authenticate, me);
