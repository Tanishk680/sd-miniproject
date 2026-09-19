import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!localStorage.getItem('token'));

  useEffect(() => {
    if (!token) {
      setUser(null);
      setLoading(false);
      return undefined;
    }
    let active = true;
    setLoading(true);
    api
      .profile()
      .then((data) => {
        if (active) setUser(data.user);
      })
      .catch(() => {
        if (active) {
          localStorage.removeItem('token');
          setToken(null);
          setUser(null);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token]);

  function persist(session) {
    localStorage.setItem('token', session.token);
    setToken(session.token);
    setUser(session.user);
  }

  async function login(username, password) {
    const session = await api.login({ username, password });
    persist(session);
    return session.user;
  }

  async function register(username, email, password) {
    const session = await api.register({ username, email, password });
    persist(session);
    return session.user;
  }

  function logout() {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ token, user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}