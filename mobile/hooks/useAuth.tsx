import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { api } from "../lib/api-client";
import {
  storeTokens,
  getAccessToken,
  clearTokens,
  isAuthenticated as checkAuth,
} from "../lib/auth";
import type { User, AuthResponse } from "../types";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<{ dev_otp?: string }>;
  verifyOtp: (email: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore session on mount
  useEffect(() => {
    (async () => {
      try {
        const hasToken = await checkAuth();
        if (hasToken) {
          // api.get will automatically attempt a token refresh on 401.
          // Only clear tokens if the session is definitively expired
          // (handled by onSessionExpired below). Do NOT clear here on
          // network errors or transient failures — that would delete a
          // valid refresh token and force the user to log in again.
          const data = await api.get<AuthResponse>("/auth/me");
          setUser(data.user);
        }
      } catch {
        // Session could not be restored. If the refresh token itself is
        // expired, onSessionExpired will fire and set user to null.
        // For any other error (network, server), stay logged out silently
        // without wiping the stored tokens so the next launch can retry.
      } finally {
        setLoading(false);
      }
    })();

    // When refresh token is revoked or expired, force logout and clear tokens
    api.setOnSessionExpired(async () => {
      await clearTokens();
      setUser(null);
    });
    return () => api.setOnSessionExpired(null);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await api.post<{ access_token: string; refresh_token: string; user: User }>(
      "/auth/mobile/login",
      { email, password }
    );
    await storeTokens(data.access_token, data.refresh_token);
    setUser(data.user);
  }, []);

  const register = useCallback(
    async (email: string, password: string, displayName: string) => {
      const data = await api.post<{ message: string; dev_otp?: string }>(
        "/auth/register",
        { email, password, display_name: displayName }
      );
      return { dev_otp: data.dev_otp };
    },
    []
  );

  const verifyOtp = useCallback(async (email: string, code: string) => {
    const data = await api.post<{ access_token: string; refresh_token: string; user: User }>(
      "/auth/verify-otp",
      { email, code }
    );
    await storeTokens(data.access_token, data.refresh_token);
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // Ignore logout errors
    }
    await clearTokens();
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const data = await api.get<AuthResponse>("/auth/me");
      setUser(data.user);
    } catch {
      // Ignore refresh errors
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: !!user,
        login,
        register,
        verifyOtp,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
