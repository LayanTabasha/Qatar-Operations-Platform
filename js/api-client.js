const isLocalFrontend = ["", "localhost", "127.0.0.1"].includes(window.location.hostname);
const DEFAULT_API_ORIGIN = isLocalFrontend ? "http://localhost:3000" : window.location.origin;
const API_ORIGIN = window.QATAR_OPS_API_ORIGIN || DEFAULT_API_ORIGIN;
const API_BASE_URL = `${API_ORIGIN}/api/v1`;
const QATAR_OPS_FRONTEND_VERSION = "2026.08.05-platform-health";

console.info(`Qatar Operations frontend ${QATAR_OPS_FRONTEND_VERSION}`);

class ApiError extends Error {
  constructor(message, status, payload) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

function buildQueryString(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") query.set(key, value);
  });
  const text = query.toString();
  return text ? `?${text}` : "";
}

function apiAssetUrl(path) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path) || path.startsWith("data:")) return path;
  return `${API_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;
}

async function apiRequest(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  const requestOptions = {
    credentials: "include",
    ...options,
    headers,
  };

  if (options.body && !(options.body instanceof FormData)) {
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
    requestOptions.body = typeof options.body === "string" ? options.body : JSON.stringify(options.body);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, requestOptions);
  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload.success === false) {
    const message = payload?.error?.message || payload?.message || `Request failed with HTTP ${response.status}`;
    throw new ApiError(message, response.status, payload);
  }

  return payload;
}

const AuthApi = {
  login(email, password) {
    return apiRequest("/auth/login", {
      method: "POST",
      body: { email, password },
    });
  },

  logout() {
    return apiRequest("/auth/logout", { method: "POST" });
  },

  me() {
    return apiRequest("/auth/me", { method: "GET" });
  },
};

const HealthApi = {
  platform() {
    return apiRequest(`/health/platform?_=${Date.now()}`, { method: "GET", cache: "no-store" });
  },
};

const SitesApi = {
  list(params = {}) {
    return apiRequest(`/sites${buildQueryString(params)}`, { method: "GET" });
  },

  create(site) {
    return apiRequest("/sites", {
      method: "POST",
      body: site,
    });
  },

  update(id, site) {
    return apiRequest(`/sites/${id}`, {
      method: "PATCH",
      body: site,
    });
  },

  updateStatus(id, status) {
    return apiRequest(`/sites/${id}/status`, {
      method: "PATCH",
      body: { status },
    });
  },

  uploadImage(id, file) {
    const formData = new FormData();
    formData.append("image", file);

    return apiRequest(`/sites/${id}/image`, {
      method: "POST",
      body: formData,
    });
  },

  archive(id, reason = "") {
    return apiRequest(`/sites/${id}/archive`, { method: "PATCH", body: { reason: reason || null } });
  },

  restore(id) {
    return apiRequest(`/sites/${id}/restore`, { method: "PATCH" });
  },

  deleteArchived(id) {
    return apiRequest(`/sites/${id}/permanent`, { method: "DELETE" });
  },
};

const ChargersApi = {
  list(params = {}) {
    return apiRequest(`/chargers${buildQueryString(params)}`, { method: "GET" });
  },

  create(charger) {
    return apiRequest("/chargers", {
      method: "POST",
      body: charger,
    });
  },

  update(id, charger) {
    return apiRequest(`/chargers/${id}`, {
      method: "PATCH",
      body: charger,
    });
  },

  updateStatus(id, status) {
    return apiRequest(`/chargers/${id}/status`, {
      method: "PATCH",
      body: { status },
    });
  },

  archive(id, reason = "") {
    return apiRequest(`/chargers/${id}/archive`, { method: "PATCH", body: { reason: reason || null } });
  },

  restore(id) {
    return apiRequest(`/chargers/${id}/restore`, { method: "PATCH" });
  },

  deleteArchived(id) {
    return apiRequest(`/chargers/${id}/permanent`, { method: "DELETE" });
  },
};

// Administrator-only archive collection endpoints. Authentication remains
// centralized in apiRequest; the backend enforces the role authorization.
const ArchiveApi = {
  listSites() {
    return apiRequest("/archive/sites", { method: "GET" });
  },

  listChargers() {
    return apiRequest("/archive/chargers", { method: "GET" });
  },
};

const UsersApi = {
  list() {
    return apiRequest("/users", { method: "GET" });
  },

  create(user) {
    return apiRequest("/users", {
      method: "POST",
      body: user,
    });
  },

  update(id, user) {
    return apiRequest(`/users/${id}`, {
      method: "PATCH",
      body: user,
    });
  },

  updateStatus(id, isActive) {
    return apiRequest(`/users/${id}/status`, {
      method: "PATCH",
      body: { is_active: isActive },
    });
  },

  resetPassword(id, password) {
    return apiRequest(`/users/${id}/reset-password`, {
      method: "POST",
      body: { password },
    });
  },

  remove(id) {
    return apiRequest(`/users/${id}`, { method: "DELETE" });
  },

};

const SiteVisitsApi = {
  list(params = {}) {
    return apiRequest(`/site-visits${buildQueryString(params)}`, { method: "GET" });
  },

  create(siteVisit) {
    return apiRequest("/site-visits", {
      method: "POST",
      body: siteVisit,
    });
  },

  update(id, siteVisit) {
    return apiRequest(`/site-visits/${id}`, {
      method: "PATCH",
      body: siteVisit,
    });
  },
  remove(id) { return apiRequest(`/site-visits/${id}`, { method: "DELETE" }); },
};

const FaultsApi = {
  list(params = {}) { return apiRequest(`/faults${buildQueryString(params)}`, { method: "GET" }); },
  get(id) { return apiRequest(`/faults/${id}`, { method: "GET" }); },
  create(fault) { return apiRequest("/faults", { method: "POST", body: fault }); },
  update(id, fault) { return apiRequest(`/faults/${id}`, { method: "PATCH", body: fault }); },
  remove(id) { return apiRequest(`/faults/${id}`, { method: "DELETE" }); },
};

const RequestsApi = {
  list(params = {}) { return apiRequest(`/requests${buildQueryString(params)}`, { method: "GET" }); },
  get(id) { return apiRequest(`/requests/${id}`, { method: "GET" }); },
  create(request) { return apiRequest("/requests", { method: "POST", body: request }); },
  update(id, request) { return apiRequest(`/requests/${id}`, { method: "PATCH", body: request }); },
  remove(id) { return apiRequest(`/requests/${id}`, { method: "DELETE" }); },
};

const ContactsApi = {
  list(params = {}) { return apiRequest(`/contacts${buildQueryString(params)}`, { method: "GET" }); },
  get(id) { return apiRequest(`/contacts/${id}`, { method: "GET" }); },
  create(contact) { return apiRequest("/contacts", { method: "POST", body: contact }); },
  update(id, contact) { return apiRequest(`/contacts/${id}`, { method: "PATCH", body: contact }); },
  remove(id) { return apiRequest(`/contacts/${id}`, { method: "DELETE" }); },
};

const AttachmentsApi = {
  list(parentType, parentId) { return apiRequest(`/attachments/parent/${parentType}/${parentId}`, { method: "GET" }); },
  upload(parentType, parentId, file) {
    const body = new FormData(); body.append("file", file);
    return apiRequest(`/attachments/parent/${parentType}/${parentId}`, { method: "POST", body });
  },
  replace(id, file) {
    const body = new FormData(); body.append("file", file);
    return apiRequest(`/attachments/${id}/file`, { method: "PATCH", body });
  },
  previewUrl(id) { return `/api/v1/attachments/${encodeURIComponent(id)}/preview`; },
  async preview(id, previewUrl = "") {
    const url = apiAssetUrl(previewUrl || this.previewUrl(id));
    const response = await fetch(url, { method: "GET", credentials: "include" });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      const error = new ApiError(payload?.error?.message || `Preview failed with HTTP ${response.status}`, response.status, payload);
      error.code = payload?.error?.code || "";
      throw error;
    }
    return response.blob();
  },
  remove(id) { return apiRequest(`/attachments/${id}`, { method: "DELETE" }); },
};

const ContentRecordsApi = {
  list(type) { return apiRequest(`/${type}`, { method: "GET" }); },
  get(type, id) { return apiRequest(`/${type}/${id}`, { method: "GET" }); },
  create(type, record) { return apiRequest(`/${type}`, { method: "POST", body: record }); },
  update(type, id, record) { return apiRequest(`/${type}/${id}`, { method: "PATCH", body: record }); },
  remove(type, id) { return apiRequest(`/${type}/${id}`, { method: "DELETE" }); },
};

const DtcApi = {
  list(params = {}) {
    return apiRequest(`/dtc${buildQueryString(params)}`, { method: "GET" });
  },

  get(id) {
    return apiRequest(`/dtc/${id}`, { method: "GET" });
  },

  create(record) {
    return apiRequest("/dtc", {
      method: "POST",
      body: record,
    });
  },

  update(id, record) {
    return apiRequest(`/dtc/${id}`, {
      method: "PATCH",
      body: record,
    });
  },

  updateStatus(id, isActive) {
    return apiRequest(`/dtc/${id}/status`, {
      method: "PATCH",
      body: { is_active: isActive },
    });
  },

  importWorkbook(file) {
    const formData = new FormData();
    formData.append("file", file);

    return apiRequest("/dtc/import", {
      method: "POST",
      body: formData,
    });
  },
};

window.QatarOpsApi = Object.freeze({
  Auth: AuthApi,
  Sites: SitesApi,
  Chargers: ChargersApi,
  Users: UsersApi,
  SiteVisits: SiteVisitsApi,
  Attachments: AttachmentsApi,
  ContentRecords: ContentRecordsApi,
  Dtc: DtcApi,
  Faults: FaultsApi,
  Requests: RequestsApi,
  Contacts: ContactsApi,
  Archive: ArchiveApi,
  PlatformHealth: HealthApi,
});
