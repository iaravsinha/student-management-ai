import axios from "axios";

function resolveAiBaseUrl() {
  const fromEnv = process.env.NEXT_PUBLIC_AI_SERVICE_URL;
  if (fromEnv && fromEnv.trim().length > 0) {
    return fromEnv;
  }

  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host && host !== "localhost" && host !== "127.0.0.1") {
      return "/ai";
    }
  }

  return "http://localhost:8001/ai";
}

const AI_BASE_URL = resolveAiBaseUrl();

export const aiApi = axios.create({
  baseURL: AI_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

aiApi.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = window.localStorage.getItem("auth_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

