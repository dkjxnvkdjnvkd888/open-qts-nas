import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Settings,
  Server,
  HardDrive,
  Users,
  FolderLock,
  Network,
  Terminal,
  FileText,
  Palette,
  Gauge,
  Cloud,
  ArrowLeft,
  Plus,
  Trash2,
  Check,
  Save,
  Shield,
  Music,
  Film,
  RefreshCw,
  Download,
  Upload,
  Cpu,
  Wand2,
} from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useTelemetry } from '../context/TelemetryContext';
import { useWindowManager } from '../context/WindowManagerContext';
import { formatBytes, formatUptime, formatDateTime } from '../utils/format';
import type {
  SystemInfo,
  UserProfile,
  SharedFolder,
  NasServiceState,
  NetworkConfig,
  FirmwareState,
} from '../types';

type SectionView =
  | 'home'
  | 'general'
  | 'appearance'
  | 'network'
  | 'users'
  | 'shares'
  | 'services'
  | 'backup'
  | 'firmware'
  | 'logs'
  | 'linux';

const WALLPAPERS = [
  { id: 'qts-wave', name: 'QTS 5.x Wave (Default)', cls: 'wallpaper-qts-wave' },
  { id: 'qts-ocean', name: 'Deep Ocean Blue', cls: 'wallpaper-qts-ocean' },
  { id: 'qts-graphite', name: 'Enterprise Graphite', cls: 'wallpaper-qts-graphite' },
  { id: 'qts-nordic', name: 'Nordic Teal', cls: 'wallpaper-qts-nordic' },
  { id: 'qts-purple', name: 'QuTScloud Violet', cls: 'wallpaper-qts-purple' },
];

