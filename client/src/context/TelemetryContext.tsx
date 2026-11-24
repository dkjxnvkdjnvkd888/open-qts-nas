import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from '../api/client';
import { useAuth } from './AuthContext';
import type { TelemetryPoint, SystemEventLog, BackgroundTask } from '../types';

export interface ToastNotice {
  id: string;
  title: string;
  message: string;
  tone: 'info' | 'success' | 'warning' | 'error';
  timestamp: string;
}

interface TelemetryContextValue {
  history: TelemetryPoint[];
  latest: TelemetryPoint | null;
  connected: boolean;
  logs: SystemEventLog[];
  refreshLogs: () => Promise<void>;
  toasts: ToastNotice[];
  notify: (title: string, message: string, tone?: ToastNotice['tone']) => void;
  dismissToast: (id: string) => void;
  tasks: BackgroundTask[];
  startTask: (title: string, detail: string) => string;
  updateTask: (id: string, patch: Partial<Pick<BackgroundTask, 'progress' | 'detail' | 'status'>>) => void;
  clearCompletedTasks: () => void;
}

const TelemetryContext = createContext<TelemetryContextValue | null>(null);

export function TelemetryProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [history, setHistory] = useState<TelemetryPoint[]>([]);
  const [connected, setConnected] = useState(false);
  const [logs, setLogs] = useState<SystemEventLog[]>([]);
  const [toasts, setToasts] = useState<ToastNotice[]>([]);
  const [tasks, setTasks] = useState<BackgroundTask[]>([]);

  const notify = useCallback(
    (title: string, message: string, tone: ToastNotice['tone'] = 'info') => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const timestamp = new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      setToasts((prev) => [...prev.slice(-2), { id, title, message, tone, timestamp }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
    },
    []
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const startTask = useCallback((title: string, detail: string) => {
    const id = `task-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
    setTasks((prev) => [
      {
        id,
        title,
        detail,
        progress: 18,
        status: 'running',
        startedAt: new Date().toISOString(),
      },
      ...prev.slice(0, 14),
    ]);
    return id;
  }, []);

  const updateTask = useCallback(
    (id: string, patch: Partial<Pick<BackgroundTask, 'progress' | 'detail' | 'status'>>) => {
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    },
    []
  );

  const clearCompletedTasks = useCallback(() => {
    setTasks((prev) => prev.filter((t) => t.status === 'running'));
  }, []);

  const refreshLogs = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.getLogs();
      setLogs(res.logs);
    } catch {
      // ignore
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setHistory([]);
      setConnected(false);
      return;
    }

    let ws: WebSocket | null = null;
    let reconnectTimer: number | null = null;
    let disposed = false;

    void refreshLogs();
    api
      .getTelemetryHistory()
      .then((res) => {
        if (!disposed && res.history.length > 0) {
          setHistory(res.history);
        }
      })
      .catch(() => {});

    const connect = () => {
      if (disposed) return;
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      ws = new WebSocket(`${proto}//${window.location.host}/ws`);

      ws.onopen = () => {
        if (!disposed) setConnected(true);
      };

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data) as {
            type: 'history' | 'telemetry';
            data: TelemetryPoint | TelemetryPoint[];
          };
          if (msg.type === 'history' && Array.isArray(msg.data)) {
            setHistory(msg.data);
          } else if (msg.type === 'telemetry' && !Array.isArray(msg.data)) {
            setHistory((prev) => [...prev.slice(-59), msg.data as TelemetryPoint]);
          }
        } catch {
          // ignore
        }
      };

      ws.onclose = () => {
        if (!disposed) {
          setConnected(false);
          reconnectTimer = window.setTimeout(connect, 2500);
        }
      };
    };

    connect();

    return () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) ws.close();
    };
  }, [user, refreshLogs]);

  const latest = history.length > 0 ? history[history.length - 1] : null;

  return (
    <TelemetryContext.Provider
      value={{
        history,
        latest,
        connected,
        logs,
        refreshLogs,
        toasts,
        notify,
        dismissToast,
        tasks,
        startTask,
        updateTask,
        clearCompletedTasks,
      }}
    >
      {children}
    </TelemetryContext.Provider>
  );
}

export function useTelemetry() {
  const ctx = useContext(TelemetryContext);
  if (!ctx) throw new Error('useTelemetry must be used inside TelemetryProvider');
  return ctx;
}
