import dotenv from "dotenv";

dotenv.config();

const API_BASE_URL = process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
const AUTH_BASE_URL = `${API_BASE_URL}/api/v1/auth`;

const cookieJar = new Map();

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required in backend/.env`);
  }
  return value;
}

function splitSetCookieHeader(headerValue) {
  if (!headerValue) return [];
  return headerValue.split(/,(?=\s*[^;,=\s]+=[^;,]*)/).map((value) => value.trim());
}

function storeSetCookieHeaders(response) {
  const headerValue = response.headers.get("set-cookie");
  const cookies = splitSetCookieHeader(headerValue);

  for (const cookie of cookies) {
    const [nameValue, ...attributes] = cookie.split(";").map((part) => part.trim());
    const [name, value] = nameValue.split("=");
    const expiresOrMaxAgeClearsCookie = attributes.some((attribute) => {
      const lower = attribute.toLowerCase();
      return lower === "max-age=0" || lower.startsWith("expires=thu, 01 jan 1970");
    });

    if (expiresOrMaxAgeClearsCookie || value === "") {
      cookieJar.delete(name);
      continue;
    }

    cookieJar.set(name, `${name}=${value}`);
  }
}

function cookieHeader() {
  return Array.from(cookieJar.values()).join("; ");
}

async function readJson(response) {
  return response.json().catch(() => ({}));
}

async function authRequest(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  const cookies = cookieHeader();

  if (cookies) {
    headers.Cookie = cookies;
  }

  const response = await fetch(`${AUTH_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  storeSetCookieHeaders(response);

  return {
    response,
    body: await readJson(response),
  };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function adminRoleMatches(role) {
  return String(role || "").toLowerCase() === "admin";
}

async function verifyAuthenticationFlow() {
  const email = requireEnv("ADMIN_EMAIL");
  const password = requireEnv("ADMIN_PASSWORD");

  console.log(`Checking auth API at ${AUTH_BASE_URL}`);
  console.log(`Using admin email ${email}`);

  const login = await authRequest("/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  assert(login.response.ok, `Login failed with HTTP ${login.response.status}`);
  assert(login.body.success === true, "Login response did not return success true");
  assert(cookieJar.size > 0, "Login did not return an authentication cookie");
  console.log("PASS login: authenticated cookie received");

  const currentUser = await authRequest("/me", { method: "GET" });
  assert(currentUser.response.ok, `Current-user request failed with HTTP ${currentUser.response.status}`);
  assert(currentUser.body.success === true, "Current-user response did not return success true");
  assert(adminRoleMatches(currentUser.body.user?.role), "Current user is not an admin");
  console.log(`PASS current user: role=${currentUser.body.user.role}`);

  const logout = await authRequest("/logout", { method: "POST" });
  assert(logout.response.ok, `Logout failed with HTTP ${logout.response.status}`);
  assert(logout.body.success === true, "Logout response did not return success true");
  console.log("PASS logout: session cleared");

  const afterLogout = await authRequest("/me", { method: "GET" });
  assert(afterLogout.response.status === 401, `Expected /me after logout to fail with 401, got HTTP ${afterLogout.response.status}`);
  console.log("PASS after logout: /me rejected unauthenticated request");

  console.log("Local authentication verification passed.");
}

verifyAuthenticationFlow().catch((err) => {
  console.error(`Local authentication verification failed: ${err.message}`);
  process.exit(1);
});
