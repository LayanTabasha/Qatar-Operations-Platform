function getVisibleRoute() {
  return Array.from(document.querySelectorAll(".page")).find((page) => page.classList.contains("active"))?.id || window.location.hash.replace("#", "") || "home";
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
}

function getSavedViewContext() {
  const rawContext = sessionStorage.getItem(VIEW_CONTEXT_KEY);
  if (!rawContext) return {};
  try {
    return JSON.parse(rawContext);
  } catch {
    sessionStorage.removeItem(VIEW_CONTEXT_KEY);
    return {};
  }
}

function normalizeAuthenticatedUser(user) {
  const roleLabels = {
    admin: "Administrator",
    operations_staff: "Operations Staff",
    viewer: "Viewer",
    hq_user: "HQ User",
  };
  const roleKey = user?.role || "";

  return {
    id: user?.id || "",
    name: user?.full_name || user?.name || user?.email || "User",
    email: user?.email || "",
    role: roleLabels[roleKey] || user?.role || "",
    roleKey,
    status: user?.is_active === false ? "Disabled" : "Active",
    department: user?.department || "Qatar Operations",
    lastLogin: user?.last_login_at || user?.lastLogin || "Not Available Yet",
    lastPasswordChange: user?.password_changed_at || user?.lastPasswordChange || "Not Available Yet",
    createdAt: user?.created_at || user?.createdAt || "Not Available Yet",
  };
}

function applyAuthenticatedUser(user) {
  const normalizedUser = normalizeAuthenticatedUser(user);
  state.authenticated = true;
  state.authUser = normalizedUser;
  state.currentUser = normalizedUser.name;
  state.currentUserEmail = normalizedUser.email;
  state.currentUserRole = normalizedUser.role;
  state.currentUserRoleKey = normalizedUser.roleKey;
  state.mustChangePassword = false;
  state.users = [normalizedUser];
  document.getElementById("current-user").textContent = state.currentUser;
  updateRequestsNavigation();
}

function clearAuthenticatedUser() {
  state.authenticated = false;
  state.authUser = null;
  state.currentUser = "";
  state.currentUserEmail = "";
  state.currentUserRole = "";
  state.currentUserRoleKey = "";
  state.mustChangePassword = false;
  state.users = [];
  updateRequestsNavigation();
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
  if (route === "requests" && !window.QatarOpsRequests.canAccess()) {
    renderRequestsAccessDenied();
  }
  document.querySelectorAll(".page").forEach((page) => page.classList.toggle("active", page.id === route));
  document.querySelectorAll("[data-route]").forEach((item) => item.classList.toggle("active", item.dataset.route === route));
  window.location.hash = route;
  saveViewContext({ route });
  if (route === "requests" && window.QatarOpsRequests.canAccess()) loadRequestsPage();
}

async function restoreAuthenticatedSession() {
  try {
    const response = await window.QatarOpsApi.Auth.me();
    applyAuthenticatedUser(response.user);
    showAppShell();
    await loadOperationalData();
    renderSettings();
    restoreSavedView();
    return true;
  } catch {
    clearAuthenticatedUser();
    showLoginScreen();
    return false;
  }
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
    return false;
  }

  try {
    const loginResponse = await window.QatarOpsApi.Auth.login(email, password);
    const currentUserResponse = await window.QatarOpsApi.Auth.me().catch(() => loginResponse);
    applyAuthenticatedUser(currentUserResponse.user);
    showAppShell();
    await loadOperationalData();
    renderSettings();
    restoreSavedView();
    return true;
  } catch (err) {
    clearAuthenticatedUser();
    error.textContent = err.message || "Invalid email or password.";
    return false;
  }
}

async function logout() {
  try {
    await window.QatarOpsApi.Auth.logout();
  } catch (err) {
    console.warn("Logout request failed. Clearing local UI session only.", err);
  }

  sessionStorage.removeItem(VIEW_CONTEXT_KEY);
  clearAuthenticatedUser();
  window.location.hash = "";
  document.getElementById("profile-dropdown").classList.add("hidden");
  showLoginScreen();
}

async function updateCurrentPassword(_currentPassword, _newPassword, _confirmPassword, errorElementId = "change-password-error") {
  const error = document.getElementById(errorElementId);
  if (error) error.textContent = "Password changes are not connected to the backend yet.";
  return false;
}

async function changeOwnPassword(currentPassword, newPassword, confirmPassword) {
  await updateCurrentPassword(currentPassword, newPassword, confirmPassword, "change-password-error");
}

async function changeSettingsPassword() {
  await updateCurrentPassword(
    document.getElementById("settings-current-password")?.value || "",
    document.getElementById("settings-new-password")?.value || "",
    document.getElementById("settings-confirm-password")?.value || "",
    "settings-password-error",
  );
}
