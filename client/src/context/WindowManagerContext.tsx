import React, { createContext, useContext, useState, useCallback } from 'react';
import type { AppWindowId } from '../types';

export interface WindowInstance {
  id: AppWindowId;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  minimized: boolean;
  maximized: boolean;
  closing?: boolean;
  zIndex: number;
}

export interface AppDefinition {
  id: AppWindowId;
  title: string;
  subtitle: string;
  category: 'System' | 'Applications' | 'Multimedia';
  accentHex: string;
  defaultWidth: number;
  defaultHeight: number;
}

export const APP_DEFINITIONS: Record<AppWindowId, AppDefinition> = {
  'control-panel': {
    id: 'control-panel',
    title: 'Control Panel',
    subtitle: 'System settings, users, shared folders & network services',
    category: 'System',
    accentHex: '#2563eb',
    defaultWidth: 960,
    defaultHeight: 620,
  },
  'file-station': {
    id: 'file-station',
    title: 'File Station 5',
    subtitle: 'Browse, upload, share & manage NAS storage folders',
    category: 'Applications',
    accentHex: '#f59e0b',
    defaultWidth: 980,
    defaultHeight: 620,
  },
  'storage-snapshots': {
    id: 'storage-snapshots',
    title: 'Storage & Snapshots',
    subtitle: 'Physical disks, SMART health, RAID & logical volumes',
    category: 'System',
    accentHex: '#0284c7',
    defaultWidth: 940,
    defaultHeight: 620,
  },
  myqnapcloud: {
    id: 'myqnapcloud',
    title: 'myQNAPcloud',
    subtitle: 'DuckDNS / Cloudflare DDNS & Reverse Proxy manager',
    category: 'System',
    accentHex: '#0ea5e9',
    defaultWidth: 940,
    defaultHeight: 620,
  },
  'app-center': {
    id: 'app-center',
    title: 'App Center',
    subtitle: 'Install Docker & NAS applications with one click',
    category: 'Applications',
    accentHex: '#e11d48',
    defaultWidth: 980,
    defaultHeight: 640,
  },
  'resource-monitor': {
    id: 'resource-monitor',
    title: 'Resource Monitor',
    subtitle: 'Real-time CPU, RAM, LAN throughput & host processes',
    category: 'System',
    accentHex: '#059669',
    defaultWidth: 920,
    defaultHeight: 610,
  },
  'music-station': {
    id: 'music-station',
    title: 'Music Station 5',
    subtitle: 'Stream MP3, FLAC & WAV audio directly from Media folder',
    category: 'Multimedia',
    accentHex: '#7c3aed',
    defaultWidth: 980,
    defaultHeight: 630,
  },
  'photo-video': {
    id: 'photo-video',
    title: 'QuMagie Media',
    subtitle: 'Photo gallery & HTML5 video streaming from Media/',
    category: 'Multimedia',
    accentHex: '#db2777',
    defaultWidth: 980,
    defaultHeight: 630,
  },
};

interface WindowManagerValue {
  windows: WindowInstance[];
  activeWindowId: AppWindowId | null;
  openWindow: (id: AppWindowId) => void;
  closeWindow: (id: AppWindowId) => void;
  focusWindow: (id: AppWindowId) => void;
  toggleMinimize: (id: AppWindowId) => void;
  toggleMaximize: (id: AppWindowId) => void;
  updateBounds: (
    id: AppWindowId,
    bounds: Partial<Pick<WindowInstance, 'x' | 'y' | 'width' | 'height'>>
  ) => void;
  minimizeAll: () => void;
}

const WindowManagerContext = createContext<WindowManagerValue | null>(null);

