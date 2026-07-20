import { asyncHandler } from "../../utils/async-handler.js";
import { createNewUser, getUsers } from "./users.service.js";
import { createUserSchema } from "./users.validation.js";

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
