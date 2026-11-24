import type {
  PublicNasInfo,
  UserProfile,
  DesktopSettings,
  SystemInfo,
  ProcessItem,
  StorageSummaryResponse,
  NasVolume,
  FileEntry,
  SharedFolder,
  AppCatalogEntry,
  NasServiceState,
  SystemEventLog,
  TelemetryPoint,
  MusicTrack,
  CloudConfig,
  CloudResponse,
  QboostResult,
  ReverseProxyRule,
  VolumeSnapshot,
  MediaItem,
  NetworkConfig,
  FirmwareState,
} from '../types';

const TOKEN_KEY = 'open_adm_token';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(init.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(`/api${path}`, { ...init, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  // Public, Auth & Setup Wizard
  getPublicInfo: () => request<PublicNasInfo>('/public/info'),
  completeSetup: (payload: { nasName: string; adminPassword?: string; timezone: string }) =>
    request<{ ok: boolean; setupCompleted: boolean }>('/setup/complete', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  resetSetupWizard: () =>
    request<{ ok: boolean; setupCompleted: boolean }>('/setup/reset', { method: 'POST' }),
  login: (username: string, password: string) =>
    request<{ token: string; user: UserProfile }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  me: () => request<UserProfile>('/auth/me'),

  // System & Qboost
  getSystemInfo: () => request<SystemInfo>('/system/info'),
  getTelemetryHistory: () => request<{ history: TelemetryPoint[] }>('/system/telemetry'),
  getProcesses: () => request<{ processes: ProcessItem[] }>('/system/processes'),
  getLogs: () => request<{ logs: SystemEventLog[] }>('/system/logs'),
  runQboost: () => request<QboostResult>('/system/qboost', { method: 'POST' }),
  powerAction: (action: 'restart' | 'sleep' | 'shutdown') =>
    request<{ ok: boolean; executedOnOs?: boolean; message: string }>('/system/power', {
      method: 'POST',
      body: JSON.stringify({ action }),
    }),
  getBackupUrl: () =>
    `/api/system/backup?token=${encodeURIComponent(getStoredToken() || '')}`,
  restoreBackup: (backupJson: unknown) =>
    request<{ ok: boolean }>('/system/restore', {
      method: 'POST',
      body: JSON.stringify(backupJson),
    }),
  getFirmware: () => request<{ firmware: FirmwareState; applianceMode: boolean }>('/system/firmware'),
  checkFirmware: () => request<{ firmware: FirmwareState }>('/system/firmware/check', { method: 'POST' }),
  applyFirmwareUpdate: () =>
    request<{ ok: boolean; message: string; firmware: FirmwareState }>('/system/firmware/update', {
      method: 'POST',
    }),
  getNetworkConfig: () =>
    request<{
      network: NetworkConfig;
      interfaces: { name: string; ipv4: string; mac: string; internal: boolean }[];
      smbConfig: string;
      nfsExports: string;
      applianceMode: boolean;
    }>('/network/config'),
  updateNetworkConfig: (updates: Partial<NetworkConfig>) =>
    request<{ network: NetworkConfig; appliedToOs: boolean; unitPreview: string }>('/network/config', {
      method: 'PUT',
      body: JSON.stringify(updates),
    }),

  // Settings
  getSettings: () => request<DesktopSettings>('/settings'),
  updateSettings: (updates: Partial<DesktopSettings>) =>
    request<DesktopSettings>('/settings', {
      method: 'PUT',
      body: JSON.stringify(updates),
    }),

  // Storage & Snapshots
  getStorage: () => request<StorageSummaryResponse>('/storage'),
  createVolume: (payload: {
    name: string;
    raidLevel: NasVolume['raidLevel'];
    filesystem: NasVolume['filesystem'];
    disks: string[];
    capacityGb: number;
  }) =>
    request<NasVolume>('/storage/volumes', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  deleteVolume: (id: string) =>
    request<{ ok: boolean }>(`/storage/volumes/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
  createSnapshot: (volumeId: string, note: string) =>
    request<VolumeSnapshot>('/storage/snapshots', {
      method: 'POST',
      body: JSON.stringify({ volumeId, note }),
    }),
  deleteSnapshot: (id: string) =>
    request<{ ok: boolean }>(`/storage/snapshots/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  // File Station 5
  listFiles: (relPath = '') =>
    request<{ path: string; entries: FileEntry[]; storageRoot: string }>(
      `/files/list?path=${encodeURIComponent(relPath)}`
    ),
  searchFiles: (q: string, relPath = '') =>
    request<{ query: string; entries: FileEntry[] }>(
      `/files/search?q=${encodeURIComponent(q)}&path=${encodeURIComponent(relPath)}`
    ),
  mkdir: (parentPath: string, name: string) =>
    request<FileEntry>('/files/mkdir', {
      method: 'POST',
      body: JSON.stringify({ path: parentPath, name }),
    }),
  renameFile: (relPath: string, newName: string) =>
    request<FileEntry>('/files/rename', {
      method: 'POST',
      body: JSON.stringify({ path: relPath, newName }),
    }),
  deleteFile: (relPath: string) =>
    request<{ ok: boolean }>(`/files/delete?path=${encodeURIComponent(relPath)}`, {
      method: 'DELETE',
    }),
  previewFile: (relPath: string) =>
    request<{ content: string; truncated: boolean; size: number }>(
      `/files/preview?path=${encodeURIComponent(relPath)}`
    ),
  uploadFiles: (relPath: string, files: FileList | File[]) => {
    const fd = new FormData();
    Array.from(files).forEach((f) => fd.append('files', f));
    return request<{ uploaded: { name: string; size: number }[] }>(
      `/files/upload?path=${encodeURIComponent(relPath)}`,
      { method: 'POST', body: fd }
    );
  },
  getDownloadUrl: (relPath: string) =>
    `/api/files/download?path=${encodeURIComponent(relPath)}&token=${encodeURIComponent(
      getStoredToken() || ''
    )}`,
  getRawUrl: (relPath: string) =>
    `/api/files/raw?path=${encodeURIComponent(relPath)}&token=${encodeURIComponent(
      getStoredToken() || ''
    )}`,

  // Music Station 5 & Photo/Video Station
  getMusicTracks: () => request<{ tracks: MusicTrack[] }>('/music/tracks'),
  toggleFavoriteTrack: (relPath: string) =>
    request<{ path: string; favorite: boolean }>('/music/favorite', {
      method: 'POST',
      body: JSON.stringify({ path: relPath }),
    }),
  getMediaItems: () => request<{ items: MediaItem[] }>('/media/items'),

  // myQNAPcloud (DDNS + Reverse Proxy)
  getCloudConfig: () => request<CloudResponse>('/cloud/config'),
  updateCloudConfig: (updates: Partial<CloudConfig>) =>
    request<CloudResponse>('/cloud/config', {
      method: 'PUT',
      body: JSON.stringify(updates),
    }),
  syncDdnsNow: () => request<CloudResponse>('/cloud/ddns/sync', { method: 'POST' }),
  addProxyRule: (rule: Omit<ReverseProxyRule, 'id' | 'enabled'>) =>
    request<CloudResponse & { rule: ReverseProxyRule }>('/cloud/proxy', {
      method: 'POST',
      body: JSON.stringify(rule),
    }),
  toggleProxyRule: (id: string, enabled: boolean) =>
    request<CloudResponse & { rule: ReverseProxyRule }>(`/cloud/proxy/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify({ enabled }),
    }),
  deleteProxyRule: (id: string) =>
    request<CloudResponse & { ok: boolean }>(`/cloud/proxy/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  // App Center
  getApps: () => request<{ dockerAvailable: boolean; apps: AppCatalogEntry[] }>('/apps'),
  installApp: (id: string) => request(`/apps/${encodeURIComponent(id)}/install`, { method: 'POST' }),
  startApp: (id: string) => request(`/apps/${encodeURIComponent(id)}/start`, { method: 'POST' }),
  stopApp: (id: string) => request(`/apps/${encodeURIComponent(id)}/stop`, { method: 'POST' }),
  uninstallApp: (id: string) => request(`/apps/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  // Control Panel: Users, Shares, Services
  getUsers: () => request<{ users: UserProfile[] }>('/users'),
  createUser: (payload: {
    username: string;
    fullName: string;
    email: string;
    password: string;
    role: 'admin' | 'user';
  }) =>
    request<UserProfile>('/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  deleteUser: (id: string) =>
    request<{ ok: boolean }>(`/users/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  getShares: () => request<{ shares: SharedFolder[] }>('/shares'),
  createShare: (payload: {
    name: string;
    description: string;
    volume: string;
    smbEnabled: boolean;
    nfsEnabled: boolean;
    recycleBin: boolean;
  }) =>
    request<SharedFolder>('/shares', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateShare: (id: string, payload: Partial<SharedFolder>) =>
    request<SharedFolder>(`/shares/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteShare: (id: string) =>
    request<{ ok: boolean }>(`/shares/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  getServices: () => request<{ services: NasServiceState[] }>('/services'),
  updateService: (id: string, payload: { enabled?: boolean; port?: number }) =>
    request<NasServiceState>(`/services/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
};
