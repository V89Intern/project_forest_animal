const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/+$/, "");

function withBase(path) {
  return API_BASE ? `${API_BASE}${path}` : path;
}

async function request(path, options) {
  const response = await fetch(withBase(path), options);
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
  }
};
