import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient, {
  clearAuthTokens,
  getAuthTokens,
  setAuthTokens,
  setUnauthorizedHandler
} from '../services/apiClient.js';

const AuthContext = createContext(null);
const STORAGE_KEY = 'maoga-auth-state';

export const AuthProvider = ({ children }) => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const persistState = useCallback((state) => {
    if (!state) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, []);

  const clearSession = useCallback(
    (redirect = true) => {
      setUser(null);
      clearAuthTokens();
      persistState(null);
      if (redirect) {
        navigate('/login', { replace: true });
      }
    },
    [navigate, persistState]
  );

  useEffect(() => {
    setUnauthorizedHandler(clearSession);
    return () => setUnauthorizedHandler(null);
  }, [clearSession]);

  const bootstrap = useCallback(async () => {
    const storedRaw = localStorage.getItem(STORAGE_KEY);

    if (!storedRaw) {
      setIsLoading(false);
      return;
    }

    try {
      const stored = JSON.parse(storedRaw);
      if (stored?.accessToken) {
        setAuthTokens({ accessToken: stored.accessToken, refreshToken: stored.refreshToken });
        const meResponse = await apiClient.get('/users/me');
        setUser(meResponse.data?.data?.user || null);
      }
    } catch (error) {
      console.error('Failed to restore auth session', error);
      clearSession(false);
    } finally {
      setIsLoading(false);
    }
  }, [clearSession]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const updateAuthState = useCallback(
    (payload) => {
      if (!payload) {
        clearSession();
        return;
      }

      const { user: nextUser, accessToken, refreshToken } = payload;
      setUser(nextUser);
      setAuthTokens({ accessToken, refreshToken });
      persistState({ accessToken, refreshToken });
    },
    [clearSession, persistState]
  );

  const login = useCallback(
    async ({ credential, password }) => {
      const response = await apiClient.post('/auth/login', { credential, password });
      const data = response.data?.data;
      if (data) {
        updateAuthState(data);
      }
      return data;
    },
    [updateAuthState]
  );

  const register = useCallback(
    async ({ email, username, password, displayName }) => {
      const response = await apiClient.post('/auth/register', {
        email,
        username,
        password,
        displayName
      });
      const data = response.data?.data;
      if (data) {
        updateAuthState(data);
      }
      return data;
    },
    [updateAuthState]
  );

  const refreshProfile = useCallback(async () => {
    const tokens = getAuthTokens();
    if (!tokens.accessToken) {
      return null;
    }
    const response = await apiClient.get('/users/me');
    const freshUser = response.data?.data?.user || null;
    setUser(freshUser);
    return freshUser;
  }, []);

  const logout = useCallback(async () => {
    try {
      const tokens = getAuthTokens();
      if (tokens.refreshToken) {
        await apiClient.post('/auth/logout', { refreshToken: tokens.refreshToken });
      }
    } catch (error) {
      console.warn('Logout error ignored', error);
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isLoading,
      login,
      register,
      logout,
      refreshProfile
    }),
    [user, isLoading, login, register, logout, refreshProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
