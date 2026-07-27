import { asyncHandler } from "../../utils/async-handler.js";
import { createNewUser, getUserById, getUsers, resetUserPassword, updateExistingUser, updateExistingUserStatus } from "./users.service.js";
import { createUserSchema, resetPasswordSchema, updateUserSchema, updateUserStatusSchema, userIdParamsSchema } from "./users.validation.js";

export const listUsers = asyncHandler(async (_req, res) => {
  const users = await getUsers();

  res.json({
    success: true,
    users,
  });
});

export const createUser = asyncHandler(async (req, res) => {
  const input = createUserSchema.parse(req.body);
  const user = await createNewUser(input);

  res.status(201).json({
    success: true,
    user,
  });
});

export const getUser = asyncHandler(async (req, res) => {
  const { id } = userIdParamsSchema.parse(req.params);
  const user = await getUserById(id);

  res.json({
    success: true,
    user,
  });
});

export const updateUser = asyncHandler(async (req, res) => {
  const { id } = userIdParamsSchema.parse(req.params);
  const input = updateUserSchema.parse(req.body);
  const user = await updateExistingUser(req.user.id, id, input);

  res.json({
    success: true,
    user,
  });
});

export const updateUserStatus = asyncHandler(async (req, res) => {
  const { id } = userIdParamsSchema.parse(req.params);
  const input = updateUserStatusSchema.parse(req.body);
  const user = await updateExistingUserStatus(req.user.id, id, input);

  res.json({
    success: true,
    user,
  });
});

export const resetPassword = asyncHandler(async (req, res) => {
  const { id } = userIdParamsSchema.parse(req.params);
  const input = resetPasswordSchema.parse(req.body);
  const user = await resetUserPassword(id, input);

  res.json({
    success: true,
    user,
  });
});
