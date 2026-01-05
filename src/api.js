// path: src/api.js

// ---- API base detection -----------------------------------------------------
// Priority:
// 1) VITE_API_BASE (vite env)
// 2) window.__API_BASE__ (runtime override)
// 3) If localhost -> default to http://localhost:8001
// 4) Otherwise, assume same-origin (proxy/CDN in front of FastAPI)
const inferredLocal = (() => {
  try {
    if (typeof window === "undefined") return "http://localhost:8001";
    const h = window.location.hostname;
    if (h === "localhost" || h === "127.0.0.1") return "http://localhost:8001";
    return ""; // same-origin
  } catch {
    return "http://localhost:8001";
  }
})();

export const API_BASE =
  (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_API_BASE) ||
  (typeof window !== "undefined" && window.__API_BASE__) ||
  inferredLocal;

// ---- Low-level helpers ------------------------------------------------------
async function _fetchWithTimeout(input, init = {}, timeoutMs = 8000, extSignal) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort("timeout"), timeoutMs);

  const onAbort = () => ctrl.abort("abort");
  if (extSignal && typeof extSignal.addEventListener === "function") {
    extSignal.addEventListener("abort", onAbort);
  }

  try {
    const signal =
      init && init.signal
        ? init.signal
        : ctrl.signal;

    const res = await fetch(input, { ...init, signal });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status} ${res.statusText}${txt ? ` — ${txt}` : ""}`);
    }
    // Try JSON, fallback to text
    const ctype = res.headers.get("content-type") || "";
    if (ctype.includes("application/json")) return res.json();
    return res.text();
  } finally {
    clearTimeout(id);
    if (extSignal && typeof extSignal.removeEventListener === "function") {
      extSignal.removeEventListener("abort", onAbort);
    }
  }
}

export const jget = (path, timeoutMs = 8000, signal) =>
  _fetchWithTimeout(`${API_BASE}${path}`, {}, timeoutMs, signal);

export const jpost = (path, body, timeoutMs = 8000, signal) =>
  _fetchWithTimeout(
    `${API_BASE}${path}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    },
    timeoutMs,
    signal
  );

export const postFormData = (path, formData, timeoutMs = 12000, signal) =>
  _fetchWithTimeout(
    `${API_BASE}${path}`,
    { method: "POST", body: formData },
    timeoutMs,
    signal
  );

// Convenience “retry-on-timeout” wrappers (used by the UI for better UX)
export async function jpostTimeout(path, body, ms = 8000, signal) {
  try {
    return await jpost(path, body, ms, signal);
  } catch (e) {
    const isTimeout = e && (e.name === "AbortError" || String(e).includes("timeout"));
    if (isTimeout) return jpost(path, body, ms * 2, signal);
    throw e;
  }
}

export async function postFormDataTimeout(path, formData, ms = 12000, signal) {
  try {
    return await postFormData(path, formData, ms, signal);
  } catch (e) {
    const isTimeout = e && (e.name === "AbortError" || String(e).includes("timeout"));
    if (isTimeout) return postFormData(path, formData, ms * 2, signal);
    throw e;
  }
}

// ---- High-level API calls ---------------------------------------------------
export async function getModels(signal) {
  // Normalize backend responses to { default, available }
  const r = await jget("/models", 7000, signal);
  // Possible shapes:
  // 1) { models: [{id,label},...], available: ["id"...], default: "id" }
  // 2) { models: ["id", ...], default: "id" }
  // 3) { available: ["id", ...], default: "id" }
  let available = [];
  if (Array.isArray(r?.available)) {
    available = r.available;
  } else if (Array.isArray(r?.models)) {
    available = r.models.map((m) => (typeof m === "string" ? m : m.id)).filter(Boolean);
  }
  const def = r?.default || available[0] || "onnx-optimized";
  return { default: def, available: available.filter((m) => m !== def) };
}

export const predict = (payload, timeoutMs = 6000, signal) =>
  jpostTimeout("/predict", payload, timeoutMs, signal);

export const analyze = (payload, timeoutMs = 12000, signal) =>
  jpostTimeout("/analyze", payload, timeoutMs, signal);

export function batchAnalyze(file, modelsCsv = null, timeoutMs = 12000, signal) {
  const fd = new FormData();
  fd.append("file", file);
  // Backend accepts models through *either* Form or Query; we use Form
  if (modelsCsv) fd.append("models", modelsCsv);
  return postFormDataTimeout("/batch", fd, timeoutMs, signal);
}

// Optional extras used by warmup/diagnostics
export const health     = (signal) => jget("/health", 5000, signal);
export const debugOnnx  = (signal) => jget("/debug/onnx", 5000, signal);
export const benchmark  = (text = "warmup", model = "onnx-optimized", signal) =>
  jpost("/benchmark", { text, model }, 5000, signal);
