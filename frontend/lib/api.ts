import axios from "axios";

function resolveApiBaseUrl() {
  const fromEnv = process.env.NEXT_PUBLIC_BACKEND_URL;
  if (fromEnv && fromEnv.trim().length > 0) {
    return fromEnv;
  }

  // When the UI is accessed from a remote host (ngrok/production),
  // default to same-origin reverse-proxy paths.
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host && host !== "localhost" && host !== "127.0.0.1") {
      return "/api";
    }
  }

  return "http://localhost:8000";
}

const API_BASE_URL = resolveApiBaseUrl();

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = window.localStorage.getItem("auth_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

