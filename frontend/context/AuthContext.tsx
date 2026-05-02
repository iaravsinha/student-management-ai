import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";

import { api } from "../lib/api";
import { User } from "../lib/types";

type AuthContextValue = {
  user: User | null;
  permissions: string[];
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshMe: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshMe = async () => {
    try {
      const [userResponse, permissionsResponse] = await Promise.all([
        api.get<User>("/auth/me"),
        api.get<string[]>("/auth/permissions"),
      ]);
      setUser(userResponse.data);
      setPermissions(permissionsResponse.data);
    } catch {
      setUser(null);
      setPermissions([]);
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
    setPermissions([]);
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
      permissions,
      loading,
      login,
      logout,
      refreshMe,
    }),
    [user, permissions, loading],
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

