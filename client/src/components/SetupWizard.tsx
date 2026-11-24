import { useState } from 'react';
import { Server, Shield, Globe, CheckCircle2, ArrowRight, ArrowLeft } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

export function SetupWizard() {
  const { publicInfo, refreshPublicInfo } = useAuth();
  const [step, setStep] = useState(1);
  const [nasName, setNasName] = useState(publicInfo?.nasName || 'OPENQTS-NAS');
  const [adminPassword, setAdminPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [timezone, setTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Bangkok'
  );
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleFinish = async () => {
    setError('');
    if (adminPassword && adminPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (adminPassword && adminPassword.length < 4) {
      setError('Password must be at least 4 characters (or leave blank to keep "admin").');
      return;
    }
    setSubmitting(true);
    try {
      await api.completeSetup({
        nasName,
        adminPassword: adminPassword || undefined,
        timezone,
      });
      await refreshPublicInfo();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full h-full wallpaper-qts-wave flex items-center justify-center p-6">
      <div className="w-full max-w-2xl bg-white text-slate-800 rounded-md shadow-2xl border border-slate-200 overflow-hidden">
        <div className="h-1.5 bg-[#2563eb]" />
        <div className="px-7 py-5 bg-[#f5f7fa] border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded bg-[#2563eb] text-white flex items-center justify-center">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900">
                OpenQTS 5.2 Smart Installation Guide
              </h1>
              <p className="text-xs text-slate-500">First-Boot Appliance Configuration Wizard</p>
            </div>
          </div>
          <span className="text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded">
            Step {step} / 3
          </span>
        </div>

        {/* Step Indicator */}
        <div className="px-7 pt-5 grid grid-cols-3 gap-2 text-xs">
          {[
            { n: 1, label: '1. NAS Identity', icon: Server },
            { n: 2, label: '2. Admin Security', icon: Shield },
            { n: 3, label: '3. Region & Apply', icon: Globe },
          ].map((s) => {
            const Icon = s.icon;
            const active = step === s.n;
            const done = step > s.n;
            return (
              <div
                key={s.n}
                className={`flex items-center gap-2 px-3 py-2 rounded border ${
                  active
                    ? 'bg-blue-50 border-blue-400 text-blue-800 font-semibold'
                    : done
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                    : 'bg-slate-50 border-slate-200 text-slate-500'
                }`}
              >
                {done ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                <span>{s.label}</span>
              </div>
            );
          })}
        </div>

        {/* Body */}
        <div className="p-7 min-h-[230px]">
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Name Your DIY NAS Appliance</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  This name appears in Windows Network Neighborhood (SMB), mDNS (<code>.local</code>),
                  and the OpenQTS desktop.
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">NAS Name</label>
                <input
                  value={nasName}
                  onChange={(e) => setNasName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 focus:border-blue-600 focus:bg-white rounded px-3 py-2 text-sm outline-none"
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Set Administrator Password (<code>admin</code>)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  This password will also synchronize with Samba (SMB) shares on Debian 12. Leave
                  blank to keep the default password (<code>admin</code>).
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    New Password
                  </label>
                  <input
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Leave blank to keep default"
                    className="w-full bg-slate-50 border border-slate-300 focus:border-blue-600 focus:bg-white rounded px-3 py-2 text-sm outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm password"
                    className="w-full bg-slate-50 border border-slate-300 focus:border-blue-600 focus:bg-white rounded px-3 py-2 text-sm outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Time Zone & Summary</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Confirm your NAS time zone and initialize SMB/NFS services.
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Time Zone</label>
                <input
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-sm outline-none"
                />
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded p-3.5 text-xs space-y-1 text-slate-700">
                <div>
                  NAS Name: <strong>{nasName}</strong>
                </div>
                <div>
                  Admin Account: <strong>admin</strong>{' '}
                  ({adminPassword ? 'custom password set' : 'default password kept'})
                </div>
                <div>
                  Services Ready: <strong>SMB2/3, NFS, Docker Compose, Music &amp; QuMagie Media</strong>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded px-3 py-2">
              {error}
            </div>
          )}
        </div>

        {/* Footer Buttons */}
        <div className="px-7 py-4 bg-[#f5f7fa] border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            disabled={step === 1}
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 text-xs font-medium text-slate-700"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </button>

          {step < 3 ? (
            <button
              type="button"
              onClick={() => setStep((s) => Math.min(3, s + 1))}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-medium"
            >
              <span>Next</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              disabled={submitting}
              onClick={() => void handleFinish()}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded bg-[#059669] hover:bg-[#047857] disabled:opacity-60 text-white text-xs font-semibold"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{submitting ? 'Initializing...' : 'Apply & Launch OpenQTS'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
