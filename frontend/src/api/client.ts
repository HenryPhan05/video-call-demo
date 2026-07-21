import axios, { type InternalAxiosRequestConfig } from "axios";

const API_URL = "http://localhost:4000/api/v1";

export const apiClient = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

let refreshRequest: Promise<void> | null = null;

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const request = error.config as
      | (InternalAxiosRequestConfig & {
        _retriedAfterRefresh?: boolean;
      })
      | undefined;
    const isAuthenticationRequest = request?.url?.startsWith("/auth/");

    if (
      error.response?.status !== 401 ||
      !request ||
      request._retriedAfterRefresh ||
      isAuthenticationRequest
    )
      return Promise.reject(error);

    request._retriedAfterRefresh = true;
    refreshRequest ??= axios
      .post(`${API_URL}/auth/refresh`, null, {
        withCredentials: true,
      })
      .then(() => undefined)
      .finally(() => {
        refreshRequest = null;
      });

    try {
      await refreshRequest;
      return apiClient(request);
    } catch {
      return Promise.reject(error);
    }
  },
);
