const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/+$/, "");

function withBase(path) {
  return API_BASE ? `${API_BASE}${path}` : path;
}

async function request(path, options = {}) {
  const headers = new Headers(options.headers || {});
  
  // แนบ JWT Token ถ้ามีอยู่ใน localStorage
  const token = localStorage.getItem("token");
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const newOptions = { ...options, headers };

  const response = await fetch(withBase(path), newOptions);
  let data = null;
  try {
    data = await response.json();
  } catch (_err) {
    data = null;
  }
  return {
    ok: response.ok,
    status: response.status,
    data
  };
}

export const ForestAPI = {
  login(pin) {
    return request("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin })
    });
  },

  getLatestAnimals() {
    return request("/api/latest_animals", { cache: "no-store" });
  },

  getPipelineStatus({ wait = true, timeout = 20, since = 0 } = {}) {
    const waitStr = wait ? "1" : "0";
    const safeTimeout = Number.isFinite(timeout) ? timeout : 20;
    const safeSince = Number.isFinite(since) ? since : 0;
    return request(
      `/api/pipeline_status?wait=${waitStr}&timeout=${safeTimeout}&since=${safeSince}`,
      { cache: "no-store" }
    );
  },

  captureProcess(payload = {}) {
    return request("/api/capture_process", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  },

  getQueueStatus(jobId) {
    return request(`/api/queue_status/${encodeURIComponent(jobId)}`, { cache: "no-store" });
  },

  approve(payload = {}) {
    return request("/api/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  },

  clearForest() {
    return request("/api/clear_forest", { method: "POST" });
  },

  reportForestState(rendered = []) {
    return request("/api/forest_state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rendered })
    });
  },

  assetUrl(path) {
    return withBase(path);
  },

  previewUrl() {
    return withBase("/static/rmbg_temp.png");
  },

  searchGallery({ drawer_name = "", type = "" } = {}) {
    const params = new URLSearchParams();
    if (drawer_name) params.set("drawer_name", drawer_name);
    if (type) params.set("type", type);
    return request(`/api/gallery?${params.toString()}`, { cache: "no-store" });
  },

  downloadUrl(filename) {
    return withBase(`/api/download/${filename}`);
  }
};
