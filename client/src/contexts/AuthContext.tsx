// MODIFIED BY AI: 2026-02-12 - add auth context for login/logout/session bootstrap
// FILE: client/src/contexts/AuthContext.tsx

import { apiRequest, ApiError } from "@/lib/api";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type AuthUser = {
  id: number;
  login: string;
  role: "admin" | "user";
  deviceId: string | null;
  expiresAt: string | null;
  createdAt: string;
};

type AuthContextType = {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (params: { login: string; password: string; deviceId: string }) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const TOKEN_STORAGE_KEY = "ios_msg_auth_token";
const USER_CACHE_KEY = "ios_msg_auth_user_cache";
const USE_TOKEN_FALLBACK = import.meta.env.VITE_USE_TOKEN_FALLBACK === "true";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const readCachedUser = (): AuthUser | null => {
  try {
    const raw = localStorage.getItem(USER_CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<AuthUser>;
    if (
      typeof parsed.id !== "number" ||
      typeof parsed.login !== "string" ||
      (parsed.role !== "admin" && parsed.role !== "user")
    ) {
      return null;
    }

    return {
      id: parsed.id,
      login: parsed.login,
      role: parsed.role,
      deviceId: parsed.deviceId ?? null,
      expiresAt: parsed.expiresAt ?? null,
      createdAt: parsed.createdAt ?? "",
    };
  } catch {
    return null;
  }
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // MODIFIED BY AI: 2026-02-13 - bootstrap user from local cache to avoid blocking app on slow networks
  // FILE: client/src/contexts/AuthContext.tsx
  const [user, setUser] = useState<AuthUser | null>(() => readCachedUser());
  const [isLoading, setIsLoading] = useState(() => readCachedUser() === null);
  const [token, setToken] = useState<string | null>(() => {
    return USE_TOKEN_FALLBACK ? localStorage.getItem(TOKEN_STORAGE_KEY) : null;
  });

  const writeToken = useCallback((nextToken: string | null) => {
    if (!USE_TOKEN_FALLBACK) return;

    if (nextToken) {
      localStorage.setItem(TOKEN_STORAGE_KEY, nextToken);
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }

    setToken(nextToken);
  }, []);

  const writeCachedUser = useCallback((nextUser: AuthUser | null) => {
    if (nextUser) {
      localStorage.setItem(USER_CACHE_KEY, JSON.stringify(nextUser));
    } else {
      localStorage.removeItem(USER_CACHE_KEY);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const response = await apiRequest<{ success: boolean; data: { user: AuthUser } }>(
        "/auth/me",
        { token },
      );

      setUser(response.data.user);
      writeCachedUser(response.data.user);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setUser(null);
        writeCachedUser(null);
        writeToken(null);
      }
      // Keep cached user when network is slow/offline or server temporarily unavailable.
    }
  }, [token, writeCachedUser, writeToken]);

  useEffect(() => {
    let isMounted = true;
    refreshUser().finally(() => {
      if (isMounted) {
        setIsLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [refreshUser]);

  const login = useCallback(
    async (params: { login: string; password: string; deviceId: string }) => {
      const response = await apiRequest<{
        success: boolean;
        data: { token?: string; user: AuthUser };
      }>("/auth/login", {
        method: "POST",
        body: JSON.stringify(params),
      });

      if (response.data.token) {
        writeToken(response.data.token);
      }

      setUser(response.data.user);
      writeCachedUser(response.data.user);
      return response.data.user;
    },
    [writeCachedUser, writeToken],
  );

  const logout = useCallback(async () => {
    try {
      await apiRequest("/auth/logout", {
        method: "POST",
        token,
      });
    } finally {
      setUser(null);
      writeCachedUser(null);
      writeToken(null);
    }
  }, [token, writeCachedUser, writeToken]);

  const value = useMemo(
    () => ({
      user,
      token,
      isLoading,
      login,
      logout,
      refreshUser,
    }),
    [user, token, isLoading, login, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
