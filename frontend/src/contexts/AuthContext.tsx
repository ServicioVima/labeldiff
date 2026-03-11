import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { AuthUser } from '../types';
import { getMe, getLoginUrl } from '../lib/api';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  loginUrl: string;
  refetch: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    try {
      const me = await getMe();
      if (me.authenticated && me.id != null && me.email && me.name && me.role) {
        setUser({ id: me.id, email: me.email, name: me.name, role: me.role as AuthUser['role'] });
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return (
    <AuthContext.Provider value={{ user, loading, loginUrl: getLoginUrl(), refetch }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
