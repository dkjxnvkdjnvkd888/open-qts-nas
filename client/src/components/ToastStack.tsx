import { X } from 'lucide-react';
import { useTelemetry } from '../context/TelemetryContext';

export function ToastStack() {
  const { toasts, dismissToast } = useTelemetry();
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-24 right-5 z-[90] flex flex-col gap-2 w-80 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto bg-[#151924]/95 text-slate-100 border border-white/15 rounded shadow-xl px-3.5 py-2.5 flex items-start gap-2.5 qts-popover-in"
        >
          <span
            className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
              t.tone === 'success'
                ? 'bg-emerald-400'
                : t.tone === 'warning'
                ? 'bg-amber-400'
                : t.tone === 'error'
                ? 'bg-rose-500'
                : 'bg-sky-400'
            }`}
          />
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-white">{t.title}</div>
            <div className="text-[11px] text-slate-300 mt-0.5 leading-snug">{t.message}</div>
            <div className="text-[10px] text-slate-500 mt-1 tabular-nums">{t.timestamp}</div>
          </div>
          <button
            type="button"
            onClick={() => dismissToast(t.id)}
            className="text-slate-400 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
