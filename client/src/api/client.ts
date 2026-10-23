import axios from "axios";

export const AUTH_TOKEN_KEY = "claimsight-auth-token";

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      const path = window.location.pathname;
      const isAuthPage = path === "/login" || path === "/register";

      if (!isAuthPage) {
        window.location.replace("/login");
      }
    }

    return Promise.reject(error);
  },
);
