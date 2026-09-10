/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const AuthContext = createContext();

export { AuthContext };

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('token') || '');
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      localStorage.removeItem('user');
      return null;
    }
  });

  useEffect(() => {
    if (token) localStorage.setItem('token', token);
    else localStorage.removeItem('token');
  }, [token]);

  useEffect(() => {
    if (user) localStorage.setItem('user', JSON.stringify(user));
    else localStorage.removeItem('user');
  }, [user]);

  const value = useMemo(() => ({
    token,
    setToken,
    user,
    setUser,
    login: (newToken, newUser) => {
      setToken(newToken || '');
      setUser(newUser || null);
    },
    logout: () => {
      setToken('');
      setUser(null);
    }
  }), [token, user, setToken, setUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

