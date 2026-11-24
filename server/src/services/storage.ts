import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  getState,
  saveState,
  addEventLog,
  STORAGE_ROOT,
  type NasVolume,
  type VolumeSnapshot,
} from '../store.js';
import { isLinuxAppliance } from './osAgent.js';

const execFileAsync = promisify(execFile);

export interface PhysicalDisk {
  id: string;
  device: string;
  model: string;
  interfaceType: string;
  sizeBytes: number;
  usedBytes: number;
  freeBytes: number;
  mountPoint: string;
  temperatureC: number;
  smartStatus: 'Healthy' | 'Warning' | 'Critical';
  filesystem: string;
}

export async function getPhysicalDisks(): Promise<PhysicalDisk[]> {
  try {
    if (os.platform() === 'win32') {
      const psScript = `
        $drives = Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" | ForEach-Object {
          [PSCustomObject]@{
            id = $_.DeviceID
            device = $_.DeviceID
            model = if ($_.VolumeName) { $_.VolumeName } else { "Local Disk ($($_.DeviceID))" }
            interfaceType = "SATA / NVMe"
            sizeBytes = [int64]$_.Size
            freeBytes = [int64]$_.FreeSpace
            usedBytes = [int64]($_.Size - $_.FreeSpace)
            mountPoint = "$($_.DeviceID)\\"
            filesystem = $_.FileSystem
          }
        }
        $drives | ConvertTo-Json -Compress
      `;
      const { stdout } = await execFileAsync(
        'powershell.exe',
        ['-NoProfile', '-Command', psScript],
        { timeout: 5000 }
      );
      const raw = JSON.parse(stdout.trim() || '[]');
      const list = Array.isArray(raw) ? raw : [raw];
      return list
        .filter((d) => d && d.sizeBytes > 0)
        .map((d, idx) => ({
          id: `disk-${idx + 1}`,
          device: String(d.device),
          model: String(d.model),
          interfaceType: String(d.interfaceType || 'NVMe'),
          sizeBytes: Number(d.sizeBytes) || 0,
          usedBytes: Number(d.usedBytes) || 0,
          freeBytes: Number(d.freeBytes) || 0,
          mountPoint: String(d.mountPoint),
          temperatureC: 34 + ((idx * 3) % 9),
          smartStatus: 'Healthy' as const,
          filesystem: String(d.filesystem || 'NTFS'),
        }));
    } else {
      const { stdout } = await execFileAsync(
        'df',
        ['-B1', '-T', '-x', 'tmpfs', '-x', 'devtmpfs', '-x', 'squashfs', '-x', 'overlay'],
        { timeout: 4000 }
      );
      const lines = stdout.trim().split('\n').slice(1);
      const disks: PhysicalDisk[] = [];
      let idx = 0;
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length < 7) continue;
        const [device, fsType, size, used, avail, _pct, ...mountParts] = parts;
        const sizeBytes = Number(size) || 0;
        if (sizeBytes < 1024 * 1024 * 100) continue;
        idx++;
        disks.push({
          id: `disk-${idx}`,
          device,
          model: `PC Disk (${device})`,
          interfaceType: device.includes('nvme') ? 'NVMe PCIe' : 'SATA III',
          sizeBytes,
          usedBytes: Number(used) || 0,
          freeBytes: Number(avail) || 0,
          mountPoint: mountParts.join(' '),
          temperatureC: 33 + ((idx * 2) % 10),
          smartStatus: 'Healthy',
          filesystem: fsType,
        });
      }
      if (disks.length > 0) return disks;
    }
  } catch {
    // Fallback below
  }

  return [
    {
      id: 'disk-1',
      device: os.platform() === 'win32' ? 'C:' : '/dev/sda1',
      model: 'Host System Storage',
      interfaceType: 'NVMe PCIe',
      sizeBytes: 512 * 1024 ** 3,
      usedBytes: 180 * 1024 ** 3,
      freeBytes: 332 * 1024 ** 3,
      mountPoint: STORAGE_ROOT,
      temperatureC: 36,
      smartStatus: 'Healthy',
      filesystem: os.platform() === 'win32' ? 'NTFS' : 'btrfs',
    },
  ];
}

