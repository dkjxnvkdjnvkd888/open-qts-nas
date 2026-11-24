import { useState } from 'react';
import { Rocket, Cpu, MemoryStick, Thermometer, X, CheckCircle2 } from 'lucide-react';
import { useTelemetry } from '../context/TelemetryContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { formatBytes } from '../utils/format';

export function QboostWidget() {
  const { latest, notify, startTask, updateTask, refreshLogs } = useTelemetry();
  const { settings } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [lastFreedMb, setLastFreedMb] = useState<number | null>(null);

  if (settings && !settings.showDesktopWidgets) return null;

  const ramPct = Math.round(latest?.memoryPercent ?? 0);
  const cpuPct = Math.round(latest?.cpuPercent ?? 0);

  // SVG circular gauge geometry
  const radius = 29;
  const circumference = 2 * Math.PI * radius;
  const ramOffset = circumference - (Math.min(100, ramPct) / 100) * circumference;

  const ringColor =
    ramPct >= 85 ? '#ef4444' : ramPct >= 65 ? '#f59e0b' : '#38bdf8';

  const handleClearCache = async () => {
    if (cleaning) return;
    setCleaning(true);
    const taskId = startTask('Qboost Memory Optimization', 'Flushing system pagecache & heap...');
    try {
      updateTask(taskId, { progress: 55 });
      const res = await api.runQboost();
      setLastFreedMb(res.freedMb);
      updateTask(taskId, {
        progress: 100,
        status: 'completed',
        detail: `Reclaimed ${res.freedMb} MB (${res.method})`,
      });
      notify(
        'Qboost Complete',
        `Cleared ${res.freedMb} MB cache (${res.method}).`,
        'success'
      );
      void refreshLogs();
    } catch (err) {
      updateTask(taskId, {
        progress: 100,
        status: 'error',
        detail: (err as Error).message,
      });
      notify('Qboost Error', (err as Error).message, 'error');
    } finally {
      setCleaning(false);
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-30 flex flex-col items-end gap-2">
      {/* Expanded Qboost Control Card */}
      {expanded && (
        <div className="w-72 bg-white text-slate-800 rounded shadow-2xl border border-slate-200 overflow-hidden qts-popover-in">
          <div className="px-3.5 py-2.5 bg-[#161c33] text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Rocket className="w-4 h-4 text-sky-400" />
              <span className="text-xs font-semibold tracking-wide">Qboost Optimizer</span>
            </div>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="p-3.5 space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-slate-50 border border-slate-200 rounded p-2.5">
                <div className="flex items-center gap-1 text-[11px] text-slate-500">
                  <MemoryStick className="w-3.5 h-3.5 text-blue-600" />
                  <span>RAM Usage</span>
                </div>
                <div className="text-base font-bold text-slate-900 mt-0.5 tabular-nums">
                  {ramPct}%
                </div>
                {latest && (
                  <div className="text-[10px] text-slate-400 tabular-nums">
                    {formatBytes(latest.memoryUsedBytes)} / {formatBytes(latest.memoryTotalBytes)}
                  </div>
                )}
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded p-2.5">
                <div className="flex items-center gap-1 text-[11px] text-slate-500">
                  <Cpu className="w-3.5 h-3.5 text-emerald-600" />
                  <span>CPU Load</span>
                </div>
                <div className="text-base font-bold text-slate-900 mt-0.5 tabular-nums">
                  {cpuPct}%
                </div>
                <div className="text-[10px] text-slate-400 flex items-center gap-1 tabular-nums">
                  <Thermometer className="w-3 h-3 text-amber-500" />
                  {latest ? `${latest.temperatureC}°C` : '--'}
                </div>
              </div>
            </div>

            {lastFreedMb !== null && (
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2.5 py-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>Last sweep reclaimed {lastFreedMb} MB</span>
              </div>
            )}

            <button
              type="button"
              disabled={cleaning}
              onClick={() => void handleClearCache()}
              className="w-full py-2 rounded bg-[#2563eb] hover:bg-[#1d4ed8] disabled:opacity-60 text-white font-medium text-xs flex items-center justify-center gap-1.5 transition-colors duration-100"
            >
              <Rocket className="w-3.5 h-3.5" />
              <span>{cleaning ? 'Optimizing Memory...' : 'Clear Cache & Optimize RAM'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Floating Circular Qboost Medallion */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        title="Qboost — Click to inspect & clear RAM cache"
        className="relative w-[72px] h-[72px] rounded-full bg-[#151a2e]/95 border border-white/20 shadow-xl flex items-center justify-center hover:border-sky-400/70 transition-colors duration-100"
      >
        <svg className="w-[68px] h-[68px] -rotate-90" viewBox="0 0 68 68">
          <circle
            cx="34"
            cy="34"
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.14)"
            strokeWidth="4.5"
          />
          <circle
            cx="34"
            cy="34"
            r={radius}
            fill="none"
            stroke={ringColor}
            strokeWidth="4.5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={ramOffset}
            className="transition-all duration-300"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white leading-none">
          <span className="text-[13px] font-bold tabular-nums">{ramPct}%</span>
          <span className="text-[9px] text-slate-300 mt-0.5 tabular-nums">CPU {cpuPct}%</span>
          <span className="text-[8px] uppercase tracking-wider text-sky-400 font-semibold mt-0.5">
            Qboost
          </span>
        </div>
      </button>
    </div>
  );
}
