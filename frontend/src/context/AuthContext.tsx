"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiRequest } from '@/lib/api';

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  role_name?: string;
  permissions?: string[];
  is_admin?: boolean;
  employee_id?: string;
  employee_code?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  copilotOpen: boolean;
  setCopilotOpen: (open: boolean) => void;
  isAdmin: boolean;
  hasPermission: (module: string) => boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copilotOpen, setCopilotOpen] = useState(false);

  const fetchCurrentUser = useCallback(async (jwtToken: string) => {
    try {
      const data = await apiRequest<User>('/auth/me', {
        headers: { Authorization: `Bearer ${jwtToken}` }
      });
      setUser(data);
    } catch (err) {
      console.error("Failed to fetch user profile:", err);
      logout();
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    if (savedToken) {
      setToken(savedToken);
      fetchCurrentUser(savedToken);
    } else {
      setLoading(false);
    }
  }, [fetchCurrentUser]);

  const refreshUser = async () => {
    const currentToken = token || localStorage.getItem('token');
    if (currentToken) {
      await fetchCurrentUser(currentToken);
    }
  };

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const res = await apiRequest<{ access_token: string; user: User }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      localStorage.setItem('token', res.access_token);
      setToken(res.access_token);
      setUser(res.user);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  const isAdmin = Boolean(
    user && (
      user.is_admin ||
      user.role === 'admin' ||
      user.role === 'super_admin' ||
      (user.permissions && user.permissions.includes('*'))
    )
  );

  const hasPermission = (module: string): boolean => {
    if (!user) return false;
    if (isAdmin) return true;
    if (!user.permissions) return false;
    return user.permissions.includes('*') || user.permissions.includes(module);
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      loading,
      login,
      logout,
      copilotOpen,
      setCopilotOpen,
      isAdmin,
      hasPermission,
      refreshUser
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
