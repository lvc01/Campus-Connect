"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { apiClient } from "@/lib/api-client";

interface UserProfile {
  display_name: string;
  faculty: string | null;
  year_of_study: number | null;
  bio: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  social_links: Record<string, string> | null;
}

interface User {
  id: string;
  email: string;
  username?: string | null;
  role: string;
  is_verified: boolean;
  is_active: boolean;
  profile: UserProfile | null;
}

interface RegisterPayload {
  display_name: string;
  email: string;
  password: string;
}

interface LoginPayload {
  email: string;
  password: string;
}

interface RegisterResponse {
  dev_otp?: string;
  message?: string;
}

interface ForgotPasswordResponse {
  dev_otp?: string;
  message?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  register: (payload: RegisterPayload) => Promise<RegisterResponse>;
  verifyOtp: (email: string, code: string) => Promise<User>;
  resendOtp: (email: string) => Promise<string>;
  login: (payload: LoginPayload) => Promise<User>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  forgotPassword: (email: string) => Promise<ForgotPasswordResponse>;
  resetPassword: (email: string, code: string, newPassword: string) => Promise<string>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const fetchCurrentUser = async () => {
    try {
      // With httpOnly cookies, the browser sends the access_token automatically.
      // No need to set Authorization header — withCredentials: true handles it.
      const response = await apiClient.get<User>("/auth/me");
      setUser(response.data);
    } catch {
      // Clear session if fetch fails and cannot be refreshed
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  // Restore session on mount — just try calling /auth/me; if the cookie
  // is valid, the backend returns the user.  If not, the 401 interceptor
  // will attempt a refresh, and only then clear the session.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchCurrentUser();
  }, []);

  // Listen for session-expired events from the API client (soft redirect)
  useEffect(() => {
    const handleSessionExpired = () => {
      setUser(null);
      router.push("/login");
    };
    window.addEventListener("auth:session-expired", handleSessionExpired);
    return () => window.removeEventListener("auth:session-expired", handleSessionExpired);
  }, [router]);

  // Redirect unauthenticated users from protected routes
  useEffect(() => {
    if (!loading) {
      const publicPaths = ["/login", "/register", "/verify-otp", "/forgot-password", "/reset-password", "/"];
      const isPublic = publicPaths.includes(pathname);

      if (!user && !isPublic) {
        router.push("/login");
      } else if (user && isPublic && pathname !== "/") {
        // If logged in but email isn't verified (should be handled during OTP, but just in case)
        if (!user.is_verified) {
          router.push("/verify-otp");
        } else if (!user.profile?.faculty) {
          router.push("/profile/setup");
        } else {
          router.push("/");
        }
      }
    }
  }, [user, loading, pathname, router]);

  const register = async (payload: RegisterPayload): Promise<RegisterResponse> => {
    const response = await apiClient.post("/auth/register", payload);
    return response.data;
  };

  const verifyOtp = async (email: string, code: string): Promise<User> => {
    const response = await apiClient.post("/auth/verify-otp", { email, code });
    // Backend sets httpOnly cookies via Set-Cookie headers — no localStorage needed.
    const loggedUser = response.data.user;
    setUser(loggedUser);
    return loggedUser;
  };

  const resendOtp = async (email: string): Promise<string> => {
    const response = await apiClient.post("/auth/resend-otp", { email });
    return response.data.message;
  };

  const login = async (payload: LoginPayload): Promise<User> => {
    const response = await apiClient.post("/auth/login", payload);
    // Backend sets httpOnly cookies via Set-Cookie headers — no localStorage needed.
    const loggedUser = response.data.user;
    setUser(loggedUser);
    return loggedUser;
  };

  const logout = async () => {
    try {
      await apiClient.post("/auth/logout");
    } catch {
      // Proceed with local logout even if API call fails
    } finally {
      setUser(null);
      router.push("/login");
    }
  };

  const forgotPassword = async (email: string): Promise<ForgotPasswordResponse> => {
    const response = await apiClient.post("/auth/forgot-password", { email });
    return response.data;
  };

  const resetPassword = async (email: string, code: string, newPassword: string): Promise<string> => {
    const response = await apiClient.post("/auth/reset-password", {
      email,
      code,
      new_password: newPassword,
    });
    return response.data.message;
  };

  const refreshUser = async () => {
    await fetchCurrentUser();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: !!user,
        register,
        verifyOtp,
        resendOtp,
        login,
        logout,
        refreshUser,
        forgotPassword,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
