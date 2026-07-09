import { getAccessToken, getRefreshToken, storeTokens, clearTokens } from "./auth";

import { Platform } from "react-native";

// In Android emulators, localhost points to the emulator itself, so we must use 10.0.2.2 to reach the host machine.
const defaultUrl = Platform.OS === "android" 
  ? "http://10.0.2.2:8001/api/v1" 
  : "http://localhost:8001/api/v1";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || defaultUrl;

// Default per-request timeout. Without this a stalled network or unresponsive
// server leaves the request pending indefinitely, freezing the UI. Uploads
// pass a larger timeout via ApiOptions.timeoutMs.
const DEFAULT_TIMEOUT_MS = 30000;

interface ApiOptions extends RequestInit {
  params?: Record<string, string>;
  _retry?: boolean;
  /** Per-request timeout in ms (overrides the default). */
  timeoutMs?: number;
}

class ApiClient {
  private baseUrl: string;
  private isRefreshing = false;
  private failedQueue: Array<{
    resolve: (token: string) => void;
    reject: (error: unknown) => void;
  }> = [];
  private onSessionExpired: (() => void) | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  /** Register a callback invoked when the session is invalid (refresh token revoked). */
  setOnSessionExpired(cb: (() => void) | null) {
    this.onSessionExpired = cb;
  }

  private async processQueue(error: unknown, token: string | null = null) {
    this.failedQueue.forEach((prom) => {
      if (token) {
        prom.resolve(token);
      } else {
        prom.reject(error);
      }
    });
    this.failedQueue = [];
  }

  private async refreshTokens(): Promise<string> {
    const refreshToken = await getRefreshToken();
    if (!refreshToken) throw new Error("No refresh token");

    const res = await fetch(`${this.baseUrl}/auth/mobile/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!res.ok) {
      // Only wipe tokens on a definitive auth rejection (401/403).
      // For server errors (5xx) or network blips, keep the stored
      // refresh token so the next app launch can retry.
      if (res.status === 401 || res.status === 403) {
        await clearTokens();
      }
      throw new Error("Refresh failed");
    }

    const data = await res.json();
    await storeTokens(data.access_token, data.refresh_token);
    return data.access_token;
  }

  async request<T = unknown>(path: string, options: ApiOptions = {}): Promise<T> {
    const { params, timeoutMs, ...fetchOptions } = options;

    let url = `${this.baseUrl}${path}`;
    if (params) {
      const searchParams = new URLSearchParams(params);
      url += `?${searchParams.toString()}`;
    }

    const token = await getAccessToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(fetchOptions.headers as Record<string, string> || {}),
    };

    // Don't set Content-Type for FormData
    if (fetchOptions.body instanceof FormData) {
      delete headers["Content-Type"];
    }

    const doFetch = (): Promise<Response> => {
      const controller = new AbortController();
      const ms = timeoutMs ?? DEFAULT_TIMEOUT_MS;
      const timer = setTimeout(() => controller.abort(), ms);
      return fetch(url, { ...fetchOptions, headers, signal: controller.signal }).finally(() =>
        clearTimeout(timer)
      );
    };

    let res: Response;
    try {
      res = await doFetch();
    } catch (err) {
      throw new Error(
        err instanceof DOMException && err.name === "AbortError"
          ? "Request timed out. Please check your connection and try again."
          : "Network request failed."
      );
    }

    // Handle 401 - try refresh
    if (res.status === 401 && !options._retry) {
      if (this.isRefreshing) {
        return new Promise((resolve, reject) => {
          this.failedQueue.push({
            resolve: (newToken: string) => {
              headers.Authorization = `Bearer ${newToken}`;
              doFetch()
                .then((r) => r.json())
                .then(resolve)
                .catch(reject);
            },
            reject,
          });
        });
      }

      this.isRefreshing = true;
      try {
        const newToken = await this.refreshTokens();
        this.isRefreshing = false;
        this.processQueue(null, newToken);

        headers.Authorization = `Bearer ${newToken}`;
        res = await doFetch();
      } catch (error) {
        this.isRefreshing = false;
        this.processQueue(error, null);
        await clearTokens();
        this.onSessionExpired?.();
        throw error;
      }
    }

    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: "Request failed" }));
      const detail = error.detail;
      const message = typeof detail === "string"
        ? detail
        : Array.isArray(detail)
          ? detail.map((d: { msg?: string }) => d.msg || JSON.stringify(d)).join(", ")
          : JSON.stringify(detail);
      throw new Error(message || `HTTP ${res.status}`);
    }

    return res.json();
  }

  get<T = unknown>(path: string, options?: ApiOptions): Promise<T> {
    return this.request<T>(path, { ...options, method: "GET" });
  }

  post<T = unknown>(path: string, body?: unknown, options?: ApiOptions): Promise<T> {
    return this.request<T>(path, {
      ...options,
      method: "POST",
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    });
  }

  patch<T = unknown>(path: string, body?: unknown, options?: ApiOptions): Promise<T> {
    return this.request<T>(path, {
      ...options,
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  delete<T = unknown>(path: string, options?: ApiOptions): Promise<T> {
    return this.request<T>(path, { ...options, method: "DELETE" });
  }
}

export const api = new ApiClient(API_BASE_URL);
