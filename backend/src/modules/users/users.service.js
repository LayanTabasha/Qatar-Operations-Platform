import bcrypt from "bcryptjs";
import { ApiError } from "../../utils/api-error.js";
import {
  countActiveAdmins,
  createUser,
  findRoleByName,
  findUserById,
  listUsers,
  updateUserById,
  updateUserPasswordById,
  updateUserStatusById,
} from "./users.repository.js";

const validRoleMessage = "Role must be admin, operations_staff, or viewer";

function safeUser(user) {
  return user;
}

export async function getUsers() {
  return listUsers({ limit: 100 });
}

export async function getUserById(id) {
  const user = await findUserById(id);

  if (!user) {
    throw new ApiError(404, "USER_NOT_FOUND", "User not found");
  }

  return safeUser(user);
}

export async function createNewUser(input) {
  const requestedRole = input.role || "operations_staff";
  const role = await findRoleByName(requestedRole);

  if (!role) {
    throw new ApiError(400, "INVALID_ROLE", validRoleMessage);
  }

  const password_hash = await bcrypt.hash(input.password, 12);

  try {
    const user = await createUser({
      full_name: input.full_name,
      email: input.email,
      password_hash,
      role_id: role.id,
    });

    return {
      ...user,
      role: role.name,
    };
  } catch (err) {
    if (err.code === "23505") {
      throw new ApiError(409, "EMAIL_ALREADY_EXISTS", "A user with this email already exists");
    }

    throw err;
  }
}

async function ensureAdminRoleChangeIsSafe(currentAdminId, targetUser, nextRole) {
  if (targetUser.id === currentAdminId && nextRole && nextRole !== "admin") {
    throw new ApiError(400, "CANNOT_DEMOTE_SELF", "You cannot remove your own Administrator role");
  }

  if (targetUser.role === "admin" && nextRole && nextRole !== "admin" && (await countActiveAdmins()) <= 1) {
    throw new ApiError(400, "LAST_ADMIN_PROTECTED", "At least one active Administrator must remain");
  }
}

export async function updateExistingUser(currentAdminId, id, input) {
  const targetUser = await getUserById(id);
  const updates = {};

  if (input.full_name !== undefined) updates.full_name = input.full_name;

  if (input.role !== undefined) {
    await ensureAdminRoleChangeIsSafe(currentAdminId, targetUser, input.role);
    const role = await findRoleByName(input.role);
    if (!role) throw new ApiError(400, "INVALID_ROLE", validRoleMessage);
    updates.role_id = role.id;
  }

  const user = await updateUserById(id, updates);
  if (!user) throw new ApiError(404, "USER_NOT_FOUND", "User not found");
  return safeUser(user);
}

export async function updateExistingUserStatus(currentAdminId, id, input) {
  const targetUser = await getUserById(id);
  const isActive = input.is_active !== undefined ? input.is_active : input.status === "active";

  if (targetUser.id === currentAdminId && !isActive) {
    throw new ApiError(400, "CANNOT_DEACTIVATE_SELF", "You cannot deactivate your own account");
  }

  if (targetUser.role === "admin" && !isActive && (await countActiveAdmins()) <= 1) {
    throw new ApiError(400, "LAST_ADMIN_PROTECTED", "At least one active Administrator must remain");
  }

  const user = await updateUserStatusById(id, isActive);
  if (!user) throw new ApiError(404, "USER_NOT_FOUND", "User not found");
  return safeUser(user);
}

export async function resetUserPassword(id, input) {
  await getUserById(id);
  const passwordHash = await bcrypt.hash(input.password, 12);
  const user = await updateUserPasswordById(id, passwordHash);
  if (!user) throw new ApiError(404, "USER_NOT_FOUND", "User not found");
  return safeUser(user);
}
