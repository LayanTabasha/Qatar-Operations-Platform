import { Router } from "express";
import { authenticate, authorizeRoles } from "../auth/auth.middleware.js";
import { createUser, listUsers } from "./users.controller.js";

export const usersRouter = Router();

usersRouter.use(authenticate);
usersRouter.use(authorizeRoles("admin"));

usersRouter.get("/", listUsers);
usersRouter.post("/", createUser);
