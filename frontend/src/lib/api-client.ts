import axios from "axios";

// Default to the dev stack's backend port (:8001). Port :8000 is reserved
// for an unrelated project on this machine, so falling back to it would
// cross-talk. dev.sh writes frontend/.env.local which overrides this.
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001/api/v1";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Interceptor to inject the access token in requests
apiClient.interceptors.request.use(
  (config) => {
    if (typeof window !== "undefined") {
      const accessToken = localStorage.getItem("cc_access_token");
      if (accessToken && config.headers) {
        config.headers.Authorization = `Bearer ${accessToken}`;
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
  localStorage.removeItem("cc_access_token");
  localStorage.removeItem("cc_refresh_token");
  // Dispatch custom event so the AuthProvider can react (soft redirect)
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
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return apiClient(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = typeof window !== "undefined" ? localStorage.getItem("cc_refresh_token") : null;

      if (!refreshToken) {
        isRefreshing = false;
        clearSessionAndRedirect();
        return Promise.reject(error);
      }

      try {
        // Request token rotation from the backend
        const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refresh_token: refreshToken,
        });

        const { access_token, refresh_token: new_refresh_token } = response.data;

        if (typeof window !== "undefined") {
          localStorage.setItem("cc_access_token", access_token);
          localStorage.setItem("cc_refresh_token", new_refresh_token);
        }

        // Replay the queue and original request
        apiClient.defaults.headers.common["Authorization"] = `Bearer ${access_token}`;
        originalRequest.headers["Authorization"] = `Bearer ${access_token}`;
        processQueue(null, access_token);
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
