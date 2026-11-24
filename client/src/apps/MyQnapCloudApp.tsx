import React, { useEffect, useState, useCallback } from 'react';
import {
  Cloud,
  Globe,
  ShieldCheck,
  RefreshCw,
  Plus,
  Trash2,
  Copy,
  Check,
  Server,
  Save,
  AlertTriangle,
} from 'lucide-react';
import { api } from '../api/client';
import { useTelemetry } from '../context/TelemetryContext';
import { formatDateTime } from '../utils/format';
import type { CloudConfig } from '../types';

export function MyQnapCloudApp() {
  const { notify, startTask, updateTask } = useTelemetry();
  const [tab, setTab] = useState<'ddns' | 'proxy' | 'export'>('ddns');
  const [cloud, setCloud] = useState<CloudConfig | null>(null);
  const [caddyfile, setCaddyfile] = useState('');
  const [nginxConfig, setNginxConfig] = useState('');
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [copied, setCopied] = useState<'caddy' | 'nginx' | null>(null);

  // Add reverse proxy rule state
  const [showAddRule, setShowAddRule] = useState(false);
  const [rName, setRName] = useState('');
  const [rDomain, setRDomain] = useState('');
  const [rHost, setRHost] = useState('127.0.0.1');
  const [rPort, setRPort] = useState(8096);
  const [rHttps, setRHttps] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await api.getCloudConfig();
      setCloud(res.cloud);
      setCaddyfile(res.caddyfile);
      setNginxConfig(res.nginxConfig);
    } catch (err) {
      notify('myQNAPcloud', (err as Error).message, 'error');
    }
  }, [notify]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSaveDdns = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cloud) return;
    setSaving(true);
    try {
      const res = await api.updateCloudConfig({
        deviceName: cloud.deviceName,
        ddnsEnabled: cloud.ddnsEnabled,
        provider: cloud.provider,
        domain: cloud.domain,
        token: cloud.token,
        zoneId: cloud.zoneId,
        recordName: cloud.recordName,
        updateIntervalMinutes: cloud.updateIntervalMinutes,
      });
      setCloud(res.cloud);
      setCaddyfile(res.caddyfile);
      setNginxConfig(res.nginxConfig);
      notify('myQNAPcloud', 'DDNS settings saved successfully.', 'success');
    } catch (err) {
      notify('myQNAPcloud', (err as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    const taskId = startTask('myQNAPcloud DDNS Sync', 'Updating DNS record with WAN IP...');
    try {
      updateTask(taskId, { progress: 60 });
      const res = await api.syncDdnsNow();
      setCloud(res.cloud);
      setCaddyfile(res.caddyfile);
      setNginxConfig(res.nginxConfig);
      const ok = res.cloud.lastSyncStatus === 'ok';
      updateTask(taskId, {
        progress: 100,
        status: ok ? 'completed' : 'error',
        detail: res.cloud.lastSyncMessage,
      });
      notify(
        'DDNS Synchronization',
        res.cloud.lastSyncMessage,
        ok ? 'success' : 'warning'
      );
    } catch (err) {
      updateTask(taskId, { progress: 100, status: 'error', detail: (err as Error).message });
      notify('DDNS Sync Error', (err as Error).message, 'error');
    } finally {
      setSyncing(false);
    }
  };

  const handleAddProxy = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.addProxyRule({
        name: rName || rDomain,
        domain: rDomain,
        targetHost: rHost || '127.0.0.1',
        targetPort: Number(rPort),
        httpsEnabled: rHttps,
        websockets: true,
      });
      setCloud(res.cloud);
      setCaddyfile(res.caddyfile);
      setNginxConfig(res.nginxConfig);
      setShowAddRule(false);
      setRName('');
      setRDomain('');
      notify('Reverse Proxy', `Added route for ${rDomain}`, 'success');
    } catch (err) {
      notify('Reverse Proxy', (err as Error).message, 'error');
    }
  };

  const handleToggleRule = async (id: string, enabled: boolean) => {
    try {
      const res = await api.toggleProxyRule(id, enabled);
      setCloud(res.cloud);
      setCaddyfile(res.caddyfile);
      setNginxConfig(res.nginxConfig);
    } catch (err) {
      notify('Reverse Proxy', (err as Error).message, 'error');
    }
  };

  const handleDeleteRule = async (id: string) => {
    try {
      const res = await api.deleteProxyRule(id);
      setCloud(res.cloud);
      setCaddyfile(res.caddyfile);
      setNginxConfig(res.nginxConfig);
      notify('Reverse Proxy', 'Removed proxy rule.', 'warning');
    } catch (err) {
      notify('Reverse Proxy', (err as Error).message, 'error');
    }
  };

  const copyText = (text: string, which: 'caddy' | 'nginx') => {
    void navigator.clipboard.writeText(text);
    setCopied(which);
    setTimeout(() => setCopied(null), 1800);
  };

  return (
    <div className="flex flex-1 min-h-0 bg-white">
      {/* Left Navigation Sidebar */}
      <aside className="w-52 bg-[#f5f7fa] border-r border-slate-200 p-3 flex flex-col gap-1 shrink-0 text-xs">
        <div className="flex items-center gap-2 px-2 pb-3 mb-1 border-b border-slate-200">
          <Cloud className="w-5 h-5 text-[#2563eb]" />
          <div>
            <div className="font-semibold text-slate-900">myQNAPcloud</div>
            <div className="text-[10px] text-slate-500">DDNS & Reverse Proxy</div>
          </div>
        </div>

        {[
          { id: 'ddns', label: 'DDNS (DuckDNS / CF)', icon: Globe },
          { id: 'proxy', label: 'Reverse Proxy Rules', icon: Server },
          { id: 'export', label: 'Caddy / Nginx Config', icon: ShieldCheck },
        ].map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id as typeof tab)}
              className={`flex items-center gap-2.5 px-2.5 py-2 rounded text-left font-medium transition-colors ${
                active
                  ? 'bg-[#2563eb] text-white'
                  : 'text-slate-700 hover:bg-slate-200/70'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </button>
          );
        })}

        {cloud && (
          <div className="mt-auto p-3 rounded bg-white border border-slate-200 space-y-1">
            <div className="text-[10px] font-semibold uppercase text-slate-400">Detected IP</div>
            <div className="text-xs font-mono font-semibold text-slate-800 truncate">
              {cloud.detectedWanIp}
            </div>
            <div className="text-[10px] text-slate-500">
              {cloud.lastSyncAt ? `Synced ${formatDateTime(cloud.lastSyncAt)}` : 'Not synced yet'}
            </div>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {cloud && tab === 'ddns' && (
          <form onSubmit={handleSaveDdns} className="space-y-4 max-w-2xl">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Dynamic DNS (Remote NAS Access)
                </h2>
                <p className="text-xs text-slate-500">
                  Bind your home dynamic IP to DuckDNS or Cloudflare DNS for remote access.
                </p>
              </div>
              <button
                type="button"
                disabled={syncing}
                onClick={() => void handleSyncNow()}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded bg-[#059669] hover:bg-[#047857] disabled:opacity-60 text-white text-xs font-medium shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                <span>{syncing ? 'Syncing...' : 'Update DDNS Now'}</span>
              </button>
            </div>

            {/* Status Banner */}
            <div
              className={`rounded border px-3.5 py-2.5 text-xs flex items-center gap-2 ${
                cloud.lastSyncStatus === 'ok'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : cloud.lastSyncStatus === 'error'
                  ? 'bg-amber-50 border-amber-200 text-amber-800'
                  : 'bg-slate-50 border-slate-200 text-slate-600'
              }`}
            >
              {cloud.lastSyncStatus === 'ok' ? (
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
              )}
              <span>{cloud.lastSyncMessage}</span>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded p-4 space-y-4 text-xs">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-800">Enable Automatic DDNS</div>
                  <div className="text-[11px] text-slate-500">
                    Periodically synchronize WAN IP with your selected DNS provider
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={cloud.ddnsEnabled}
                  onChange={(e) => setCloud({ ...cloud, ddnsEnabled: e.target.checked })}
                  className="w-4 h-4 accent-blue-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">DDNS Provider</label>
                  <select
                    value={cloud.provider}
                    onChange={(e) =>
                      setCloud({
                        ...cloud,
                        provider: e.target.value as CloudConfig['provider'],
                      })
                    }
                    className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-900"
                  >
                    <option value="duckdns">DuckDNS (Free, Easy)</option>
                    <option value="cloudflare">Cloudflare DNS API (Custom Domain)</option>
                    <option value="custom">Custom Domain / Manual</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Update Interval (Minutes)
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={1440}
                    value={cloud.updateIntervalMinutes}
                    onChange={(e) =>
                      setCloud({ ...cloud, updateIntervalMinutes: Number(e.target.value) })
                    }
                    className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-900"
                  />
                </div>

                {cloud.provider === 'duckdns' ? (
                  <>
                    <div>
                      <label className="block text-slate-700 font-medium mb-1">
                        DuckDNS Subdomain
                      </label>
                      <input
                        value={cloud.domain}
                        onChange={(e) => setCloud({ ...cloud, domain: e.target.value })}
                        placeholder="my-home-nas.duckdns.org"
                        className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-medium mb-1">
                        DuckDNS API Token
                      </label>
                      <input
                        type="password"
                        value={cloud.token}
                        onChange={(e) => setCloud({ ...cloud, token: e.target.value })}
                        placeholder="Paste token from duckdns.org"
                        className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-900"
                      />
                    </div>
                  </>
                ) : cloud.provider === 'cloudflare' ? (
                  <>
                    <div>
                      <label className="block text-slate-700 font-medium mb-1">
                        Cloudflare Zone ID
                      </label>
                      <input
                        value={cloud.zoneId}
                        onChange={(e) => setCloud({ ...cloud, zoneId: e.target.value })}
                        placeholder="32-char Zone ID"
                        className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-medium mb-1">
                        DNS A Record Name
                      </label>
                      <input
                        value={cloud.recordName}
                        onChange={(e) => setCloud({ ...cloud, recordName: e.target.value })}
                        placeholder="nas.yourdomain.com"
                        className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-900"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-slate-700 font-medium mb-1">
                        Cloudflare API Token (Zone:DNS:Edit)
                      </label>
                      <input
                        type="password"
                        value={cloud.token}
                        onChange={(e) => setCloud({ ...cloud, token: e.target.value })}
                        placeholder="Paste Cloudflare scoped API token"
                        className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-900"
                      />
                    </div>
                  </>
                ) : (
                  <div className="sm:col-span-2">
                    <label className="block text-slate-700 font-medium mb-1">Custom Hostname</label>
                    <input
                      value={cloud.domain}
                      onChange={(e) => setCloud({ ...cloud, domain: e.target.value })}
                      placeholder="nas.company.com"
                      className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-900"
                    />
                  </div>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-medium"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Saving...' : 'Apply DDNS Settings'}</span>
            </button>
          </form>
        )}

        {cloud && tab === 'proxy' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Reverse Proxy Rules</h2>
                <p className="text-xs text-slate-500">
                  Route HTTPS subdomains cleanly to OpenQTS, Music Station, Jellyfin, and Docker
                  apps with automatic SSL (Caddy / Nginx).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddRule((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-medium"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Proxy Rule</span>
              </button>
            </div>

            {showAddRule && (
              <form
                onSubmit={handleAddProxy}
                className="bg-blue-50/70 border border-blue-200 rounded p-4 space-y-3 text-xs"
              >
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Service Name</label>
                    <input
                      value={rName}
                      onChange={(e) => setRName(e.target.value)}
                      placeholder="Immich Photos"
                      className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Public Domain</label>
                    <input
                      value={rDomain}
                      onChange={(e) => setRDomain(e.target.value)}
                      placeholder="photos.mynas.duckdns.org"
                      required
                      className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Target Host</label>
                    <input
                      value={rHost}
                      onChange={(e) => setRHost(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Target Port</label>
                    <input
                      type="number"
                      value={rPort}
                      onChange={(e) => setRPort(Number(e.target.value))}
                      required
                      className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-slate-700">
                    <input
                      type="checkbox"
                      checked={rHttps}
                      onChange={(e) => setRHttps(e.target.checked)}
                    />
                    <span>Enable Auto-HTTPS (Let&apos;s Encrypt TLS)</span>
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAddRule(false)}
                      className="px-3 py-1 text-slate-500"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-3.5 py-1 rounded bg-[#2563eb] text-white font-medium"
                    >
                      Add Rule
                    </button>
                  </div>
                </div>
              </form>
            )}

            <div className="border border-slate-200 rounded overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#f4f6f9] text-slate-600 border-b border-slate-200">
                    <th className="py-2.5 px-3.5 font-medium">Service</th>
                    <th className="py-2.5 px-3 font-medium">Domain</th>
                    <th className="py-2.5 px-3 font-medium">Destination</th>
                    <th className="py-2.5 px-3 font-medium w-24">SSL</th>
                    <th className="py-2.5 px-3 font-medium w-24">Enabled</th>
                    <th className="py-2.5 px-3 w-12" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cloud.proxyRules.map((rule) => (
                    <tr key={rule.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3.5 font-medium text-slate-900">{rule.name}</td>
                      <td className="py-2.5 px-3 font-mono text-blue-700">{rule.domain}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-600">
                        {rule.targetHost}:{rule.targetPort}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            rule.httpsEnabled
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {rule.httpsEnabled ? 'Auto HTTPS' : 'HTTP'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <input
                          type="checkbox"
                          checked={rule.enabled}
                          onChange={(e) => void handleToggleRule(rule.id, e.target.checked)}
                          className="accent-blue-600"
                        />
                      </td>
                      <td className="py-2.5 px-3">
                        <button
                          type="button"
                          onClick={() => void handleDeleteRule(rule.id)}
                          className="p-1 text-rose-500 hover:bg-rose-50 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'export' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Generated Reverse Proxy Configs
              </h2>
              <p className="text-xs text-slate-500">
                Ready for Caddy (auto-provisioned by <code>scripts/install-linux-nas.sh</code>) or
                Nginx.
              </p>
            </div>

            <div className="border border-slate-200 rounded overflow-hidden">
              <div className="px-3.5 py-2 bg-slate-100 border-b border-slate-200 flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700">
                  Caddyfile (/etc/caddy/Caddyfile) — Recommended Auto-SSL
                </span>
                <button
                  type="button"
                  onClick={() => copyText(caddyfile, 'caddy')}
                  className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                >
                  {copied === 'caddy' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied === 'caddy' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <pre className="p-3.5 bg-[#111827] text-emerald-300 text-xs font-mono overflow-x-auto">
                {caddyfile}
              </pre>
            </div>

            <div className="border border-slate-200 rounded overflow-hidden">
              <div className="px-3.5 py-2 bg-slate-100 border-b border-slate-200 flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700">Nginx Reverse Proxy Block</span>
                <button
                  type="button"
                  onClick={() => copyText(nginxConfig, 'nginx')}
                  className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                >
                  {copied === 'nginx' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied === 'nginx' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <pre className="p-3.5 bg-[#111827] text-sky-300 text-xs font-mono overflow-x-auto">
                {nginxConfig}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