export function WindowManagerProvider({ children }: { children: React.ReactNode }) {
  const [windows, setWindows] = useState<WindowInstance[]>([]);
  const [topZ, setTopZ] = useState(20);
  const [activeWindowId, setActiveWindowId] = useState<AppWindowId | null>(null);

  const openWindow = useCallback((id: AppWindowId) => {
    setTopZ((prevZ) => {
      const nextZ = prevZ + 1;
      setWindows((prev) => {
        const existing = prev.find((w) => w.id === id);
        if (existing) {
          return prev.map((w) =>
            w.id === id ? { ...w, minimized: false, closing: false, zIndex: nextZ } : w
          );
        }
        const def = APP_DEFINITIONS[id];
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const width = Math.min(def.defaultWidth, Math.max(540, vw - 64));
        const height = Math.min(def.defaultHeight, Math.max(420, vh - 86));
        const offset = (prev.length % 6) * 26;
        const x = Math.max(
          20,
          Math.min(vw - width - 20, Math.round((vw - width) / 2) - 20 + offset)
        );
        const y = Math.max(
          56,
          Math.min(vh - height - 16, Math.round((vh - height) / 2) + 8 + offset)
        );

        return [
          ...prev,
          {
            id,
            title: def.title,
            x,
            y,
            width,
            height,
            minimized: false,
            maximized: false,
            closing: false,
            zIndex: nextZ,
          },
        ];
      });
      return nextZ;
    });
    setActiveWindowId(id);
  }, []);

  const closeWindow = useCallback((id: AppWindowId) => {
    // Crisp 150ms close animation matching QTS OS feel
    setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, closing: true } : w)));
    window.setTimeout(() => {
      setWindows((prev) => {
        const remaining = prev.filter((w) => w.id !== id);
        const top = remaining
          .filter((w) => !w.minimized && !w.closing)
          .sort((a, b) => b.zIndex - a.zIndex)[0];
        setActiveWindowId(top ? top.id : null);
        return remaining;
      });
    }, 150);
  }, []);

  const focusWindow = useCallback((id: AppWindowId) => {
    setTopZ((prevZ) => {
      const nextZ = prevZ + 1;
      setWindows((prev) =>
        prev.map((w) => (w.id === id ? { ...w, minimized: false, zIndex: nextZ } : w))
      );
      return nextZ;
    });
    setActiveWindowId(id);
  }, []);

  const toggleMinimize = useCallback((id: AppWindowId) => {
    setWindows((prev) => {
      const target = prev.find((w) => w.id === id);
      if (!target) return prev;
      if (target.minimized) {
        const nextZ = Math.max(...prev.map((w) => w.zIndex), 20) + 1;
        setTopZ(nextZ);
        setActiveWindowId(id);
        return prev.map((w) => (w.id === id ? { ...w, minimized: false, zIndex: nextZ } : w));
      } else {
        const next = prev.map((w) => (w.id === id ? { ...w, minimized: true } : w));
        const fallback = next
          .filter((w) => !w.minimized)
          .sort((a, b) => b.zIndex - a.zIndex)[0];
        setActiveWindowId(fallback ? fallback.id : null);
        return next;
      }
    });
  }, []);

  const toggleMaximize = useCallback((id: AppWindowId) => {
    setWindows((prev) =>
      prev.map((w) => (w.id === id ? { ...w, maximized: !w.maximized } : w))
    );
    setActiveWindowId(id);
  }, []);

  const updateBounds = useCallback(
    (
      id: AppWindowId,
      bounds: Partial<Pick<WindowInstance, 'x' | 'y' | 'width' | 'height'>>
    ) => {
      setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, ...bounds } : w)));
    },
    []
  );

  const minimizeAll = useCallback(() => {
    setWindows((prev) => prev.map((w) => ({ ...w, minimized: true })));
    setActiveWindowId(null);
  }, []);

  return (
    <WindowManagerContext.Provider
      value={{
        windows,
        activeWindowId,
        openWindow,
        closeWindow,
        focusWindow,
        toggleMinimize,
        toggleMaximize,
        updateBounds,
        minimizeAll,
      }}
    >
      {children}
    </WindowManagerContext.Provider>
  );
}

export function useWindowManager() {
  const ctx = useContext(WindowManagerContext);
  if (!ctx) throw new Error('useWindowManager must be used inside WindowManagerProvider');
  return ctx;
}
