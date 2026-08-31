import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api"
});

api.interceptors.request.use(config => {
  const token = sessionStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;

  // Belt-and-suspenders against stale polling data: some browsers/proxies
  // will serve a cached response for an identical GET URL even when the
  // server sends no-cache headers. A cache-busting param guarantees every
  // request (including the dashboards' background polling) is unique.
  if ((config.method || "get").toLowerCase() === "get") {
    config.params = { ...(config.params || {}), _: Date.now() };
    config.headers["Cache-Control"] = "no-cache";
  }

  return config;
});

export default api;