export async function getStorageSummary() {
  const disks = await getPhysicalDisks();
  const state = getState();

  if (disks.length > 0 && state.volumes.length > 0) {
    const primary = disks[0];
    state.volumes[0].totalBytes = primary.sizeBytes;
    state.volumes[0].usedBytes = primary.usedBytes;
    state.volumes[0].disks = [primary.device];
    state.volumes[0].filesystem = primary.filesystem.toLowerCase().includes('ntfs')
      ? 'ntfs'
      : primary.filesystem.toLowerCase().includes('btrfs')
      ? 'btrfs'
      : primary.filesystem.toLowerCase().includes('zfs')
      ? 'zfs'
      : 'ext4';
  }

  const totalBytes = disks.reduce((acc, d) => acc + d.sizeBytes, 0);
  const usedBytes = disks.reduce((acc, d) => acc + d.usedBytes, 0);
  const freeBytes = disks.reduce((acc, d) => acc + d.freeBytes, 0);

  return {
    disks,
    volumes: state.volumes,
    snapshots: state.snapshots,
    summary: {
      totalBytes,
      usedBytes,
      freeBytes,
      usedPercent: totalBytes > 0 ? Number(((usedBytes / totalBytes) * 100).toFixed(1)) : 0,
      healthyDisks: disks.filter((d) => d.smartStatus === 'Healthy').length,
      totalDisks: disks.length,
    },
  };
}

export function createLogicalVolume(
  input: {
    name: string;
    raidLevel: NasVolume['raidLevel'];
    filesystem: NasVolume['filesystem'];
    disks: string[];
    capacityGb: number;
  },
  actor: string
): NasVolume {
  const state = getState();
  const cleanName = input.name.trim() || `DataVol${state.volumes.length + 1}`;
  const vol: NasVolume = {
    id: `vol-${Date.now()}`,
    name: cleanName,
    raidLevel: input.raidLevel,
    filesystem: input.filesystem,
    mountPoint: `${STORAGE_ROOT}/${cleanName.replace(/\s+/g, '_')}`,
    disks: input.disks.length > 0 ? input.disks : ['Host Disk'],
    totalBytes: Math.max(10, input.capacityGb) * 1024 ** 3,
    usedBytes: 128 * 1024 ** 2,
    status: 'Healthy',
    createdAt: new Date().toISOString(),
  };
  state.volumes.push(vol);
  saveState(state);
  addEventLog(
    'success',
    'Storage',
    actor,
    `Created storage volume "${vol.name}" (${vol.raidLevel}, ${vol.filesystem.toUpperCase()})`
  );
  return vol;
}

export function deleteLogicalVolume(volumeId: string, actor: string): boolean {
  const state = getState();
  if (volumeId === 'vol-1') {
    throw new Error('Primary system DataVol1 cannot be deleted.');
  }
  const idx = state.volumes.findIndex((v) => v.id === volumeId);
  if (idx === -1) return false;
  const [removed] = state.volumes.splice(idx, 1);
  saveState(state);
  addEventLog('warning', 'Storage', actor, `Removed storage volume "${removed.name}"`);
  return true;
}

export async function createVolumeSnapshot(
  volumeId: string,
  note: string,
  actor: string
): Promise<VolumeSnapshot> {
  const state = getState();
  const vol = state.volumes.find((v) => v.id === volumeId) || state.volumes[0];
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const snapName = `${vol.name}@${stamp}`;
  const snapDir = path.join(STORAGE_ROOT, '.snapshots');
  const snapPath = path.join(snapDir, stamp);

  let mode: 'btrfs' | 'logical' = 'logical';
  if (isLinuxAppliance() && vol.filesystem === 'btrfs') {
    try {
      fs.mkdirSync(snapDir, { recursive: true });
      await execFileAsync('btrfs', ['subvolume', 'snapshot', '-r', vol.mountPoint, snapPath], {
        timeout: 15000,
      });
      mode = 'btrfs';
    } catch {
      mode = 'logical';
    }
  }

  const snap: VolumeSnapshot = {
    id: `snap-${Date.now()}`,
    volumeId: vol.id,
    volumeName: vol.name,
    name: snapName,
    filesystem: vol.filesystem,
    path: snapPath,
    sizeBytes: Math.round((18 + Math.random() * 64) * 1024 * 1024),
    createdAt: new Date().toISOString(),
    note: note.trim() || 'Manual point-in-time snapshot',
    mode,
  };

  state.snapshots.unshift(snap);
  saveState(state);
  addEventLog(
    'success',
    'Storage',
    actor,
    `Created ${mode === 'btrfs' ? 'Btrfs read-only' : 'volume'} snapshot "${snap.name}"`
  );
  return snap;
}

export async function deleteVolumeSnapshot(id: string, actor: string): Promise<boolean> {
  const state = getState();
  const idx = state.snapshots.findIndex((s) => s.id === id);
  if (idx === -1) return false;
  const [removed] = state.snapshots.splice(idx, 1);

  if (removed.mode === 'btrfs' && isLinuxAppliance()) {
    try {
      await execFileAsync('btrfs', ['subvolume', 'delete', removed.path], { timeout: 10000 });
    } catch {
      // continue cleanup
    }
  }

  saveState(state);
  addEventLog('warning', 'Storage', actor, `Deleted snapshot "${removed.name}"`);
  return true;
}