export function ControlPanelApp() {
  const { settings, updateSettings, refreshPublicInfo } = useAuth();
  const { logs, refreshLogs, notify, startTask, updateTask } = useTelemetry();
  const { openWindow } = useWindowManager();

  const [section, setSection] = useState<SectionView>('home');
  const [sysInfo, setSysInfo] = useState<SystemInfo | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [shares, setShares] = useState<SharedFolder[]>([]);
  const [services, setServices] = useState<NasServiceState[]>([]);

  // Network, Samba & Firmware state
  const [netCfg, setNetCfg] = useState<NetworkConfig | null>(null);
  const [smbPreview, setSmbPreview] = useState('');
  const [nfsPreview, setNfsPreview] = useState('');
  const [firmware, setFirmware] = useState<FirmwareState | null>(null);

  // General form
  const [nasName, setNasName] = useState(settings?.nasName || 'OPENQTS-NAS');
  const [timezone, setTimezone] = useState(settings?.timezone || 'UTC');
  const [autoSleep, setAutoSleep] = useState(settings?.autoSleepMinutes ?? 30);

  // Add user / share forms
  const [showAddUser, setShowAddUser] = useState(false);
  const [uName, setUName] = useState('');
  const [uPass, setUPass] = useState('');
  const [uRole, setURole] = useState<'user' | 'admin'>('user');

  const [showAddShare, setShowAddShare] = useState(false);
  const [sName, setSName] = useState('');
  const [sDesc, setSDesc] = useState('');

  const restoreInputRef = useRef<HTMLInputElement>(null);

  const loadAll = useCallback(async () => {
    try {
      const [infoRes, uRes, shRes, svRes, netRes, fwRes] = await Promise.all([
        api.getSystemInfo(),
        api.getUsers(),
        api.getShares(),
        api.getServices(),
        api.getNetworkConfig(),
        api.getFirmware(),
      ]);
      setSysInfo(infoRes);
      setUsers(uRes.users);
      setShares(shRes.shares);
      setServices(svRes.services);
      setNetCfg(netRes.network);
      setSmbPreview(netRes.smbConfig);
      setNfsPreview(netRes.nfsExports);
      setFirmware(fwRes.firmware);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void loadAll();
    void refreshLogs();
  }, [loadAll, refreshLogs]);

  useEffect(() => {
    if (!settings) return;
    setNasName(settings.nasName);
    setTimezone(settings.timezone);
    setAutoSleep(settings.autoSleepMinutes);
  }, [settings]);

  const saveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateSettings({ nasName, timezone, autoSleepMinutes: autoSleep });
      notify('Control Panel', 'General system settings saved.', 'success');
    } catch (err) {
      notify('Control Panel', (err as Error).message, 'error');
    }
  };

  const saveNetwork = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!netCfg) return;
    try {
      const res = await api.updateNetworkConfig(netCfg);
      setNetCfg(res.network);
      notify(
        'Network & Virtual Switch',
        res.appliedToOs
          ? `Applied ${res.network.mode.toUpperCase()} config to Linux systemd-networkd.`
          : `Saved network profile (${res.network.interfaceName}: ${res.network.mode.toUpperCase()}).`,
        'success'
      );
    } catch (err) {
      notify('Network Settings', (err as Error).message, 'error');
    }
  };

  const handleRestoreFile = async (files: FileList | null) => {
    if (!files || !files[0]) return;
    try {
      const raw = await files[0].text();
      const parsed = JSON.parse(raw);
      await api.restoreBackup(parsed);
      notify('Backup & Restore', 'Configuration backup restored successfully.', 'success');
      void loadAll();
    } catch (err) {
      notify('Restore Failed', (err as Error).message, 'error');
    } finally {
      if (restoreInputRef.current) restoreInputRef.current.value = '';
    }
  };

  const handleCheckFirmware = async () => {
    const taskId = startTask('Checking Firmware OTA', 'Contacting OpenQTS stable channel...');
    try {
      const res = await api.checkFirmware();
      setFirmware(res.firmware);
      updateTask(taskId, {
        progress: 100,
        status: 'completed',
        detail: `OpenQTS v${res.firmware.currentVersion} is up to date`,
      });
      notify('Firmware Update', `OpenQTS v${res.firmware.currentVersion} is up to date.`, 'success');
    } catch (err) {
      updateTask(taskId, { progress: 100, status: 'error', detail: (err as Error).message });
      notify('Firmware Update', (err as Error).message, 'error');
    }
  };

  const handleApplyFirmware = async () => {
    const taskId = startTask('OTA System Update', 'Verifying Debian 12 & OpenQTS packages...');
    try {
      updateTask(taskId, { progress: 60 });
      const res = await api.applyFirmwareUpdate();
      updateTask(taskId, { progress: 100, status: 'completed', detail: res.message });
      notify('Firmware Update', res.message, 'success');
    } catch (err) {
      updateTask(taskId, { progress: 100, status: 'error', detail: (err as Error).message });
      notify('Firmware Update', (err as Error).message, 'error');
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createUser({
        username: uName,
        fullName: uName,
        email: `${uName}@openqts.local`,
        password: uPass,
        role: uRole,
      });
      setUName('');
      setUPass('');
      setShowAddUser(false);
      notify('Privilege', `Created local user "${uName}" (+SMB sync)`, 'success');
      void loadAll();
    } catch (err) {
      notify('Create User', (err as Error).message, 'error');
    }
  };

  const handleAddShare = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createShare({
        name: sName,
        description: sDesc || 'SMB/NFS Shared Folder',
        volume: 'DataVol1',
        smbEnabled: true,
        nfsEnabled: false,
        recycleBin: true,
      });
      setSName('');
      setSDesc('');
      setShowAddShare(false);
      notify('Shared Folders', `Created "${sName}" (+SMB/NFS sync)`, 'success');
      void loadAll();
    } catch (err) {
      notify('Create Share', (err as Error).message, 'error');
    }
  };

  const toggleService = async (svc: NasServiceState) => {
    try {
      const updated = await api.updateService(svc.id, { enabled: !svc.enabled });
      setServices((prev) => prev.map((s) => (s.id === svc.id ? updated : s)));
      notify('Network Services', `${updated.name}: ${updated.status}`, 'info');
      void loadAll();
    } catch (err) {
      notify('Services', (err as Error).message, 'error');
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-white">
      {/* ControlPanel Header */}
      <div className="h-11 px-4 border-b border-slate-200 bg-white flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          {section !== 'home' && (
            <button
              type="button"
              onClick={() => setSection('home')}
              className="p-1 rounded hover:bg-slate-100 text-slate-600"
              title="Back to Control Panel"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <Settings className="w-5 h-5 text-slate-700" />
          <span className="text-[15px] font-semibold text-slate-800">
            Control<span className="font-normal text-slate-500">Panel</span>
          </span>
          {section !== 'home' && (
            <span className="text-xs text-slate-400">/ {section.toUpperCase()}</span>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        {section === 'home' ? (
          <div>
            {/* Hardware Summary Bar */}
            <div className="bg-[#f3f6fa] border-b border-slate-200 px-8 py-4 flex flex-wrap items-center gap-8 text-xs">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded bg-white border border-slate-300 flex items-center justify-center text-slate-700">
                  <Server className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-base font-semibold text-slate-800">
                    {sysInfo?.nasName || 'OpenQTS'}
                  </div>
                  <div className="text-[11px] text-slate-500">Debian 12 DIY PC NAS OS</div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-1 text-slate-600">
                <div>
                  Firmware:{' '}
                  <strong className="text-slate-800">
                    {firmware?.currentVersion || '5.2.1'}
                  </strong>
                </div>
                <div>
                  CPU:{' '}
                  <strong className="text-slate-800">
                    {sysInfo ? `${sysInfo.cpuModel} (${sysInfo.cpuCores}T)` : 'Detecting...'}
                  </strong>
                </div>
                <div>
                  Memory:{' '}
                  <strong className="text-slate-800">
                    {sysInfo ? formatBytes(sysInfo.totalMemoryBytes) : '--'}
                  </strong>
                </div>
                <div>
                  Uptime:{' '}
                  <strong className="text-slate-800">
                    {sysInfo ? formatUptime(sysInfo.uptimeSeconds) : '--'}
                  </strong>
                </div>
              </div>
            </div>

            {/* 4 QTS Categorized Control Panel Rows */}
            <div className="px-8 py-5 divide-y divide-slate-200 max-w-5xl">
              {/* Row 1: System */}
              <div className="py-5 grid grid-cols-1 md:grid-cols-4 gap-5">
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                    <Settings className="w-4 h-4 text-slate-500" />
                    <span>System</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    Configure NAS settings, storage, OTA firmware, config backup, and logs.
                  </p>
                </div>
                <div className="md:col-span-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { label: 'General Settings', icon: Settings, color: 'text-blue-600', onClick: () => setSection('general') },
                    { label: 'Storage & Snapshots', icon: HardDrive, color: 'text-sky-600', onClick: () => openWindow('storage-snapshots') },
                    { label: 'Firmware Update (OTA)', icon: Cpu, color: 'text-emerald-600', onClick: () => setSection('firmware') },
                    { label: 'Backup / Restore Config', icon: Download, color: 'text-indigo-600', onClick: () => setSection('backup') },
                    { label: 'Desktop & Wallpaper', icon: Palette, color: 'text-violet-600', onClick: () => setSection('appearance') },
                    { label: 'QuLog Center (Logs)', icon: FileText, color: 'text-amber-600', onClick: () => setSection('logs') },
                    { label: 'Resource Monitor', icon: Gauge, color: 'text-teal-600', onClick: () => openWindow('resource-monitor') },
                    { label: 'Debian ISO & Deploy', icon: Terminal, color: 'text-slate-700', onClick: () => setSection('linux') },
                    {
                      label: 'First-Boot Wizard',
                      icon: Wand2,
                      color: 'text-pink-600',
                      onClick: async () => {
                        if (window.confirm('Launch OpenQTS First-Boot Setup Wizard now?')) {
                          await api.resetSetupWizard();
                          await refreshPublicInfo();
                        }
                      },
                    },
                  ].map((tile) => {
                    const Icon = tile.icon;
                    return (
                      <button
                        key={tile.label}
                        type="button"
                        onClick={tile.onClick}
                        className="flex items-center gap-2.5 px-3 py-2.5 rounded hover:bg-slate-100 text-left text-xs text-slate-700 font-medium transition-colors"
                      >
                        <Icon className={`w-4 h-4 ${tile.color} shrink-0`} />
                        <span className="truncate">{tile.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Row 2: Privilege */}
              <div className="py-5 grid grid-cols-1 md:grid-cols-4 gap-5">
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                    <Users className="w-4 h-4 text-slate-500" />
                    <span>Privilege</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    Users and Shared Folders automatically sync to Linux Samba &amp; NFS.
                  </p>
                </div>
                <div className="md:col-span-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setSection('users')}
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded hover:bg-slate-100 text-left text-xs text-slate-700 font-medium"
                  >
                    <Users className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>Users ({users.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSection('shares')}
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded hover:bg-slate-100 text-left text-xs text-slate-700 font-medium"
                  >
                    <FolderLock className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Shared Folders ({shares.length})</span>
                  </button>
                </div>
              </div>

              {/* Row 3: Network & File Services */}
              <div className="py-5 grid grid-cols-1 md:grid-cols-4 gap-5">
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                    <Network className="w-4 h-4 text-slate-500" />
                    <span>Network &amp; File Services</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    Static IP / DHCP interfaces, SMB/NFS configs, and myQNAPcloud DDNS.
                  </p>
                </div>
                <div className="md:col-span-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setSection('network')}
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded hover:bg-slate-100 text-left text-xs text-slate-700 font-medium"
                  >
                    <Network className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>Network &amp; Virtual Switch</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSection('services')}
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded hover:bg-slate-100 text-left text-xs text-slate-700 font-medium"
                  >
                    <HardDrive className="w-4 h-4 text-sky-600 shrink-0" />
                    <span>Win/Mac/NFS/SMB Config</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openWindow('myqnapcloud')}
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded hover:bg-slate-100 text-left text-xs text-slate-700 font-medium"
                  >
                    <Cloud className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span>myQNAPcloud &amp; DDNS</span>
                  </button>
                </div>
              </div>

              {/* Row 4: Applications */}
              <div className="py-5 grid grid-cols-1 md:grid-cols-4 gap-5">
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                    <Music className="w-4 h-4 text-slate-500" />
                    <span>Applications</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    Multimedia streaming and Docker Compose services.
                  </p>
                </div>
                <div className="md:col-span-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => openWindow('music-station')}
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded hover:bg-slate-100 text-left text-xs text-slate-700 font-medium"
                  >
                    <Music className="w-4 h-4 text-purple-600 shrink-0" />
                    <span>Music Station 5</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openWindow('photo-video')}
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded hover:bg-slate-100 text-left text-xs text-slate-700 font-medium"
                  >
                    <Film className="w-4 h-4 text-pink-600 shrink-0" />
                    <span>QuMagie Photo &amp; Video</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openWindow('app-center')}
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded hover:bg-slate-100 text-left text-xs text-slate-700 font-medium"
                  >
                    <Server className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>App Center (Docker)</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : section === 'network' && netCfg ? (
          <form onSubmit={saveNetwork} className="p-6 max-w-2xl space-y-4 text-xs">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Network &amp; Virtual Switch</h3>
              <p className="text-slate-500">
                Configure hostname and DHCP / Static IP (applied via <code>systemd-networkd</code>{' '}
                on Debian 12 ISO).
              </p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded p-4 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block font-medium text-slate-700 mb-1">System Hostname</label>
                <input
                  value={netCfg.hostname}
                  onChange={(e) => setNetCfg({ ...netCfg, hostname: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Network Interface</label>
                <input
                  value={netCfg.interfaceName}
                  onChange={(e) => setNetCfg({ ...netCfg, interfaceName: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">IPv4 Mode</label>
                <select
                  value={netCfg.mode}
                  onChange={(e) =>
                    setNetCfg({ ...netCfg, mode: e.target.value as 'dhcp' | 'static' })
                  }
                  className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5"
                >
                  <option value="dhcp">Obtain IP automatically (DHCP)</option>
                  <option value="static">Use Static IP Address</option>
                </select>
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">IP Address</label>
                <input
                  disabled={netCfg.mode === 'dhcp'}
                  value={netCfg.ipAddress}
                  onChange={(e) => setNetCfg({ ...netCfg, ipAddress: e.target.value })}
                  className="w-full bg-white disabled:bg-slate-100 border border-slate-300 rounded px-2.5 py-1.5 font-mono"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Subnet Mask</label>
                <input
                  disabled={netCfg.mode === 'dhcp'}
                  value={netCfg.netmask}
                  onChange={(e) => setNetCfg({ ...netCfg, netmask: e.target.value })}
                  className="w-full bg-white disabled:bg-slate-100 border border-slate-300 rounded px-2.5 py-1.5 font-mono"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Default Gateway</label>
                <input
                  disabled={netCfg.mode === 'dhcp'}
                  value={netCfg.gateway}
                  onChange={(e) => setNetCfg({ ...netCfg, gateway: e.target.value })}
                  className="w-full bg-white disabled:bg-slate-100 border border-slate-300 rounded px-2.5 py-1.5 font-mono"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Primary DNS</label>
                <input
                  value={netCfg.dnsPrimary}
                  onChange={(e) => setNetCfg({ ...netCfg, dnsPrimary: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-mono"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Secondary DNS</label>
                <input
                  value={netCfg.dnsSecondary}
                  onChange={(e) => setNetCfg({ ...netCfg, dnsSecondary: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-mono"
                />
              </div>
            </div>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-[#2563eb] text-white font-medium"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Apply Network Configuration</span>
            </button>
          </form>
        ) : section === 'backup' ? (
          <div className="p-6 max-w-2xl space-y-4 text-xs">
            <h3 className="text-base font-semibold text-slate-900">
              System Configuration Backup &amp; Restore
            </h3>
            <p className="text-slate-600">
              Export your NAS settings, shared folders, network configuration, and reverse proxy
              rules into a portable <code>.json</code> file, or restore a previous backup.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="border border-slate-200 rounded p-4 space-y-3 bg-slate-50">
                <div className="font-semibold text-slate-900">Export Settings Backup</div>
                <p className="text-slate-500">Download <code>openqts-config-backup.json</code></p>
                <a
                  href={api.getBackupUrl()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded bg-[#2563eb] text-white font-medium"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Backup Now</span>
                </a>
              </div>
              <div className="border border-slate-200 rounded p-4 space-y-3 bg-slate-50">
                <div className="font-semibold text-slate-900">Restore Settings from File</div>
                <p className="text-slate-500">Upload a previously exported backup JSON.</p>
                <input
                  ref={restoreInputRef}
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={(e) => void handleRestoreFile(e.target.files)}
                />
                <button
                  type="button"
                  onClick={() => restoreInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Restore Backup</span>
                </button>
              </div>
            </div>
          </div>
        ) : section === 'firmware' && firmware ? (
          <div className="p-6 max-w-2xl space-y-4 text-xs">
            <h3 className="text-base font-semibold text-slate-900">
              Firmware &amp; OS Update Center (OTA)
            </h3>
            <div className="border border-slate-200 rounded p-4 bg-slate-50 space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Current Firmware</span>
                <strong className="text-slate-900 font-mono">OpenQTS {firmware.currentVersion}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Base OS</span>
                <strong className="text-slate-900">{firmware.baseOs}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Release Channel</span>
                <strong className="text-blue-700 uppercase">{firmware.buildChannel}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Last Checked</span>
                <span className="text-slate-700">
                  {firmware.lastCheckedAt ? formatDateTime(firmware.lastCheckedAt) : 'Never'}
                </span>
              </div>
              <div className="pt-2 border-t border-slate-200 text-slate-600">
                {firmware.releaseNotes}
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => void handleCheckFirmware()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-medium"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Check for Update</span>
              </button>
              <button
                type="button"
                onClick={() => void handleApplyFirmware()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-medium"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Run Security &amp; OTA Update</span>
              </button>
            </div>
          </div>
        ) : section === 'general' ? (
          <form onSubmit={saveGeneral} className="p-6 max-w-lg space-y-4 text-xs">
            <h3 className="text-base font-semibold text-slate-900">General Settings</h3>
            <div className="space-y-3 bg-slate-50 border border-slate-200 rounded p-4">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Server Name</label>
                <input
                  value={nasName}
                  onChange={(e) => setNasName(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded px-3 py-1.5"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Time Zone</label>
                <input
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded px-3 py-1.5"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Disk Standby Timeout (minutes)
                </label>
                <input
                  type="number"
                  min={0}
                  max={240}
                  value={autoSleep}
                  onChange={(e) => setAutoSleep(Number(e.target.value))}
                  className="w-full bg-white border border-slate-300 rounded px-3 py-1.5"
                />
              </div>
            </div>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-[#2563eb] text-white font-medium"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Apply</span>
            </button>
          </form>
        ) : section === 'appearance' ? (
          <div className="p-6 space-y-4">
            <h3 className="text-base font-semibold text-slate-900">Desktop Wallpaper & Qboost</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 max-w-3xl">
              {WALLPAPERS.map((wp) => {
                const active = (settings?.wallpaper || 'qts-wave') === wp.id;
                return (
                  <button
                    key={wp.id}
                    type="button"
                    onClick={() => void updateSettings({ wallpaper: wp.id })}
                    className={`rounded overflow-hidden border text-left ${
                      active ? 'border-blue-600 ring-2 ring-blue-500/30' : 'border-slate-300'
                    }`}
                  >
                    <div className={`h-20 ${wp.cls} relative`}>
                      {active && (
                        <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center">
                          <Check className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                    <div className="px-3 py-2 text-xs font-medium text-slate-700 bg-white">
                      {wp.name}
                    </div>
                  </button>
                );
              })}
            </div>
            <label className="inline-flex items-center gap-2 text-xs text-slate-700 pt-2">
              <input
                type="checkbox"
                checked={settings?.showDesktopWidgets ?? true}
                onChange={(e) => void updateSettings({ showDesktopWidgets: e.target.checked })}
                className="accent-blue-600"
              />
              <span>Show floating Qboost RAM/CPU optimizer widget at bottom-right corner</span>
            </label>
          </div>
        ) : section === 'users' ? (
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">
                Local Users (Auto-Synced to Samba SMB)
              </h3>
              <button
                type="button"
                onClick={() => setShowAddUser((v) => !v)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-[#2563eb] text-white text-xs font-medium"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create User</span>
              </button>
            </div>
            {showAddUser && (
              <form
                onSubmit={handleAddUser}
                className="bg-slate-50 border border-slate-200 rounded p-4 flex flex-wrap items-end gap-3 text-xs"
              >
                <div>
                  <label className="block text-slate-600 mb-1">Username</label>
                  <input
                    value={uName}
                    onChange={(e) => setUName(e.target.value)}
                    required
                    className="bg-white border border-slate-300 rounded px-2.5 py-1.5"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1">Password</label>
                  <input
                    type="password"
                    value={uPass}
                    onChange={(e) => setUPass(e.target.value)}
                    required
                    className="bg-white border border-slate-300 rounded px-2.5 py-1.5"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1">Role</label>
                  <select
                    value={uRole}
                    onChange={(e) => setURole(e.target.value as 'user' | 'admin')}
                    className="bg-white border border-slate-300 rounded px-2.5 py-1.5"
                  >
                    <option value="user">User</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded bg-[#2563eb] text-white font-medium"
                >
                  Save
                </button>
              </form>
            )}
            <div className="border border-slate-200 rounded overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#f4f6f9] text-slate-600 border-b border-slate-200">
                    <th className="py-2.5 px-4 font-medium">Username</th>
                    <th className="py-2.5 px-4 font-medium">Role</th>
                    <th className="py-2.5 px-4 font-medium">Groups</th>
                    <th className="py-2.5 px-4 w-12" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4 font-semibold text-slate-900">{u.username}</td>
                      <td className="py-2.5 px-4">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[11px]">
                          <Shield className="w-3 h-3" />
                          {u.role}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-slate-500">{u.groups.join(', ')}</td>
                      <td className="py-2.5 px-4">
                        {u.id !== 'u-admin' && (
                          <button
                            type="button"
                            onClick={async () => {
                              await api.deleteUser(u.id);
                              void loadAll();
                            }}
                            className="p-1 text-rose-500 hover:bg-rose-50 rounded"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : section === 'shares' ? (
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">
                Shared Folders (Auto-Synced to smb.conf &amp; /etc/exports)
              </h3>
              <button
                type="button"
                onClick={() => setShowAddShare((v) => !v)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-[#2563eb] text-white text-xs font-medium"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Shared Folder</span>
              </button>
            </div>
            {showAddShare && (
              <form
                onSubmit={handleAddShare}
                className="bg-slate-50 border border-slate-200 rounded p-4 flex flex-wrap items-end gap-3 text-xs"
              >
                <div>
                  <label className="block text-slate-600 mb-1">Name</label>
                  <input
                    value={sName}
                    onChange={(e) => setSName(e.target.value)}
                    required
                    className="bg-white border border-slate-300 rounded px-2.5 py-1.5"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-slate-600 mb-1">Description</label>
                  <input
                    value={sDesc}
                    onChange={(e) => setSDesc(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5"
                  />
                </div>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded bg-[#2563eb] text-white font-medium"
                >
                  Create
                </button>
              </form>
            )}
            <div className="border border-slate-200 rounded overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#f4f6f9] text-slate-600 border-b border-slate-200">
                    <th className="py-2.5 px-4 font-medium">Folder</th>
                    <th className="py-2.5 px-4 font-medium">Volume</th>
                    <th className="py-2.5 px-4 font-medium">SMB</th>
                    <th className="py-2.5 px-4 font-medium">NFS</th>
                    <th className="py-2.5 px-4 w-12" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {shares.map((sh) => (
                    <tr key={sh.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4 font-medium text-slate-900">
                        <div>{sh.name}</div>
                        <div className="text-[11px] text-slate-400 font-normal">{sh.description}</div>
                      </td>
                      <td className="py-2.5 px-4 text-slate-600">{sh.volume}</td>
                      <td className="py-2.5 px-4">
                        <input
                          type="checkbox"
                          checked={sh.smbEnabled}
                          onChange={async () => {
                            await api.updateShare(sh.id, { smbEnabled: !sh.smbEnabled });
                            void loadAll();
                          }}
                          className="accent-blue-600"
                        />
                      </td>
                      <td className="py-2.5 px-4">
                        <input
                          type="checkbox"
                          checked={sh.nfsEnabled}
                          onChange={async () => {
                            await api.updateShare(sh.id, { nfsEnabled: !sh.nfsEnabled });
                            void loadAll();
                          }}
                          className="accent-blue-600"
                        />
                      </td>
                      <td className="py-2.5 px-4">
                        <button
                          type="button"
                          onClick={async () => {
                            await api.deleteShare(sh.id);
                            void loadAll();
                          }}
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
        ) : section === 'services' ? (
          <div className="p-6 space-y-5">
            <h3 className="text-base font-semibold text-slate-900">Win/Mac/NFS/WebDAV Services</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {services.map((svc) => (
                <div
                  key={svc.id}
                  className="border border-slate-200 rounded p-4 flex items-start justify-between gap-3 bg-slate-50/60"
                >
                  <div>
                    <div className="font-semibold text-slate-900">{svc.name}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{svc.description}</div>
                    <div className="text-[11px] font-mono text-slate-600 mt-2">
                      Port TCP/{svc.port} ·{' '}
                      <span className={svc.enabled ? 'text-emerald-600 font-semibold' : 'text-slate-400'}>
                        {svc.enabled ? 'Running' : 'Stopped'}
                      </span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={svc.enabled}
                    onChange={() => void toggleService(svc)}
                    className="w-4 h-4 mt-0.5 accent-blue-600"
                  />
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
              <div className="border border-slate-200 rounded overflow-hidden">
                <div className="px-3 py-1.5 bg-slate-100 border-b border-slate-200 text-xs font-semibold text-slate-700">
                  Live Generated /etc/samba/smb.conf
                </div>
                <pre className="p-3 bg-[#111827] text-emerald-300 text-[11px] font-mono max-h-56 overflow-auto">
                  {smbPreview}
                </pre>
              </div>
              <div className="border border-slate-200 rounded overflow-hidden">
                <div className="px-3 py-1.5 bg-slate-100 border-b border-slate-200 text-xs font-semibold text-slate-700">
                  Live Generated /etc/exports (NFS)
                </div>
                <pre className="p-3 bg-[#111827] text-sky-300 text-[11px] font-mono max-h-56 overflow-auto">
                  {nfsPreview}
                </pre>
              </div>
            </div>
          </div>
        ) : section === 'logs' ? (
          <div className="p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">QuLog Center — System Events</h3>
              <button
                type="button"
                onClick={() => void refreshLogs()}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-slate-300 text-xs text-slate-700 hover:bg-slate-50"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh</span>
              </button>
            </div>
            <div className="border border-slate-200 rounded overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#f4f6f9] text-slate-600 border-b border-slate-200">
                    <th className="py-2 px-3 font-medium w-36">Date / Time</th>
                    <th className="py-2 px-3 font-medium w-24">Category</th>
                    <th className="py-2 px-3 font-medium w-20">User</th>
                    <th className="py-2 px-3 font-medium">Content</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {logs.map((l) => (
                    <tr key={l.id} className="hover:bg-slate-50">
                      <td className="py-2 px-3 text-slate-500 tabular-nums">
                        {formatDateTime(l.timestamp)}
                      </td>
                      <td className="py-2 px-3 font-medium text-blue-700">{l.category}</td>
                      <td className="py-2 px-3 text-slate-600">{l.user}</td>
                      <td className="py-2 px-3 text-slate-800">{l.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="p-6 space-y-4 max-w-2xl text-xs">
            <h3 className="text-base font-semibold text-slate-900">
              Build Bootable Debian 12 ISO or Install on Linux PC
            </h3>
            <div className="space-y-2">
              <div className="font-semibold text-slate-800">
                Option A — Build Bootable USB Installer ISO (Debian 12 UEFI + BIOS)
              </div>
              <pre className="bg-[#111827] text-emerald-300 rounded p-3.5 font-mono overflow-x-auto">
{`# On WSL2 Ubuntu / Debian Linux:
sudo bash iso-builder/build-iso.sh

# Or on Windows with Docker Desktop:
powershell -ExecutionPolicy Bypass -File iso-builder/build-with-docker.ps1

# Or push to GitHub -> GitHub Actions builds open-qts-5.2-amd64.iso automatically!`}
              </pre>
            </div>
            <div className="space-y-2">
              <div className="font-semibold text-slate-800">
                Option B — One-Command Install on Existing Ubuntu / Debian PC
              </div>
              <pre className="bg-[#111827] text-sky-300 rounded p-3.5 font-mono overflow-x-auto">
                sudo bash scripts/install-linux-nas.sh
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
