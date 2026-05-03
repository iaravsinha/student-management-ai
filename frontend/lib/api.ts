import axios from "axios";

function resolveApiBaseUrl() {
  const fromEnv = process.env.NEXT_PUBLIC_BACKEND_URL?.trim();

  if (typeof window !== "undefined") {
    // HTTPS pages cannot call http://localhost APIs (mixed content). Same-origin /api uses Next rewrites.
    const httpsPage = window.location.protocol === "https:";
    if (httpsPage && fromEnv && fromEnv.startsWith("http://")) {
      return "/api";
    }
    if (fromEnv) {
      return fromEnv;
    }
    const host = window.location.hostname;
    if (host && host !== "localhost" && host !== "127.0.0.1") {
      return "/api";
    }
    return "http://localhost:8000";
  }

  if (fromEnv) {
    return fromEnv;
  }
  return "http://localhost:8000";
}

export const api = axios.create({
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  config.baseURL = resolveApiBaseUrl();
  if (typeof window !== "undefined") {
    if (window.location.hostname.includes("ngrok")) {
      config.headers.set("ngrok-skip-browser-warning", "true");
    }
    const token = window.localStorage.getItem("auth_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

