import { Router } from "express";
import { authenticate, authorizeRoles } from "../auth/auth.middleware.js";
import { createUser, getUser, listUsers, resetPassword, updateUser, updateUserStatus } from "./users.controller.js";

export const usersRouter = Router();

usersRouter.use(authenticate);
usersRouter.use(authorizeRoles("admin"));

usersRouter.get("/", listUsers);
usersRouter.post("/", createUser);
usersRouter.get("/:id", getUser);
usersRouter.patch("/:id", updateUser);
usersRouter.patch("/:id/status", updateUserStatus);
usersRouter.post("/:id/reset-password", resetPassword);
