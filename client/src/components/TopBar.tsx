import { useEffect, useState, useRef } from 'react';
import {
  Menu,
  Search,
  Bell,
  ListChecks,
  Gauge,
  User,
  Power,
  RotateCw,
  Moon,
  LogOut,
  X,
  CheckCircle2,
  AlertTriangle,
  Info,
  Loader2,
  ChevronDown,
  HardDrive,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTelemetry } from '../context/TelemetryContext';
import { APP_DEFINITIONS, useWindowManager } from '../context/WindowManagerContext';
import { AppBadgeIcon } from './AppIcon';
import { api } from '../api/client';
import { formatDateTime } from '../utils/format';
import type { AppWindowId } from '../types';

const ALL_APP_IDS = Object.keys(APP_DEFINITIONS) as AppWindowId[];

export function TopBar() {
  const { user, settings, logout } = useAuth();
  const { latest, logs, refreshLogs, notify, tasks, clearCompletedTasks } = useTelemetry();
  const {
    windows,
    activeWindowId,
    openWindow,
    closeWindow,
    toggleMinimize,
    focusWindow,
    minimizeAll,
  } = useWindowManager();

  const [now, setNow] = useState(new Date());
  const [openMenu, setOpenMenu] = useState<
    'main' | 'search' | 'tasks' | 'notifications' | 'user' | null
  >(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [drawerFilter, setDrawerFilter] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpenMenu((prev) => (prev === 'search' ? null : 'search'));
      } else if (e.key === 'Escape') {
        setOpenMenu(null);
      }
    };
    window.addEventListener('mousedown', onDocClick);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDocClick);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  const runningTasksCount = tasks.filter((t) => t.status === 'running').length;

  const filteredSearchApps = ALL_APP_IDS.filter((id) => {
    const def = APP_DEFINITIONS[id];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return def.title.toLowerCase().includes(q) || def.subtitle.toLowerCase().includes(q);
  });

  const drawerApps = ALL_APP_IDS.filter((id) => {
    const def = APP_DEFINITIONS[id];
    const q = drawerFilter.trim().toLowerCase();
    if (!q) return true;
    return def.title.toLowerCase().includes(q) || def.category.toLowerCase().includes(q);
  });

  const handlePower = async (action: 'restart' | 'sleep' | 'shutdown') => {
    setOpenMenu(null);
    try {
      const res = await api.powerAction(action);
      notify('Power Management', res.message, 'warning');
      void refreshLogs();
    } catch (err) {
      notify('Power Management', (err as Error).message, 'error');
    }
  };

  return (
    <div ref={containerRef}>
      {/* QNAP QTS 5.x Dark Enterprise Top Bar */}
      <header className="fixed top-0 left-0 right-0 h-12 z-50 bg-[#121629]/95 border-b border-white/10 px-2 flex items-center justify-between gap-2 text-slate-100">
        {/* Left: 3-line Hamburger Main Menu + Open Window Tabs */}
        <div className="flex items-center gap-2 min-w-0 flex-1 h-full">
          <button
            type="button"
            onClick={() => setOpenMenu((m) => (m === 'main' ? null : 'main'))}
            title="Main Menu"
            className={`w-9 h-9 rounded flex items-center justify-center transition-colors duration-100 shrink-0 ${
              openMenu === 'main'
                ? 'bg-white/20 text-white'
                : 'text-slate-200 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Menu className="w-5 h-5" strokeWidth={1.9} />
          </button>

          {/* QTS Style Open Window Tabs (Active = crisp white, Inactive = translucent slate, inline close X) */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar min-w-0">
            {windows.map((w) => {
              const focused = activeWindowId === w.id && !w.minimized;
              return (
                <div
                  key={w.id}
                  onClick={() => (focused ? toggleMinimize(w.id) : focusWindow(w.id))}
                  className={`h-8 pl-2 pr-1.5 rounded-[4px] flex items-center gap-2 text-xs cursor-pointer transition-colors duration-100 max-w-[190px] shrink-0 ${
                    focused
                      ? 'bg-[#f4f6f9] text-slate-900 font-medium shadow-sm'
                      : 'bg-white/15 text-slate-200 hover:bg-white/25'
                  }`}
                >
                  <AppBadgeIcon id={w.id} size="xs" />
                  <span className="truncate">{w.title}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      closeWindow(w.id);
                    }}
                    title="Close"
                    className={`p-0.5 rounded transition-colors ${
                      focused
                        ? 'text-slate-500 hover:bg-slate-300 hover:text-slate-900'
                        : 'text-slate-300 hover:bg-white/20 hover:text-white'
                    }`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Search, Background Tasks, Notification Board, Profile, Dashboard Gauge, Time */}
        <div className="flex items-center gap-0.5 shrink-0">
          {/* Spotlight Search */}
          <button
            type="button"
            onClick={() => setOpenMenu((m) => (m === 'search' ? null : 'search'))}
            title="Search (Ctrl+K)"
            className={`w-9 h-9 rounded flex items-center justify-center transition-colors duration-100 ${
              openMenu === 'search' ? 'bg-white/20 text-white' : 'text-slate-200 hover:bg-white/10'
            }`}
          >
            <Search className="w-[18px] h-[18px]" strokeWidth={1.8} />
          </button>

          <div className="h-4 w-px bg-white/15 mx-1" />

          {/* Background Tasks */}
          <button
            type="button"
            onClick={() => setOpenMenu((m) => (m === 'tasks' ? null : 'tasks'))}
            title="Background Tasks"
            className={`w-9 h-9 rounded flex items-center justify-center relative transition-colors duration-100 ${
              openMenu === 'tasks' ? 'bg-white/20 text-white' : 'text-slate-200 hover:bg-white/10'
            }`}
          >
            {runningTasksCount > 0 ? (
              <Loader2 className="w-[18px] h-[18px] text-sky-400 animate-spin" />
            ) : (
              <ListChecks className="w-[18px] h-[18px]" strokeWidth={1.8} />
            )}
            {tasks.length > 0 && (
              <span
                className={`absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded text-[10px] font-semibold flex items-center justify-center ${
                  runningTasksCount > 0 ? 'bg-sky-500 text-white' : 'bg-slate-600 text-slate-100'
                }`}
              >
                {runningTasksCount > 0 ? runningTasksCount : tasks.length}
              </span>
            )}
          </button>

          {/* Notification Board */}
          <button
            type="button"
            onClick={() => {
              if (openMenu !== 'notifications') void refreshLogs();
              setOpenMenu((m) => (m === 'notifications' ? null : 'notifications'));
            }}
            title="Notification Board"
            className={`w-9 h-9 rounded flex items-center justify-center relative transition-colors duration-100 ${
              openMenu === 'notifications'
                ? 'bg-white/20 text-white'
                : 'text-slate-200 hover:bg-white/10'
            }`}
          >
            <Bell className="w-[18px] h-[18px]" strokeWidth={1.8} />
            {logs.length > 0 && (
              <span className="absolute top-1 right-0.5 min-w-[18px] h-4 px-1 rounded bg-[#f59e0b] text-[#111827] text-[10px] font-bold flex items-center justify-center leading-none">
                {logs.length > 9 ? '10+' : logs.length}
              </span>
            )}
          </button>

          <div className="h-4 w-px bg-white/15 mx-1" />

          {/* User Profile */}
          <button
            type="button"
            onClick={() => setOpenMenu((m) => (m === 'user' ? null : 'user'))}
            className={`h-9 px-2 rounded flex items-center gap-1.5 text-xs transition-colors duration-100 ${
              openMenu === 'user' ? 'bg-white/20 text-white' : 'text-slate-200 hover:bg-white/10'
            }`}
          >
            <User className="w-[17px] h-[17px]" strokeWidth={1.8} />
            <span className="hidden sm:inline font-medium">{user?.username || 'admin'}</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {/* Resource Monitor Quick Button */}
          <button
            type="button"
            onClick={() => openWindow('resource-monitor')}
            title={
              latest
                ? `Resource Monitor — CPU ${latest.cpuPercent}% | RAM ${latest.memoryPercent}%`
                : 'Open Resource Monitor'
            }
            className="w-9 h-9 rounded flex items-center justify-center text-slate-200 hover:bg-white/10 transition-colors duration-100"
          >
            <Gauge className="w-[18px] h-[18px]" strokeWidth={1.8} />
          </button>

          <div className="h-4 w-px bg-white/15 mx-1 hidden sm:block" />

          {/* Live System Clock (click to show desktop) */}
          <button
            type="button"
            onClick={minimizeAll}
            title="Show Desktop"
            className="hidden sm:flex flex-col items-end justify-center px-2 h-9 rounded hover:bg-white/10 leading-tight tabular-nums text-right"
          >
            <span className="text-[12px] font-medium text-white">
              {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            <span className="text-[10px] text-slate-400">
              {now.toLocaleDateString([], { year: 'numeric', month: '2-digit', day: '2-digit' })}
            </span>
          </button>
        </div>
      </header>

      {/* === QTS SLIDE-OUT MAIN MENU DRAWER (LEFT SIDE) === */}
      {openMenu === 'main' && (
        <aside className="fixed top-12 left-0 bottom-0 w-72 z-[60] bg-[#1b2033] border-r border-white/10 shadow-2xl flex flex-col text-slate-100 qts-drawer-in">
          <div className="px-4 py-3.5 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded bg-[#2563eb] flex items-center justify-center text-white">
                <HardDrive className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-semibold tracking-wide text-white">
                  {settings?.nasName || 'OpenQTS'}
                </div>
                <div className="text-[10px] text-slate-400">OpenQTS 5.2 DIY NAS</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpenMenu(null)}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/10"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Filter Box */}
          <div className="p-3 border-b border-white/10">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={drawerFilter}
                onChange={(e) => setDrawerFilter(e.target.value)}
                placeholder="Filter applications..."
                className="w-full bg-[#111524] border border-white/10 rounded px-8 py-1.5 text-xs text-white outline-none focus:border-sky-500"
              />
            </div>
          </div>

          {/* Categorized QTS Application List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-4">
            {(['System', 'Applications', 'Multimedia'] as const).map((cat) => {
              const items = drawerApps.filter((id) => APP_DEFINITIONS[id].category === cat);
              if (items.length === 0) return null;
              return (
                <div key={cat}>
                  <div className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    {cat}
                  </div>
                  <div className="space-y-0.5">
                    {items.map((id) => {
                      const def = APP_DEFINITIONS[id];
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => {
                            openWindow(id);
                            setOpenMenu(null);
                          }}
                          className="w-full flex items-center gap-3 px-2.5 py-2 rounded hover:bg-white/10 text-left transition-colors duration-100"
                        >
                          <AppBadgeIcon id={id} size="sm" />
                          <div className="min-w-0">
                            <div className="text-xs font-medium text-white truncate">
                              {def.title}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate">
                              {def.subtitle}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="px-4 py-2.5 border-t border-white/10 bg-[#141828] flex items-center justify-between text-[11px] text-slate-400">
            <span>CPU {latest ? `${latest.cpuPercent}%` : '--'}</span>
            <span>RAM {latest ? `${latest.memoryPercent}%` : '--'}</span>
            <button
              type="button"
              onClick={() => {
                minimizeAll();
                setOpenMenu(null);
              }}
              className="text-sky-400 hover:text-sky-300 font-medium"
            >
              Show Desktop
            </button>
          </div>
        </aside>
      )}

      {/* === POPOVER: SPOTLIGHT SEARCH === */}
      {openMenu === 'search' && (
        <div className="fixed top-12 right-44 z-[60] w-80 bg-white text-slate-800 rounded-b shadow-2xl border border-slate-200 p-3 qts-popover-in">
          <div className="relative mb-2">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search QTS apps & tools..."
              autoFocus
              className="w-full bg-slate-50 border border-slate-300 rounded px-8 py-1.5 text-xs text-slate-900 outline-none focus:border-blue-500"
            />
          </div>
          <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
            {filteredSearchApps.map((id) => {
              const def = APP_DEFINITIONS[id];
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    openWindow(id);
                    setSearchQuery('');
                    setOpenMenu(null);
                  }}
                  className="w-full flex items-center gap-3 p-2 hover:bg-slate-100 text-left transition-colors"
                >
                  <AppBadgeIcon id={id} size="sm" />
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-slate-900 truncate">{def.title}</div>
                    <div className="text-[11px] text-slate-500 truncate">{def.subtitle}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* === POPOVER: BACKGROUND TASKS === */}
      {openMenu === 'tasks' && (
        <div className="fixed top-12 right-28 z-[60] w-96 bg-white text-slate-800 rounded-b shadow-2xl border border-slate-200 overflow-hidden qts-popover-in">
          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-800">
              Background Tasks ({tasks.length})
            </span>
            {tasks.some((t) => t.status !== 'running') && (
              <button
                type="button"
                onClick={clearCompletedTasks}
                className="text-[11px] text-blue-600 hover:underline"
              >
                Clear Completed
              </button>
            )}
          </div>
          <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
            {tasks.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                No active background tasks. File uploads, app installs, DDNS syncs, and Qboost runs
                will appear here.
              </div>
            ) : (
              tasks.map((task) => (
                <div key={task.id} className="px-4 py-3 space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-medium text-slate-900 truncate">{task.title}</span>
                    <span
                      className={`text-[10px] font-semibold uppercase ${
                        task.status === 'completed'
                          ? 'text-emerald-600'
                          : task.status === 'error'
                          ? 'text-rose-600'
                          : 'text-blue-600'
                      }`}
                    >
                      {task.status === 'running' ? `${task.progress}%` : task.status}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 truncate">{task.detail}</div>
                  <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-150 ${
                        task.status === 'completed'
                          ? 'bg-emerald-500'
                          : task.status === 'error'
                          ? 'bg-rose-500'
                          : 'bg-blue-600'
                      }`}
                      style={{ width: `${task.progress}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* === POPOVER: NOTIFICATION BOARD === */}
      {openMenu === 'notifications' && (
        <div className="fixed top-12 right-16 z-[60] w-96 bg-white text-slate-800 rounded-b shadow-2xl border border-slate-200 overflow-hidden qts-popover-in">
          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-800">Notification Board</span>
            <button
              type="button"
              onClick={() => {
                openWindow('control-panel');
                setOpenMenu(null);
              }}
              className="text-[11px] text-blue-600 hover:underline"
            >
              Open QuLog Center
            </button>
          </div>
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
            {logs.slice(0, 14).map((log) => (
              <div key={log.id} className="px-4 py-2.5 flex items-start gap-2.5 hover:bg-slate-50">
                {log.level === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : log.level === 'warning' || log.level === 'error' ? (
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                ) : (
                  <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-slate-800 leading-snug">{log.message}</div>
                  <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-between">
                    <span>
                      {log.category} · {log.user}
                    </span>
                    <span>{formatDateTime(log.timestamp)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* === POPOVER: USER & POWER MENU === */}
      {openMenu === 'user' && (
        <div className="fixed top-12 right-4 z-[60] w-56 bg-white text-slate-800 rounded-b shadow-2xl border border-slate-200 py-1.5 qts-popover-in">
          <div className="px-3.5 py-2 border-b border-slate-100">
            <div className="text-xs font-semibold text-slate-900 truncate">{user?.fullName}</div>
            <div className="text-[11px] text-slate-500 truncate">
              {user?.username} · {user?.role}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              openWindow('control-panel');
              setOpenMenu(null);
            }}
            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-slate-700 hover:bg-slate-100"
          >
            <User className="w-3.5 h-3.5 text-slate-500" />
            <span>Options & Control Panel</span>
          </button>
          <button
            type="button"
            onClick={() => handlePower('sleep')}
            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-slate-700 hover:bg-slate-100"
          >
            <Moon className="w-3.5 h-3.5 text-indigo-600" />
            <span>Sleep NAS</span>
          </button>
          <button
            type="button"
            onClick={() => handlePower('restart')}
            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-slate-700 hover:bg-slate-100"
          >
            <RotateCw className="w-3.5 h-3.5 text-amber-600" />
            <span>Restart</span>
          </button>
          <button
            type="button"
            onClick={() => handlePower('shutdown')}
            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-rose-600 hover:bg-rose-50"
          >
            <Power className="w-3.5 h-3.5" />
            <span>Shut Down</span>
          </button>
          <div className="my-1 border-t border-slate-100" />
          <button
            type="button"
            onClick={() => {
              setOpenMenu(null);
              logout();
            }}
            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-slate-700 hover:bg-slate-100"
          >
            <LogOut className="w-3.5 h-3.5 text-slate-500" />
            <span>Logout</span>
          </button>
        </div>
      )}
    </div>
  );
}
