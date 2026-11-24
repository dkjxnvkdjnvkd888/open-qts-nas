export interface UserProfile {
  id: string;
  username: string;
  fullName: string;
  email: string;
  role: 'admin' | 'user';
  groups: string[];
  enabled?: boolean;
  createdAt?: string;
}

export interface PublicNasInfo {
  nasName: string;
  admVersion: string;
  wallpaper: string;
  hostname: string;
  platform: string;
  setupCompleted?: boolean;
  applianceMode?: boolean;
}

export interface DesktopSettings {
  nasName: string;
  wallpaper: string;
  themeMode: 'qts-classic' | 'qts-midnight' | 'qts-slate';
  accentColor: string;
  showDesktopWidgets: boolean;
  httpPort: number;
  timezone: string;
  autoSleepMinutes: number;
  sshEnabled: boolean;
}

export interface TelemetryPoint {
  timestamp: string;
  cpuPercent: number;
  memoryPercent: number;
  memoryUsedBytes: number;
  memoryTotalBytes: number;
  networkRxKbps: number;
  networkTxKbps: number;
  diskUsedPercent: number;
  temperatureC: number;
  uptimeSeconds: number;
}

export interface SystemInfo {
  nasName: string;
  admVersion: string;
  hostname: string;
  platform: string;
  osType: string;
  osRelease: string;
  arch: string;
  cpuModel: string;
  cpuCores: number;
  cpuSpeedMhz: number;
  totalMemoryBytes: number;
  freeMemoryBytes: number;
  uptimeSeconds: number;
  networkInterfaces: {
    name: string;
    ipv4: string;
    mac: string;
    internal: boolean;
  }[];
  nodeVersion: string;
}

export interface ProcessItem {
  pid: number;
  name: string;
  cpuPercent: number;
  memoryMb: number;
  status: string;
}

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

export interface NasVolume {
  id: string;
  name: string;
  raidLevel: 'Single' | 'JBOD' | 'RAID 0' | 'RAID 1' | 'RAID 5' | 'RAID 6' | 'RAID 10';
  filesystem: 'ext4' | 'btrfs' | 'zfs' | 'ntfs';
  mountPoint: string;
  disks: string[];
  totalBytes: number;
  usedBytes: number;
  status: 'Healthy' | 'Degraded' | 'Rebuilding';
  createdAt: string;
}

export interface VolumeSnapshot {
  id: string;
  volumeId: string;
  volumeName: string;
  name: string;
  filesystem: string;
  path: string;
  sizeBytes: number;
  createdAt: string;
  note: string;
  mode: 'btrfs' | 'logical';
}

export interface StorageSummaryResponse {
  disks: PhysicalDisk[];
  volumes: NasVolume[];
  snapshots: VolumeSnapshot[];
  summary: {
    totalBytes: number;
    usedBytes: number;
    freeBytes: number;
    usedPercent: number;
    healthyDisks: number;
    totalDisks: number;
  };
}

export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modifiedAt: string;
  extension: string;
}

export interface SharedFolder {
  id: string;
  name: string;
  path: string;
  volume: string;
  description: string;
  smbEnabled: boolean;
  nfsEnabled: boolean;
  recycleBin: boolean;
  readOnlyUsers: string[];
  readWriteUsers: string[];
}

export interface AppCatalogEntry {
  id: string;
  name: string;
  developer: string;
  version: string;
  category:
    | 'Media'
    | 'Backup & Sync'
    | 'Productivity'
    | 'Downloads'
    | 'Smart Home'
    | 'Networking'
    | 'System';
  description: string;
  dockerImage: string;
  defaultPort: number;
  containerPort: number;
  iconBg: string;
  iconLabel: string;
  downloads: string;
  rating: number;
  installed: boolean;
  composeYaml?: string;
  status: 'running' | 'stopped' | 'installing' | 'available';
  port: number;
  mode: 'docker' | 'simulated';
  pinnedToDesktop: boolean;
  installedAt: string | null;
}

export interface NasServiceState {
  id: 'smb' | 'nfs' | 'sftp' | 'webdav' | 'rsync' | 'docker';
  name: string;
  description: string;
  port: number;
  enabled: boolean;
  status: 'running' | 'stopped';
}

export interface SystemEventLog {
  id: string;
  timestamp: string;
  level: 'info' | 'warning' | 'error' | 'success';
  category: 'System' | 'Storage' | 'Access' | 'App Center' | 'Network' | 'Cloud';
  user: string;
  message: string;
}

export interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  fileName: string;
  path: string;
  folder: string;
  format: string;
  size: number;
  modifiedAt: string;
  favorite: boolean;
}

export interface ReverseProxyRule {
  id: string;
  name: string;
  domain: string;
  targetHost: string;
  targetPort: number;
  httpsEnabled: boolean;
  websockets: boolean;
  enabled: boolean;
}

export interface CloudConfig {
  deviceName: string;
  ddnsEnabled: boolean;
  provider: 'duckdns' | 'cloudflare' | 'custom';
  domain: string;
  token: string;
  zoneId: string;
  recordName: string;
  updateIntervalMinutes: number;
  lastSyncAt: string | null;
  lastSyncStatus: 'idle' | 'ok' | 'error';
  lastSyncMessage: string;
  detectedWanIp: string;
  proxyRules: ReverseProxyRule[];
}

export interface CloudResponse {
  cloud: CloudConfig;
  caddyfile: string;
  nginxConfig: string;
}

export interface QboostResult {
  freedMb: number;
  beforePercent: number;
  afterPercent: number;
  method: string;
}

export interface BackgroundTask {
  id: string;
  title: string;
  detail: string;
  progress: number; // 0..100
  status: 'running' | 'completed' | 'error';
  startedAt: string;
}

export interface MediaItem {
  id: string;
  kind: 'photo' | 'video';
  name: string;
  path: string;
  folder: string;
  format: string;
  size: number;
  modifiedAt: string;
}

export interface NetworkConfig {
  hostname: string;
  interfaceName: string;
  mode: 'dhcp' | 'static';
  ipAddress: string;
  netmask: string;
  gateway: string;
  dnsPrimary: string;
  dnsSecondary: string;
}

export interface FirmwareState {
  currentVersion: string;
  buildChannel: 'stable' | 'beta';
  baseOs: string;
  lastCheckedAt: string | null;
  latestVersion: string;
  updateAvailable: boolean;
  releaseNotes: string;
}

export type AppWindowId =
  | 'control-panel'
  | 'file-station'
  | 'storage-snapshots'
  | 'myqnapcloud'
  | 'app-center'
  | 'resource-monitor'
  | 'music-station'
  | 'photo-video';
