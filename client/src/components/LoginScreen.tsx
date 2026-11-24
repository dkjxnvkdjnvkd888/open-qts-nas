import React, { useEffect, useState } from 'react';
import { Lock, User, ArrowRight, Server, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function LoginScreen() {
  const { publicInfo, login } = useAuth();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(username, password);
    } catch (err) {
      setError((err as Error).message || 'Authentication failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full h-full wallpaper-qts-wave relative flex items-center justify-center p-6 overflow-hidden">
      {/* Flowing QTS 5.x Geometric Wave Backdrop */}
      <svg
        viewBox="0 0 1440 900"
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-full pointer-events-none"
      >
        <path
          d="M0,310 C320,160 660,440 1040,290 C1220,220 1350,240 1440,260 L1440,900 L0,900 Z"
          fill="#3b82f6"
          fillOpacity="0.22"
        />
        <path
          d="M0,450 C380,320 760,580 1160,420 C1300,365 1380,385 1440,400 L1440,900 L0,900 Z"
          fill="#22d3ee"
          fillOpacity="0.16"
        />
      </svg>

      {/* Top Left Brand */}
      <div className="absolute top-6 left-7 z-10 flex items-center gap-3 text-white">
        <div className="w-9 h-9 rounded bg-[#2563eb] flex items-center justify-center shadow">
          <Server className="w-5 h-5" />
        </div>
        <div>
          <div className="text-base font-semibold tracking-tight">OpenQTS 5.2</div>
          <div className="text-[11px] text-slate-300">
            {publicInfo?.admVersion || 'DIY PC NAS Operating System'}
          </div>
        </div>
      </div>

      {/* Top Right Clock */}
      <div className="absolute top-6 right-7 z-10 text-right hidden sm:block text-white">
        <div className="text-2xl font-light tabular-nums">
          {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
        <div className="text-xs text-slate-300">
          {now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
        </div>
      </div>

      {/* Crisp Enterprise QTS Login Box */}
      <div className="relative z-10 w-full max-w-sm bg-white text-slate-800 rounded-md shadow-2xl border border-slate-200 overflow-hidden">
        <div className="h-1.5 bg-[#2563eb]" />
        <div className="p-7">
          <div className="mb-6">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              {publicInfo?.nasName || 'OPENQTS-NAS'}
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Sign in with your administrator credentials
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Username</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoFocus
                  className="w-full bg-slate-50 border border-slate-300 focus:border-blue-600 focus:bg-white rounded px-9 py-2 text-sm text-slate-900 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 focus:border-blue-600 focus:bg-white rounded px-9 py-2 text-sm text-slate-900 outline-none"
                />
              </div>
            </div>

            {error && (
              <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-[#2563eb] hover:bg-[#1d4ed8] disabled:opacity-60 text-white font-medium py-2.5 rounded text-sm flex items-center justify-center gap-2 transition-colors duration-100"
            >
              <span>{submitting ? 'Signing In...' : 'Login'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-5 pt-4 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Default: <code className="text-slate-800 font-semibold">admin / admin</code>
            </span>
            <span className="uppercase">{publicInfo?.platform || 'x86_64'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
