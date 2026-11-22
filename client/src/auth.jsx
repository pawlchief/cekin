import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api.js';

export const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = masih memuat, null = belum masuk

  useEffect(() => {
    api.setUnauthorizedHandler(() => setUser(null)); // sesi habis di tengah jalan
    api.get('/auth/me').then((d) => setUser(d.user)).catch(() => setUser(null));
  }, []);

  const login = useCallback(async (identifier, password) => {
    const d = await api.post('/auth/login', { identifier, password });
    api.setCsrf(d.csrfToken); // session diganti saat login, token CSRF ikut berganti
    setUser(d.user);
  }, []);

  const logout = useCallback(async () => {
    try { await api.post('/auth/logout'); } finally {
      api.resetCsrf();
      setUser(null);
    }
  }, []);

  const value = useMemo(() => ({ user, setUser, login, logout }), [user, login, logout]);
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
