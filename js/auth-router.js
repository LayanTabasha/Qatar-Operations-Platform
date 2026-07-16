function getVisibleRoute() {
  return Array.from(document.querySelectorAll(".page")).find((page) => page.classList.contains("active"))?.id || window.location.hash.replace("#", "") || "home";
}

function getSavedSession() {
  const rawSession = localStorage.getItem(AUTH_SESSION_KEY) || sessionStorage.getItem(AUTH_SESSION_KEY);
  if (!rawSession) return null;
  try {
    return JSON.parse(rawSession);
  } catch {
    clearStoredSession();
    return null;
  }
}

function writeStoredSession(session) {
  const storage = session.remember ? localStorage : sessionStorage;
  storage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
  const otherStorage = session.remember ? sessionStorage : localStorage;
  otherStorage.removeItem(AUTH_SESSION_KEY);
}

function clearStoredSession() {
  localStorage.removeItem(AUTH_SESSION_KEY);
  sessionStorage.removeItem(AUTH_SESSION_KEY);
}

function saveViewContext(overrides = {}) {
  const context = {
    route: getVisibleRoute(),
    siteName: state.currentSiteName,
    chargerId: state.currentChargerId,
    siteTab: state.currentSiteTab,
    chargerTab: state.currentChargerTab,
    ...overrides,
  };
  sessionStorage.setItem(VIEW_CONTEXT_KEY, JSON.stringify(context));
  const session = getSavedSession();
  if (session) {
    session.viewContext = context;
    writeStoredSession(session);
  }
}

function getSavedViewContext() {
  const sessionContext = getSavedSession()?.viewContext;
  const rawContext = sessionStorage.getItem(VIEW_CONTEXT_KEY);
  if (sessionContext) return sessionContext;
  if (!rawContext) return {};
  try {
    return JSON.parse(rawContext);
  } catch {
    sessionStorage.removeItem(VIEW_CONTEXT_KEY);
    return {};
  }
}

function applyAuthenticatedUser(user) {
  state.authenticated = true;
  state.currentUser = user.name;
  state.currentUserEmail = user.email;
  state.currentUserRole = user.role;
  state.mustChangePassword = !!user.mustChangePassword;
  document.getElementById("current-user").textContent = state.currentUser;
}

function showLoginScreen() {
  document.getElementById("auth-loading-screen").classList.add("hidden");
  document.getElementById("app-shell").classList.add("hidden");
  document.getElementById("app-shell").setAttribute("aria-hidden", "true");
  document.getElementById("change-password-screen").classList.add("hidden");
  document.getElementById("login-screen").classList.remove("hidden");
}

function showAppShell() {
  document.getElementById("auth-loading-screen").classList.add("hidden");
  document.getElementById("login-screen").classList.add("hidden");
  document.getElementById("change-password-screen").classList.add("hidden");
  document.getElementById("app-shell").classList.remove("hidden");
  document.getElementById("app-shell").removeAttribute("aria-hidden");
}

function requireAuth() {
  if (state.authenticated) return true;
  showLoginScreen();
  return false;
}

function setRoute(route) {
  if (!requireAuth()) return;
  if (!routes.includes(route)) route = "home";
  document.querySelectorAll(".page").forEach((page) => page.classList.toggle("active", page.id === route));
  document.querySelectorAll("[data-route]").forEach((item) => item.classList.toggle("active", item.dataset.route === route));
  window.location.hash = route;
  saveViewContext({ route });
}

function createStoredSession(user, remember = false) {
  const session = {
    email: user.email,
    remember,
    createdAt: Date.now(),
    expiresAt: Date.now() + (remember ? REMEMBER_SESSION_DURATION_MS : SESSION_DURATION_MS),
    viewContext: getSavedViewContext(),
  };
  writeStoredSession(session);
  return session;
}

async function restoreStoredSession() {
  const session = getSavedSession();
  if (!session) return false;
  if (!session.email || !session.expiresAt || Date.now() > session.expiresAt) {
    clearStoredSession();
    return false;
  }
  const user = state.users.find((item) => item.email.toLowerCase() === session.email.toLowerCase());
  if (!user || user.status === "Disabled" || user.status === "Locked" || user.status !== "Active") {
    clearStoredSession();
    return false;
  }
  applyAuthenticatedUser(user);
  if (state.mustChangePassword) {
    document.getElementById("auth-loading-screen").classList.add("hidden");
    document.getElementById("login-screen").classList.add("hidden");
    document.getElementById("app-shell").classList.add("hidden");
    document.getElementById("change-password-screen").classList.remove("hidden");
    return true;
  }
  showAppShell();
  renderSettings();
  restoreSavedView();
  return true;
}

