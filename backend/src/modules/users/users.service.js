import bcrypt from "bcryptjs";
import { ApiError } from "../../utils/api-error.js";
import { createUser, findRoleByName, listUsers } from "./users.repository.js";

export async function getUsers() {
  return listUsers({ limit: 100 });
}

export async function createNewUser(input) {
  const role = await findRoleByName(input.role);

  if (!role) {
    throw new ApiError(400, "INVALID_ROLE", "Role must be admin, operator, or viewer");
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
