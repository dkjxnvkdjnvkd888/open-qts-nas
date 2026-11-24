import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const DATA_ROOT =
  process.env.OPEN_ADM_DATA || path.resolve(__dirname, '../../.open-adm-data');
export const STORAGE_ROOT =
  process.env.OPEN_ADM_STORAGE || path.join(DATA_ROOT, 'storage');
const DB_FILE = path.join(DATA_ROOT, 'state.json');

export interface NasUser {
  id: string;
  username: string;
  fullName: string;
  email: string;
  role: 'admin' | 'user';
  groups: string[];
  passwordHash: string;
  enabled: boolean;
  createdAt: string;
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

export interface InstalledApp {
  appId: string;
  status: 'running' | 'stopped' | 'installing';
  port: number;
  installedAt: string;
  mode: 'docker' | 'simulated';
  containerName?: string;
  composePath?: string;
  pinnedToDesktop: boolean;
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

export interface DatabaseState {
  jwtSecret: string;
  setupCompleted: boolean;
  users: NasUser[];
  shares: SharedFolder[];
  volumes: NasVolume[];
  snapshots: VolumeSnapshot[];
  installedApps: InstalledApp[];
  services: NasServiceState[];
  logs: SystemEventLog[];
  settings: DesktopSettings;
  network: NetworkConfig;
  firmware: FirmwareState;
  cloud: CloudConfig;
  favoriteTracks: string[];
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, key] = stored.split(':');
  if (!salt || !key) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const keyBuf = Buffer.from(key, 'hex');
  if (derived.length !== keyBuf.length) return false;
  return crypto.timingSafeEqual(derived, keyBuf);
}

function detectPrimaryNic(): { name: string; ip: string } {
  const nets = os.networkInterfaces();
  for (const [name, addrs] of Object.entries(nets)) {
    if (!addrs) continue;
    for (const a of addrs) {
      if (a.family === 'IPv4' && !a.internal) {
        return { name, ip: a.address };
      }
    }
  }
  return { name: 'eth0', ip: '192.168.1.100' };
}

function createDefaultCloudConfig(): CloudConfig {
  const cleanHost = os.hostname().toLowerCase().replace(/[^a-z0-9-]/g, '') || 'my-diy-nas';
  return {
    deviceName: cleanHost,
    ddnsEnabled: false,
    provider: 'duckdns',
    domain: `${cleanHost}.duckdns.org`,
    token: '',
    zoneId: '',
    recordName: `nas.${cleanHost}.com`,
    updateIntervalMinutes: 15,
    lastSyncAt: null,
    lastSyncStatus: 'idle',
    lastSyncMessage: 'Not synchronized yet',
    detectedWanIp: 'Auto-detect on sync',
    proxyRules: [
      {
        id: 'px-qts',
        name: 'OpenQTS Web Desktop',
        domain: `nas.${cleanHost}.duckdns.org`,
        targetHost: '127.0.0.1',
        targetPort: Number(process.env.PORT || 8000),
        httpsEnabled: true,
        websockets: true,
        enabled: true,
      },
      {
        id: 'px-jellyfin',
        name: 'Jellyfin Media Server',
        domain: `media.${cleanHost}.duckdns.org`,
        targetHost: '127.0.0.1',
        targetPort: 8096,
        httpsEnabled: true,
        websockets: true,
        enabled: true,
      },
    ],
  };
}

function createDefaultNetworkConfig(): NetworkConfig {
  const nic = detectPrimaryNic();
  const prefix = nic.ip.split('.').slice(0, 3).join('.') || '192.168.1';
  return {
    hostname: os.hostname().toLowerCase().replace(/[^a-z0-9-]/g, '') || 'openqts-nas',
    interfaceName: nic.name,
    mode: 'dhcp',
    ipAddress: nic.ip,
    netmask: '255.255.255.0',
    gateway: `${prefix}.1`,
    dnsPrimary: '1.1.1.1',
    dnsSecondary: '8.8.8.8',
  };
}

function createDefaultFirmwareState(): FirmwareState {
  return {
    currentVersion: '5.2.1.202611',
    buildChannel: 'stable',
    baseOs: 'Debian 12 Bookworm (OpenQTS Appliance)',
    lastCheckedAt: null,
    latestVersion: '5.2.1.202611',
    updateAvailable: false,
    releaseNotes:
      'Includes mdadm RAID 0/1/5/6/10, Btrfs Snapshots, Samba/NFS auto-sync, Docker Compose App Center, QuMagie Photo/Video Station, and myQNAPcloud DDNS.',
  };
}

function createDefaultState(): DatabaseState {
  const now = new Date().toISOString();
  const forceWizard = process.env.OPEN_QTS_FIRST_BOOT === 'true';

  return {
    jwtSecret: crypto.randomBytes(32).toString('hex'),
    setupCompleted: !forceWizard,
    users: [
      {
        id: 'u-admin',
        username: 'admin',
        fullName: 'NAS Administrator',
        email: 'admin@openqts.local',
        role: 'admin',
        groups: ['administrators', 'everyone'],
        passwordHash: hashPassword('admin'),
        enabled: true,
        createdAt: now,
      },
      {
        id: 'u-media',
        username: 'media',
        fullName: 'Media Streamer',
        email: 'media@openqts.local',
        role: 'user',
        groups: ['everyone', 'media'],
        passwordHash: hashPassword('media123'),
        enabled: true,
        createdAt: now,
      },
    ],
    shares: [
      {
        id: 'sh-public',
        name: 'Public',
        path: 'Public',
        volume: 'DataVol1',
        description: 'General shared folder accessible across the local network',
        smbEnabled: true,
        nfsEnabled: true,
        recycleBin: true,
        readOnlyUsers: [],
        readWriteUsers: ['admin', 'media'],
      },
      {
        id: 'sh-media',
        name: 'Media',
        path: 'Media',
        volume: 'DataVol1',
        description: 'Movies, TV shows, photos, and music libraries for Music & Photo Station',
        smbEnabled: true,
        nfsEnabled: true,
        recycleBin: true,
        readOnlyUsers: ['media'],
        readWriteUsers: ['admin'],
      },
      {
        id: 'sh-backups',
        name: 'Backups',
        path: 'Backups',
        volume: 'DataVol1',
        description: 'PC backups, Time Machine, and storage snapshots',
        smbEnabled: true,
        nfsEnabled: false,
        recycleBin: false,
        readOnlyUsers: [],
        readWriteUsers: ['admin'],
      },
      {
        id: 'sh-home',
        name: 'Home',
        path: 'Home',
        volume: 'DataVol1',
        description: 'Personal user home directories',
        smbEnabled: true,
        nfsEnabled: false,
        recycleBin: true,
        readOnlyUsers: [],
        readWriteUsers: ['admin', 'media'],
      },
      {
        id: 'sh-downloads',
        name: 'Downloads',
        path: 'Downloads',
        volume: 'DataVol1',
        description: 'Completed downloads from App Center services',
        smbEnabled: true,
        nfsEnabled: false,
        recycleBin: true,
        readOnlyUsers: [],
        readWriteUsers: ['admin', 'media'],
      },
    ],
    volumes: [
      {
        id: 'vol-1',
        name: 'DataVol1',
        raidLevel: 'Single',
        filesystem: os.platform() === 'win32' ? 'ntfs' : 'btrfs',
        mountPoint: STORAGE_ROOT,
        disks: ['Host System Disk'],
        totalBytes: 512 * 1024 ** 3,
        usedBytes: 84 * 1024 ** 3,
        status: 'Healthy',
        createdAt: now,
      },
    ],
    snapshots: [
      {
        id: 'snap-initial',
        volumeId: 'vol-1',
        volumeName: 'DataVol1',
        name: 'DataVol1@initial-baseline',
        filesystem: os.platform() === 'win32' ? 'ntfs' : 'btrfs',
        path: `${STORAGE_ROOT}/.snapshots/initial-baseline`,
        sizeBytes: 42 * 1024 * 1024,
        createdAt: now,
        note: 'Factory initial system baseline snapshot',
        mode: 'logical',
      },
    ],
    installedApps: [
      {
        appId: 'jellyfin',
        status: 'running',
        port: 8096,
        installedAt: now,
        mode: 'simulated',
        containerName: 'openqts-jellyfin',
        pinnedToDesktop: true,
      },
      {
        appId: 'qbittorrent',
        status: 'stopped',
        port: 8080,
        installedAt: now,
        mode: 'simulated',
        containerName: 'openqts-qbittorrent',
        pinnedToDesktop: false,
      },
    ],
    services: [
      {
        id: 'smb',
        name: 'Win/Mac File Service (SMB/CIFS)',
        description: 'Share folders with Windows, macOS, and Linux computers on LAN',
        port: 445,
        enabled: true,
        status: 'running',
      },
      {
        id: 'nfs',
        name: 'NFS File Service',
        description: 'High-speed UNIX/Linux network file sharing',
        port: 2049,
        enabled: true,
        status: 'running',
      },
      {
        id: 'sftp',
        name: 'Telnet / SSH / SFTP',
        description: 'Encrypted remote file transfer and terminal administration',
        port: 22,
        enabled: true,
        status: 'running',
      },
      {
        id: 'webdav',
        name: 'WebDAV Service',
        description: 'Mount NAS folders over HTTP/HTTPS remotely',
        port: 5005,
        enabled: false,
        status: 'stopped',
      },
      {
        id: 'rsync',
        name: 'Rsync Server',
        description: 'Incremental backup sync between NAS devices and PCs',
        port: 873,
        enabled: false,
        status: 'stopped',
      },
      {
        id: 'docker',
        name: 'Container Station (Docker Compose)',
        description: 'Docker Engine powering App Center containerized applications',
        port: 2375,
        enabled: true,
        status: 'running',
      },
    ],
    logs: [
      {
        id: crypto.randomUUID(),
        timestamp: now,
        level: 'success',
        category: 'System',
        user: 'SYSTEM',
        message: `OpenQTS 5.2 initialized on ${os.hostname()} (${os.platform()} ${os.arch()})`,
      },
      {
        id: crypto.randomUUID(),
        timestamp: now,
        level: 'info',
        category: 'Storage',
        user: 'SYSTEM',
        message: 'Storage Pool 1 (DataVol1) mounted and verified healthy.',
      },
      {
        id: crypto.randomUUID(),
        timestamp: now,
        level: 'info',
        category: 'Network',
        user: 'SYSTEM',
        message: 'SMB/CIFS and NFS file services active on local network.',
      },
    ],
    settings: {
      nasName: `${os.hostname().toUpperCase()}-NAS`,
      wallpaper: 'qts-wave',
      themeMode: 'qts-classic',
      accentColor: '#2563eb',
      showDesktopWidgets: true,
      httpPort: Number(process.env.PORT || 8000),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      autoSleepMinutes: 30,
      sshEnabled: true,
    },
    network: createDefaultNetworkConfig(),
    firmware: createDefaultFirmwareState(),
    cloud: createDefaultCloudConfig(),
    favoriteTracks: [],
  };
}

let stateCache: DatabaseState | null = null;

function generateDemoWav(filePath: string, freqs: number[], durationSec = 10) {
  if (fs.existsSync(filePath)) return;
  const sampleRate = 22050;
  const numSamples = sampleRate * durationSec;
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = numSamples * blockAlign;
  const buf = Buffer.alloc(44 + dataSize);

  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(numChannels, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(byteRate, 28);
  buf.writeUInt16LE(blockAlign, 32);
  buf.writeUInt16LE(bitsPerSample, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const step = Math.floor(t / 2.5) % freqs.length;
    const base = freqs[step];
    const env =
      Math.min(1, t / 0.5) *
      Math.min(1, (durationSec - t) / 0.8) *
      (0.75 + 0.25 * Math.sin(2 * Math.PI * 0.4 * t));
    const sample =
      (Math.sin(2 * Math.PI * base * t) * 0.42 +
        Math.sin(2 * Math.PI * base * 1.25 * t) * 0.26 +
        Math.sin(2 * Math.PI * base * 1.5 * t) * 0.22) *
      env;
    const intSample = Math.max(-1, Math.min(1, sample)) * 18000;
    buf.writeInt16LE(Math.round(intSample), 44 + i * 2);
  }
  fs.writeFileSync(filePath, buf);
}

function seedSamplePhotos(photosDir: string) {
  const samples: { name: string; title: string; c1: string; c2: string; c3: string }[] = [
    {
      name: 'Sample-01-Alpine-Lake.svg',
      title: 'Alpine Horizon',
      c1: '#0f172a',
      c2: '#1d4ed8',
      c3: '#38bdf8',
    },
    {
      name: 'Sample-02-Sunset-Ridge.svg',
      title: 'Sunset Ridge',
      c1: '#3b0764',
      c2: '#be185d',
      c3: '#f59e0b',
    },
    {
      name: 'Sample-03-Nordic-Forest.svg',
      title: 'Nordic Pines',
      c1: '#022c22',
      c2: '#0f766e',
      c3: '#34d399',
    },
  ];
  for (const s of samples) {
    const dest = path.join(photosDir, s.name);
    if (fs.existsSync(dest)) continue;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 750">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${s.c1}"/>
      <stop offset="55%" stop-color="${s.c2}"/>
      <stop offset="100%" stop-color="${s.c3}"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="750" fill="url(#bg)"/>
  <circle cx="930" cy="180" r="95" fill="#ffffff" fill-opacity="0.22"/>
  <path d="M0,520 L260,340 L510,490 L800,290 L1070,460 L1200,390 L1200,750 L0,750 Z" fill="#000000" fill-opacity="0.24"/>
  <path d="M0,590 L310,440 L610,560 L920,410 L1200,530 L1200,750 L0,750 Z" fill="#000000" fill-opacity="0.34"/>
  <text x="64" y="685" fill="#ffffff" fill-opacity="0.85" font-family="Segoe UI, Arial, sans-serif" font-size="38" font-weight="600">${s.title} — OpenQTS Media Sample</text>
</svg>`;
    fs.writeFileSync(dest, svg, 'utf-8');
  }
}

function seedStorageFolders(state: DatabaseState) {
  fs.mkdirSync(STORAGE_ROOT, { recursive: true });
  for (const share of state.shares) {
    const fullPath = path.join(STORAGE_ROOT, share.path);
    fs.mkdirSync(fullPath, { recursive: true });
  }

  const readmePath = path.join(STORAGE_ROOT, 'Public', 'Welcome-to-OpenQTS.txt');
  if (!fs.existsSync(readmePath)) {
    fs.writeFileSync(
      readmePath,
      [
        'Welcome to OpenQTS 5.2 — Debian 12 Bootable DIY PC NAS OS',
        '=========================================================',
        '',
        `Host: ${os.hostname()} (${os.type()} ${os.release()})`,
        `Storage Pool: ${STORAGE_ROOT}`,
        '',
        'Included NAS Applications:',
        '- File Station 5 (upload, preview, download, snapshots)',
        '- Storage & Snapshots (mdadm RAID 0/1/5/6/10 + Btrfs Snapshots + SMART)',
        '- Music Station 5 (stream .mp3, .flac, .wav from Media/)',
        '- Photo & Video Station (QuMagie gallery + MP4/WebM streaming)',
        '- myQNAPcloud (DuckDNS / Cloudflare DDNS + Reverse Proxy)',
        '- App Center (Docker Compose stacks: Jellyfin, Immich, Nextcloud, etc.)',
        '- Control Panel (Network, Samba/NFS auto-sync, Backup/Restore, OTA Update)',
      ].join('\n'),
      'utf-8'
    );
  }

  const mediaSubdirs = ['Movies', 'Photos', 'Music'];
  for (const sub of mediaSubdirs) {
    fs.mkdirSync(path.join(STORAGE_ROOT, 'Media', sub), { recursive: true });
  }

  try {
    generateDemoWav(
      path.join(STORAGE_ROOT, 'Media', 'Music', '01 - Midnight Horizon (Ambient Sample).wav'),
      [220, 261.63, 293.66, 329.63],
      10
    );
    generateDemoWav(
      path.join(STORAGE_ROOT, 'Media', 'Music', '02 - Crystal Waves (Lo-Fi Sample).wav'),
      [246.94, 293.66, 369.99, 329.63],
      10
    );
    seedSamplePhotos(path.join(STORAGE_ROOT, 'Media', 'Photos'));
  } catch {
    // ignore if unable to seed
  }
}

export function getState(): DatabaseState {
  if (stateCache) return stateCache;
  fs.mkdirSync(DATA_ROOT, { recursive: true });
  if (fs.existsSync(DB_FILE)) {
    try {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<DatabaseState>;
      const defaults = createDefaultState();
      stateCache = {
        ...defaults,
        ...parsed,
        setupCompleted:
          typeof parsed.setupCompleted === 'boolean'
            ? parsed.setupCompleted
            : defaults.setupCompleted,
        settings: {
          ...defaults.settings,
          ...(parsed.settings || {}),
          wallpaper:
            !parsed.settings?.wallpaper || parsed.settings.wallpaper === 'adm-aurora'
              ? 'qts-wave'
              : parsed.settings.wallpaper,
        },
        network: {
          ...defaults.network,
          ...(parsed.network || {}),
        },
        firmware: {
          ...defaults.firmware,
          ...(parsed.firmware || {}),
        },
        cloud: {
          ...defaults.cloud,
          ...(parsed.cloud || {}),
        },
        snapshots: Array.isArray(parsed.snapshots) ? parsed.snapshots : defaults.snapshots,
        favoriteTracks: Array.isArray(parsed.favoriteTracks) ? parsed.favoriteTracks : [],
      };
      saveState(stateCache);
    } catch {
      stateCache = createDefaultState();
      saveState(stateCache);
    }
  } else {
    stateCache = createDefaultState();
    saveState(stateCache);
  }
  seedStorageFolders(stateCache);
  return stateCache;
}

export function saveState(next?: DatabaseState): void {
  const toWrite = next || stateCache;
  if (!toWrite) return;
  stateCache = toWrite;
  fs.mkdirSync(DATA_ROOT, { recursive: true });
  fs.writeFileSync(DB_FILE, JSON.stringify(toWrite, null, 2), 'utf-8');
}

export function addEventLog(
  level: SystemEventLog['level'],
  category: SystemEventLog['category'],
  user: string,
  message: string
): SystemEventLog {
  const state = getState();
  const entry: SystemEventLog = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    level,
    category,
    user,
    message,
  };
  state.logs.unshift(entry);
  if (state.logs.length > 250) {
    state.logs.length = 250;
  }
  saveState(state);
  return entry;
}