function restoreSavedView() {
  const context = getSavedViewContext();
  const requestedRoute = window.location.hash.replace("#", "") || context.route || "home";
  setRoute(routes.includes(requestedRoute) ? requestedRoute : "home");
  if (requestedRoute !== "sites") return;
  if (context.chargerId && context.siteName) {
    openCharger(context.siteName, context.chargerId, context.chargerTab || "Overview");
    return;
  }
  if (context.siteName) {
    openSite(context.siteName, context.siteTab || "Overview");
  }
}

async function signIn(email, password) {
  const error = document.getElementById("login-error");
  error.textContent = "";
  if (!email || !password) {
    error.textContent = "Email and password are required.";
    return;
  }
  const user = state.users.find((item) => item.email.toLowerCase() === email.toLowerCase());
  if (!user || user.passwordHash !== await hashPassword(password)) {
    error.textContent = "Invalid email or password. Authorized users only.";
    return;
  }
  if (user.status === "Disabled" || user.status === "Locked") {
    error.textContent = "Your account is currently unavailable. Please contact the system administrator.";
    return;
  }
  if (user.status !== "Active") {
    error.textContent = "Your account is not active yet. Please contact the system administrator.";
    return;
  }
  state.authenticated = true;
  applyAuthenticatedUser(user);
  user.lastLogin = new Date().toISOString().slice(0, 16).replace("T", " ");
  saveUsers();
  createStoredSession(user, document.getElementById("remember-me")?.checked);
  if (state.mustChangePassword) {
    document.getElementById("auth-loading-screen").classList.add("hidden");
    document.getElementById("login-screen").classList.add("hidden");
    document.getElementById("app-shell").classList.add("hidden");
    document.getElementById("change-password-screen").classList.remove("hidden");
    return;
  }
  showAppShell();
  renderSettings();
  restoreSavedView();
}

function logout() {
  clearStoredSession();
  sessionStorage.removeItem(VIEW_CONTEXT_KEY);
  state.authenticated = false;
  state.currentUser = "Admin";
  state.currentUserEmail = "";
  state.currentUserRole = "";
  state.mustChangePassword = false;
  window.location.hash = "";
  document.getElementById("profile-dropdown").classList.add("hidden");
  showLoginScreen();
}

async function updateCurrentPassword(currentPassword, newPassword, confirmPassword, errorElementId = "change-password-error") {
  const error = document.getElementById(errorElementId);
  if (error) error.textContent = "";
  const user = getCurrentUserRecord();
  if (!user || user.passwordHash !== await hashPassword(currentPassword)) {
    if (error) error.textContent = "Current password is incorrect.";
    return false;
  }
  if (newPassword.length < 10 || !/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
    if (error) error.textContent = "New password must be at least 10 characters and include an uppercase letter and a number.";
    return false;
  }
  if (newPassword !== confirmPassword) {
    if (error) error.textContent = "New password and confirmation do not match.";
    return false;
  }
  user.passwordHash = await hashPassword(newPassword);
  user.mustChangePassword = false;
  user.lastPasswordChange = new Date().toISOString().slice(0, 16).replace("T", " ");
  state.mustChangePassword = false;
  saveUsers();
  const session = getSavedSession();
  if (session) {
    session.email = user.email;
    session.expiresAt = Date.now() + (session.remember ? REMEMBER_SESSION_DURATION_MS : SESSION_DURATION_MS);
    writeStoredSession(session);
  }
  addActivity({
    actionType: "password_changed",
    entityType: "user",
    entityId: user.email,
    description: `Password changed for ${state.currentUser}`,
  });
  saveState();
  if (typeof renderActivity === "function") renderActivity();
  return true;
}

async function changeOwnPassword(currentPassword, newPassword, confirmPassword) {
  const updated = await updateCurrentPassword(currentPassword, newPassword, confirmPassword, "change-password-error");
  if (!updated) return;
  document.getElementById("change-password-screen").classList.add("hidden");
  document.getElementById("app-shell").classList.remove("hidden");
  document.getElementById("app-shell").removeAttribute("aria-hidden");
  renderSettings();
  setRoute("home");
}

async function changeSettingsPassword() {
  const updated = await updateCurrentPassword(
    document.getElementById("settings-current-password")?.value || "",
    document.getElementById("settings-new-password")?.value || "",
    document.getElementById("settings-confirm-password")?.value || "",
    "settings-password-error",
  );
  if (!updated) return;
  renderSettings("Account Security");
  const message = document.getElementById("settings-password-success");
  if (message) message.textContent = "Password changed successfully.";
}
