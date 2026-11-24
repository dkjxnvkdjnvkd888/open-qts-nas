import React, { useEffect, useState, useCallback } from 'react';
import {
  HardDrive,
  Database,
  ShieldCheck,
  Plus,
  Trash2,
  Thermometer,
  RefreshCw,
  Layers,
  Camera,
} from 'lucide-react';
import { api } from '../api/client';
import { useTelemetry } from '../context/TelemetryContext';
import { formatBytes, formatDateTime } from '../utils/format';
import type { StorageSummaryResponse, NasVolume } from '../types';

export function StorageSnapshotsApp() {
  const { notify, startTask, updateTask } = useTelemetry();
  const [tab, setTab] = useState<'overview' | 'volumes' | 'snapshots' | 'disks'>('overview');
  const [data, setData] = useState<StorageSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [snapNote, setSnapNote] = useState('');

  const [volName, setVolName] = useState('DataVol2');
  const [raidLevel, setRaidLevel] = useState<NasVolume['raidLevel']>('RAID 1');
  const [filesystem, setFilesystem] = useState<NasVolume['filesystem']>('btrfs');
  const [capacityGb, setCapacityGb] = useState(250);

  const loadStorage = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getStorage();
      setData(res);
    } catch (err) {
      notify('Storage & Snapshots', (err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    void loadStorage();
  }, [loadStorage]);

  const handleCreateVolume = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createVolume({
        name: volName,
        raidLevel,
        filesystem,
        disks: data?.disks.map((d) => d.device) || ['Host Disk'],
        capacityGb,
      });
      setShowCreate(false);
      notify('Storage & Snapshots', `Created ${volName} (${raidLevel})`, 'success');
      void loadStorage();
    } catch (err) {
      notify('Create Volume', (err as Error).message, 'error');
    }
  };

  const handleDeleteVolume = async (vol: NasVolume) => {
    if (!window.confirm(`Remove volume "${vol.name}"?`)) return;
    try {
      await api.deleteVolume(vol.id);
      notify('Storage & Snapshots', `Deleted "${vol.name}"`, 'warning');
      void loadStorage();
    } catch (err) {
      notify('Delete Volume', (err as Error).message, 'error');
    }
  };

  const handleTakeSnapshot = async (volumeId = 'vol-1') => {
    const taskId = startTask('Creating Btrfs Snapshot', `Volume ${volumeId}`);
    try {
      updateTask(taskId, { progress: 65 });
      const snap = await api.createSnapshot(volumeId, snapNote);
      setSnapNote('');
      updateTask(taskId, { progress: 100, status: 'completed', detail: `Created ${snap.name}` });
      notify('Snapshot Created', `Captured ${snap.name} (${snap.mode})`, 'success');
      void loadStorage();
    } catch (err) {
      updateTask(taskId, { progress: 100, status: 'error', detail: (err as Error).message });
      notify('Snapshot Failed', (err as Error).message, 'error');
    }
  };

  const handleDeleteSnapshot = async (id: string, name: string) => {
    if (!window.confirm(`Delete snapshot "${name}"?`)) return;
    try {
      await api.deleteSnapshot(id);
      notify('Snapshot Deleted', `Removed ${name}`, 'warning');
      void loadStorage();
    } catch (err) {
      notify('Snapshot', (err as Error).message, 'error');
    }
  };

  return (
    <div className="flex flex-1 min-h-0 bg-white">
      <aside className="w-52 bg-[#f5f7fa] border-r border-slate-200 p-3 space-y-1 shrink-0 text-xs">
        <div className="px-2 pb-3 mb-1 border-b border-slate-200 font-semibold text-slate-800">
          Storage &amp; Snapshots
        </div>
        {[
          { id: 'overview', label: 'Overview', icon: Layers },
          { id: 'volumes', label: 'Volumes & mdadm RAID', icon: Database },
          { id: 'snapshots', label: 'Btrfs Snapshots', icon: Camera },
          { id: 'disks', label: 'Disks & S.M.A.R.T.', icon: HardDrive },
        ].map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id as typeof tab)}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded text-left font-medium transition-colors ${
                active ? 'bg-[#0284c7] text-white' : 'text-slate-700 hover:bg-slate-200/70'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </aside>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              {tab === 'overview'
                ? 'Storage Pool Overview'
                : tab === 'volumes'
                ? 'Volumes & RAID Arrays'
                : 'Physical Disks & S.M.A.R.T. Health'}
            </h2>
            <p className="text-xs text-slate-500">Live hardware storage detected from host PC</p>
          </div>
          <div className="flex items-center gap-2">
            {tab === 'volumes' && (
              <button
                type="button"
                onClick={() => setShowCreate(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#0284c7] hover:bg-[#0369a1] text-white text-xs font-medium"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Volume</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => void loadStorage()}
              className="p-1.5 rounded border border-slate-300 text-slate-600 hover:bg-slate-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {data && tab === 'overview' && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div className="bg-slate-50 border border-slate-200 rounded p-4">
                <div className="text-xs text-slate-500">Total Capacity</div>
                <div className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
                  {formatBytes(data.summary.totalBytes)}
                </div>
                <div className="text-[11px] text-emerald-700 mt-1 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {data.summary.healthyDisks} / {data.summary.totalDisks} disks Good
                </div>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded p-4">
                <div className="text-xs text-slate-500">Allocated Space</div>
                <div className="text-2xl font-bold text-blue-700 mt-1 tabular-nums">
                  {formatBytes(data.summary.usedBytes)}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  {data.summary.usedPercent}% used
                </div>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded p-4">
                <div className="text-xs text-slate-500">Free Space</div>
                <div className="text-2xl font-bold text-emerald-700 mt-1 tabular-nums">
                  {formatBytes(data.summary.freeBytes)}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  {data.volumes.length} volume(s) online
                </div>
              </div>
            </div>

            <div className="border border-slate-200 rounded p-4 space-y-3">
              <div className="flex justify-between text-xs font-medium text-slate-700">
                <span>Storage Pool 1 Usage</span>
                <span className="tabular-nums">{data.summary.usedPercent}%</span>
              </div>
              <div className="h-3 rounded bg-slate-200 overflow-hidden">
                <div
                  className="h-full bg-[#0284c7]"
                  style={{ width: `${Math.min(100, data.summary.usedPercent)}%` }}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                {data.disks.map((d) => {
                  const pct = d.sizeBytes > 0 ? Math.round((d.usedBytes / d.sizeBytes) * 100) : 0;
                  return (
                    <div
                      key={d.id}
                      className="border border-slate-200 rounded p-3 flex items-center justify-between gap-3 bg-slate-50/70"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <HardDrive className="w-5 h-5 text-[#0284c7] shrink-0" />
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-slate-900 truncate">
                            {d.device} — {d.model}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {formatBytes(d.usedBytes)} / {formatBytes(d.sizeBytes)} ({d.filesystem})
                          </div>
                        </div>
                      </div>
                      <span className="text-xs font-semibold text-blue-700 tabular-nums">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {data && tab === 'volumes' && (
          <div className="space-y-4">
            {showCreate && (
              <form
                onSubmit={handleCreateVolume}
                className="bg-blue-50/70 border border-blue-200 rounded p-4 space-y-3 text-xs"
              >
                <div className="font-semibold text-slate-900">Create New Logical Volume</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-slate-600 mb-1">Volume Alias</label>
                    <input
                      value={volName}
                      onChange={(e) => setVolName(e.target.value)}
                      required
                      className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1">RAID Type</label>
                    <select
                      value={raidLevel}
                      onChange={(e) => setRaidLevel(e.target.value as NasVolume['raidLevel'])}
                      className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5"
                    >
                      <option value="Single">Single</option>
                      <option value="JBOD">JBOD</option>
                      <option value="RAID 0">RAID 0</option>
                      <option value="RAID 1">RAID 1</option>
                      <option value="RAID 5">RAID 5</option>
                      <option value="RAID 6">RAID 6</option>
                      <option value="RAID 10">RAID 10</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1">Filesystem</label>
                    <select
                      value={filesystem}
                      onChange={(e) => setFilesystem(e.target.value as NasVolume['filesystem'])}
                      className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5"
                    >
                      <option value="btrfs">Btrfs</option>
                      <option value="ext4">EXT4</option>
                      <option value="zfs">ZFS</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1">Capacity (GB)</label>
                    <input
                      type="number"
                      min={10}
                      value={capacityGb}
                      onChange={(e) => setCapacityGb(Number(e.target.value))}
                      className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCreate(false)}
                    className="px-3 py-1 text-slate-500"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3.5 py-1 rounded bg-[#0284c7] text-white font-medium"
                  >
                    Create
                  </button>
                </div>
              </form>
            )}

            {data.volumes.map((vol) => {
              const pct = vol.totalBytes > 0 ? Math.round((vol.usedBytes / vol.totalBytes) * 100) : 0;
              return (
                <div key={vol.id} className="border border-slate-200 rounded p-4 space-y-2.5">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900">{vol.name}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 font-semibold">
                          {vol.status}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-blue-100 text-blue-700 font-semibold">
                          {vol.raidLevel} · {vol.filesystem.toUpperCase()}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Path: <code>{vol.mountPoint}</code> · Disks: {vol.disks.join(', ')}
                      </div>
                    </div>
                    {vol.id !== 'vol-1' && (
                      <button
                        type="button"
                        onClick={() => void handleDeleteVolume(vol)}
                        className="p-1 text-rose-500 hover:bg-rose-50 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="h-2 rounded bg-slate-200 overflow-hidden">
                    <div className="h-full bg-[#0284c7]" style={{ width: `${Math.min(100, pct)}%` }} />
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-500 tabular-nums">
                    <span>Used: {formatBytes(vol.usedBytes)}</span>
                    <span>
                      Total: {formatBytes(vol.totalBytes)} ({pct}%)
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {data && tab === 'snapshots' && (
          <div className="space-y-4">
            <div className="bg-slate-50 border border-slate-200 rounded p-4 flex flex-wrap items-center gap-3 text-xs">
              <input
                value={snapNote}
                onChange={(e) => setSnapNote(e.target.value)}
                placeholder="Snapshot note (e.g. Before firmware upgrade)..."
                className="flex-1 min-w-[200px] bg-white border border-slate-300 rounded px-3 py-1.5"
              />
              <button
                type="button"
                onClick={() => void handleTakeSnapshot('vol-1')}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded bg-[#0284c7] hover:bg-[#0369a1] text-white font-medium"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Take Snapshot (DataVol1)</span>
              </button>
            </div>

            <div className="border border-slate-200 rounded overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#f4f6f9] text-slate-600 border-b border-slate-200">
                    <th className="py-2.5 px-4 font-medium">Snapshot Name</th>
                    <th className="py-2.5 px-4 font-medium">Mode</th>
                    <th className="py-2.5 px-4 font-medium">Note</th>
                    <th className="py-2.5 px-4 font-medium">Created</th>
                    <th className="py-2.5 px-4 font-medium text-right">Delta Size</th>
                    <th className="py-2.5 px-4 w-12" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(data.snapshots || []).map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4 font-mono text-blue-700 font-medium">{s.name}</td>
                      <td className="py-2.5 px-4">
                        <span className="px-2 py-0.5 rounded bg-sky-100 text-sky-700 text-[10px] font-semibold uppercase">
                          {s.mode}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-slate-600">{s.note}</td>
                      <td className="py-2.5 px-4 text-slate-500 tabular-nums">
                        {formatDateTime(s.createdAt)}
                      </td>
                      <td className="py-2.5 px-4 text-slate-700 text-right tabular-nums">
                        {formatBytes(s.sizeBytes)}
                      </td>
                      <td className="py-2.5 px-4">
                        <button
                          type="button"
                          onClick={() => void handleDeleteSnapshot(s.id, s.name)}
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

        {data && tab === 'disks' && (
          <div className="border border-slate-200 rounded overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#f4f6f9] text-slate-600 border-b border-slate-200">
                  <th className="py-2.5 px-4 font-medium">Disk</th>
                  <th className="py-2.5 px-4 font-medium">Model / Label</th>
                  <th className="py-2.5 px-4 font-medium">Bus</th>
                  <th className="py-2.5 px-4 font-medium">Capacity</th>
                  <th className="py-2.5 px-4 font-medium">Temp</th>
                  <th className="py-2.5 px-4 font-medium">S.M.A.R.T.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.disks.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4 font-mono text-blue-700 font-semibold">{d.device}</td>
                    <td className="py-2.5 px-4 font-medium text-slate-900">{d.model}</td>
                    <td className="py-2.5 px-4 text-slate-500">{d.interfaceType}</td>
                    <td className="py-2.5 px-4 text-slate-800 tabular-nums">{formatBytes(d.sizeBytes)}</td>
                    <td className="py-2.5 px-4 text-slate-700 tabular-nums">
                      <span className="inline-flex items-center gap-1">
                        <Thermometer className="w-3.5 h-3.5 text-amber-500" />
                        {d.temperatureC}°C
                      </span>
                    </td>
                    <td className="py-2.5 px-4">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[11px] font-semibold">
                        <ShieldCheck className="w-3 h-3" />
                        {d.smartStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
