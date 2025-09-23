import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL
});

const refreshClient = axios.create({
  baseURL: API_BASE_URL
});

let accessToken = null;
let refreshToken = null;
let refreshPromise = null;
let unauthorizedHandler = null;

export const setAuthTokens = (tokens = {}) => {
  accessToken = tokens.accessToken || null;
  refreshToken = tokens.refreshToken || null;
};

export const getAuthTokens = () => ({ accessToken, refreshToken });

export const clearAuthTokens = () => {
  accessToken = null;
  refreshToken = null;
};

export const setUnauthorizedHandler = (handler) => {
  unauthorizedHandler = handler;
};

apiClient.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;

    if (
      status === 401 &&
      refreshToken &&
      !originalRequest?._retry &&
      !originalRequest?.url?.includes('/auth/login') &&
      !originalRequest?.url?.includes('/auth/register') &&
      !originalRequest?.url?.includes('/auth/refresh')
    ) {
      try {
        if (!refreshPromise) {
          refreshPromise = refreshClient
            .post('/auth/refresh', { refreshToken })
            .then((res) => {
              const tokens = res.data?.data || {};
              if (!tokens.accessToken) {
                throw new Error('Missing access token in refresh response');
              }
              accessToken = tokens.accessToken;
              if (tokens.refreshToken) {
                refreshToken = tokens.refreshToken;
              }
              return accessToken;
            })
            .catch((refreshError) => {
              clearAuthTokens();
              if (unauthorizedHandler) {
                unauthorizedHandler();
              }
              throw refreshError;
            })
            .finally(() => {
              refreshPromise = null;
            });
        }

        const newAccessToken = await refreshPromise;
        originalRequest._retry = true;
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        return Promise.reject(refreshError);
      }
    }

    if (status === 401 && unauthorizedHandler) {
      unauthorizedHandler();
    }

    return Promise.reject(error);
  }
);

export default apiClient;
