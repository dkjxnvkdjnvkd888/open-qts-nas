import { useEffect, useState, useCallback } from 'react';
import {
  Search,
  Download,
  Play,
  Square,
  Trash2,
  ExternalLink,
  Star,
  Box,
  FileCode2,
  X,
} from 'lucide-react';
import { api } from '../api/client';
import { useTelemetry } from '../context/TelemetryContext';
import type { AppCatalogEntry } from '../types';

const CATEGORIES = [
  'All Apps',
  'My Apps',
  'Media',
  'Backup & Sync',
  'Productivity',
  'Downloads',
  'Smart Home',
  'Networking',
  'System',
] as const;

export function AppCenterApp() {
  const { notify, startTask, updateTask } = useTelemetry();
  const [apps, setApps] = useState<AppCatalogEntry[]>([]);
  const [dockerAvailable, setDockerAvailable] = useState(false);
  const [category, setCategory] = useState<string>('All Apps');
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [yamlModal, setYamlModal] = useState<AppCatalogEntry | null>(null);

  const loadApps = useCallback(async () => {
    try {
      const res = await api.getApps();
      setApps(res.apps);
      setDockerAvailable(res.dockerAvailable);
    } catch (err) {
      notify('App Center', (err as Error).message, 'error');
    }
  }, [notify]);

  useEffect(() => {
    void loadApps();
  }, [loadApps]);

  const handleInstall = async (app: AppCatalogEntry) => {
    setBusyId(app.id);
    const taskId = startTask(`Installing ${app.name}`, `Pulling ${app.dockerImage}...`);
    try {
      updateTask(taskId, { progress: 55 });
      await api.installApp(app.id);
      updateTask(taskId, {
        progress: 100,
        status: 'completed',
        detail: `${app.name} ready on port ${app.defaultPort}`,
      });
      notify('App Center', `Installed ${app.name} on port ${app.defaultPort}`, 'success');
      await loadApps();
    } catch (err) {
      updateTask(taskId, { progress: 100, status: 'error', detail: (err as Error).message });
      notify('Install Failed', (err as Error).message, 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleToggle = async (app: AppCatalogEntry, action: 'start' | 'stop') => {
    setBusyId(app.id);
    const taskId = startTask(
      `${action === 'start' ? 'Starting' : 'Stopping'} ${app.name}`,
      `Container port :${app.port}`
    );
    try {
      if (action === 'start') await api.startApp(app.id);
      else await api.stopApp(app.id);
      updateTask(taskId, {
        progress: 100,
        status: 'completed',
        detail: `${app.name} is now ${action === 'start' ? 'running' : 'stopped'}`,
      });
      notify('App Center', `${action === 'start' ? 'Started' : 'Stopped'} ${app.name}`, 'info');
      await loadApps();
    } catch (err) {
      updateTask(taskId, { progress: 100, status: 'error', detail: (err as Error).message });
      notify('App Center', (err as Error).message, 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleUninstall = async (app: AppCatalogEntry) => {
    if (!window.confirm(`Uninstall ${app.name}?`)) return;
    setBusyId(app.id);
    const taskId = startTask(`Removing ${app.name}`, 'Cleaning container & registration...');
    try {
      await api.uninstallApp(app.id);
      updateTask(taskId, { progress: 100, status: 'completed', detail: `Uninstalled ${app.name}` });
      notify('App Center', `Uninstalled ${app.name}`, 'warning');
      await loadApps();
    } catch (err) {
      updateTask(taskId, { progress: 100, status: 'error', detail: (err as Error).message });
      notify('Uninstall Failed', (err as Error).message, 'error');
    } finally {
      setBusyId(null);
    }
  };

  const filtered = apps.filter((a) => {
    if (category === 'My Apps' && !a.installed) return false;
    if (category !== 'All Apps' && category !== 'My Apps' && a.category !== category) {
      return false;
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        a.name.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const installedCount = apps.filter((a) => a.installed).length;

  return (
    <div className="flex flex-1 min-h-0 bg-white">
      <aside className="w-48 bg-[#f5f7fa] border-r border-slate-200 p-3 flex flex-col gap-0.5 shrink-0 text-xs overflow-y-auto">
        <div className="px-2 pb-2.5 mb-1 border-b border-slate-200 font-semibold text-slate-800">
          App Center
        </div>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategory(cat)}
            className={`flex items-center justify-between px-2.5 py-2 rounded text-left font-medium transition-colors ${
              category === cat ? 'bg-[#e11d48] text-white' : 'text-slate-700 hover:bg-slate-200/70'
            }`}
          >
            <span>{cat}</span>
            {cat === 'My Apps' && (
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded ${
                  category === cat ? 'bg-white/25 text-white' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {installedCount}
              </span>
            )}
          </button>
        ))}

        <div className="mt-auto pt-3 border-t border-slate-200">
          <div className="rounded bg-white border border-slate-200 p-2.5 text-[11px] text-slate-600">
            <div className="flex items-center gap-1.5 font-semibold text-slate-800">
              <Box className="w-3.5 h-3.5 text-blue-600" />
              <span>Container Station</span>
            </div>
            <div className="mt-1 leading-snug">
              {dockerAvailable
                ? 'Docker active — installs launch live containers.'
                : 'Sandbox mode — install Docker for live containers.'}
            </div>
          </div>
        </div>
      </aside>

      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{category}</h2>
            <p className="text-xs text-slate-500">
              Deploy containerized NAS apps pre-mounted to /DataVol1
            </p>
          </div>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search App Center..."
              className="w-56 bg-slate-50 border border-slate-300 rounded pl-8 pr-3 py-1.5 text-xs text-slate-800 outline-none focus:border-rose-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {filtered.map((app) => {
            const busy = busyId === app.id;
            return (
              <div
                key={app.id}
                className="bg-white border border-slate-200 hover:border-slate-300 rounded p-4 flex flex-col justify-between gap-3"
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-11 h-11 rounded-lg bg-gradient-to-br ${app.iconBg} flex items-center justify-center text-white font-bold text-xs shrink-0`}
                  >
                    {app.iconLabel}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-slate-900 truncate">{app.name}</h3>
                      {app.installed && (
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-semibold shrink-0 ${
                            app.status === 'running'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {app.status === 'running' ? 'Running' : 'Stopped'}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                      <span>{app.developer}</span>
                      <span>·</span>
                      <span>v{app.version}</span>
                      <span>·</span>
                      <span className="inline-flex items-center gap-0.5 text-amber-500">
                        <Star className="w-3 h-3 fill-amber-400" />
                        {app.rating}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1.5 leading-relaxed line-clamp-2">
                      {app.description}
                    </p>
                  </div>
                </div>

                <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-400 font-mono">
                    Port :{app.port} · {app.downloads}
                  </span>

                  <div className="flex items-center gap-1.5">
                    {app.composeYaml && (
                      <button
                        type="button"
                        onClick={() => setYamlModal(app)}
                        title="View docker-compose.yml"
                        className="p-1.5 rounded border border-slate-200 hover:bg-slate-50 text-slate-600"
                      >
                        <FileCode2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {!app.installed ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleInstall(app)}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded bg-[#2563eb] hover:bg-[#1d4ed8] disabled:opacity-50 text-white text-xs font-medium"
                      >
                        <Download className="w-3 h-3" />
                        <span>{busy ? 'Installing...' : 'Install'}</span>
                      </button>
                    ) : (
                      <>
                        {app.status === 'running' ? (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                notify(
                                  app.name,
                                  app.mode === 'docker'
                                    ? `Running at http://${window.location.hostname}:${app.port}`
                                    : `${app.name} is active in sandbox mode on port ${app.port}.`,
                                  'info'
                                )
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-medium"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span>Open</span>
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void handleToggle(app, 'stop')}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs"
                            >
                              <Square className="w-3 h-3 text-amber-600" />
                              <span>Stop</span>
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void handleToggle(app, 'start')}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium"
                          >
                            <Play className="w-3 h-3" />
                            <span>Start</span>
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void handleUninstall(app)}
                          className="p-1 text-rose-500 hover:bg-rose-50 rounded"
                          title="Uninstall"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {yamlModal && (
        <div className="fixed inset-0 z-[80] bg-black/50 flex items-center justify-center p-6">
          <div className="bg-white border border-slate-300 rounded shadow-2xl max-w-xl w-full overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-800">
                {yamlModal.name} — docker-compose.yml
              </span>
              <button
                type="button"
                onClick={() => setYamlModal(null)}
                className="text-slate-500 hover:text-slate-900"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <pre className="p-4 bg-[#111827] text-emerald-300 text-xs font-mono overflow-x-auto">
              {yamlModal.composeYaml}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
