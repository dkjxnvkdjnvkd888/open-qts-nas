import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, getStoredToken, setStoredToken } from '../api/client';
import type { UserProfile, PublicNasInfo, DesktopSettings } from '../types';

interface AuthContextValue {
  user: UserProfile | null;
  publicInfo: PublicNasInfo | null;
  settings: DesktopSettings | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  updateSettings: (updates: Partial<DesktopSettings>) => Promise<void>;
  refreshPublicInfo: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [publicInfo, setPublicInfo] = useState<PublicNasInfo | null>(null);
  const [settings, setSettings] = useState<DesktopSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSettings = useCallback(async () => {
    try {
      const s = await api.getSettings();
      setSettings(s);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const pub = await api.getPublicInfo();
        if (active) setPublicInfo(pub);
      } catch {
        // ignore
      }

      const token = getStoredToken();
      if (token) {
        try {
          const me = await api.me();
          if (active) {
            setUser(me);
            await loadSettings();
          }
        } catch {
          setStoredToken(null);
        }
      }
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [loadSettings]);

  const login = useCallback(
    async (username: string, password: string) => {
      const res = await api.login(username, password);
      setStoredToken(res.token);
      setUser(res.user);
      await loadSettings();
    },
    [loadSettings]
  );

  const logout = useCallback(() => {
    setStoredToken(null);
    setUser(null);
    setSettings(null);
  }, []);

  const updateSettings = useCallback(async (updates: Partial<DesktopSettings>) => {
    const next = await api.updateSettings(updates);
    setSettings(next);
    setPublicInfo((prev) =>
      prev
        ? {
            ...prev,
            nasName: next.nasName,
            wallpaper: next.wallpaper,
          }
        : prev
    );
  }, []);

  const refreshPublicInfo = useCallback(async () => {
    try {
      const pub = await api.getPublicInfo();
      setPublicInfo(pub);
    } catch {
      // ignore
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        publicInfo,
        settings,
        loading,
        login,
        logout,
        updateSettings,
        refreshPublicInfo,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
