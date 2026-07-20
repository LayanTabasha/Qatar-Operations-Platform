import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import { ApiError } from "../../utils/api-error.js";
import { findSafeUserById, findUserWithPasswordByEmail, updateLastLoginAt } from "./auth.repository.js";

const invalidCredentialsError = new ApiError(401, "INVALID_CREDENTIALS", "Invalid email or password");

export function toSafeUser(user) {
  return {
    id: user.id,
    full_name: user.full_name,
    email: user.email,
    role: user.role,
    is_active: user.is_active,
  };
}

export function signAuthToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
    },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN },
  );
}

export function verifyAuthToken(token) {
  try {
    return jwt.verify(token, env.JWT_SECRET);
  } catch {
    throw new ApiError(401, "UNAUTHENTICATED", "Authentication required");
  }
}

export async function loginUser({ email, password }) {
  const user = await findUserWithPasswordByEmail(email);

  if (!user || !user.is_active) {
    throw invalidCredentialsError;
  }

  const passwordMatches = await bcrypt.compare(password, user.password_hash);

  if (!passwordMatches) {
    throw invalidCredentialsError;
  }

  await updateLastLoginAt(user.id);

  return {
    token: signAuthToken(user),
    user: toSafeUser(user),
  };
}

export async function getCurrentUser(userId) {
  const user = await findSafeUserById(userId);

  if (!user || !user.is_active) {
    throw new ApiError(401, "UNAUTHENTICATED", "Authentication required");
  }

  return toSafeUser(user);
}
