import axios from "axios";

// In development, proxy through Next.js rewrites (same-origin) so cookies
// work with dev tunnels. In production, the reverse proxy handles routing.
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  withCredentials: true,  // Send cookies (access_token, refresh_token, csrf) on every request
  headers: {
    "Content-Type": "application/json",
  },
});

/**
 * Read a cookie value by name.  Used to grab the CSRF token from the
 * ``cc_csrf`` cookie (which is *not* httpOnly so JS can read it).
 */
function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

// Interceptor to inject the CSRF token on state-changing requests
apiClient.interceptors.request.use(
  (config) => {
    // Attach CSRF header for non-safe methods
    const method = (config.method || "").toLowerCase();
    if (["post", "put", "patch", "delete"].includes(method)) {
      const csrfToken = getCookie("cc_csrf");
      if (csrfToken && config.headers) {
        config.headers["X-CSRF-Token"] = csrfToken;
      }
    }
    // Let the browser set Content-Type with the correct boundary for FormData
    if (config.data instanceof FormData) {
      delete config.headers["Content-Type"];
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (token) {
      prom.resolve(token);
    } else {
      prom.reject(error);
    }
  });
  failedQueue = [];
};

const clearSessionAndRedirect = () => {
  if (typeof window === "undefined") return;
  // Cookies are cleared by the backend on logout; just dispatch the event
  window.dispatchEvent(new CustomEvent("auth:session-expired"));
};

// Response interceptor to handle token refresh automatically
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Only attempt refresh on 401 errors where we haven't already retried
    if (error.response?.status === 401 && !originalRequest._retry) {
      // If we are already refreshing, queue this request
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => {
            // After refresh, cookies are updated — just retry
            return apiClient(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Request token rotation — the refresh cookie is sent automatically
        await axios.post(`${API_BASE_URL}/auth/refresh`, null, {
          withCredentials: true,
        });

        // Cookies have been updated by the backend Set-Cookie headers.
        // Replay the queue and original request.
        processQueue(null, "refreshed");
        isRefreshing = false;
        return apiClient(originalRequest);
      } catch (refreshError) {
        // Refresh token failed or is expired — log out user entirely
        processQueue(refreshError, null);
        isRefreshing = false;
        clearSessionAndRedirect();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);
