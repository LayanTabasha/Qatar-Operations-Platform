const isLocalFrontend = ["", "localhost", "127.0.0.1"].includes(window.location.hostname);
const DEFAULT_API_ORIGIN = isLocalFrontend ? "http://localhost:3000" : window.location.origin;
const API_BASE_URL = `${window.QATAR_OPS_API_ORIGIN || DEFAULT_API_ORIGIN}/api/v1`;

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
};
