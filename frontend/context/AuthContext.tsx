import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";

import { api } from "../lib/api";
import { User } from "../lib/types";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshMe: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshMe = async () => {
    try {
      const response = await api.get<User>("/auth/me");
      setUser(response.data);
    } catch {
      setUser(null);
    }
  };

  const login = async (email: string, password: string) => {
    const loginResponse = await api.post<{ access_token: string }>("/auth/login", {
      email,
      password,
    });
    window.localStorage.setItem("auth_token", loginResponse.data.access_token);
    await refreshMe();
  };

  const logout = () => {
    window.localStorage.removeItem("auth_token");
    setUser(null);
  };

  useEffect(() => {
    const bootstrap = async () => {
      if (typeof window === "undefined") {
        setLoading(false);
        return;
      }
      const token = window.localStorage.getItem("auth_token");
      if (!token) {
        setLoading(false);
        return;
      }
      await refreshMe();
      setLoading(false);
    };
    void bootstrap();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      login,
      logout,
      refreshMe,
    }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};

