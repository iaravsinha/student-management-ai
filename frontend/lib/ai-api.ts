import axios from "axios";

function resolveAiBaseUrl() {
  const fromEnv = process.env.NEXT_PUBLIC_AI_SERVICE_URL?.trim();

  if (typeof window !== "undefined") {
    const httpsPage = window.location.protocol === "https:";
    if (httpsPage && fromEnv && fromEnv.startsWith("http://")) {
      return "/ai";
    }
    if (fromEnv) {
      return fromEnv;
    }
    const host = window.location.hostname;
    if (host && host !== "localhost" && host !== "127.0.0.1") {
      return "/ai";
    }
    return "http://localhost:8001/ai";
  }

  if (fromEnv) {
    return fromEnv;
  }
  return "http://localhost:8001/ai";
}

export const aiApi = axios.create({
  headers: {
    "Content-Type": "application/json",
  },
});

aiApi.interceptors.request.use((config) => {
  config.baseURL = resolveAiBaseUrl();
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

