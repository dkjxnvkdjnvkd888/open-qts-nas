import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  getState,
  saveState,
  addEventLog,
  DATA_ROOT,
  STORAGE_ROOT,
  type InstalledApp,
} from '../store.js';

const execFileAsync = promisify(execFile);

export interface AppCatalogItem {
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
}

export const APP_CATALOG: AppCatalogItem[] = [
  {
    id: 'jellyfin',
    name: 'Jellyfin Media Server',
    developer: 'Jellyfin Project',
    version: '10.9.11',
    category: 'Media',
    description:
      'Free software media system to stream movies, shows, and music from your PC NAS to any device.',
    dockerImage: 'jellyfin/jellyfin:latest',
    defaultPort: 8096,
    containerPort: 8096,
    iconBg: 'from-violet-600 to-sky-500',
    iconLabel: 'JF',
    downloads: '2.4M',
    rating: 4.9,
  },
  {
    id: 'immich',
    name: 'Immich Photo Backup',
    developer: 'Immich Team',
    version: '1.119.0',
    category: 'Media',
    description:
      'Self-hosted high performance photo and video backup solution with AI face & scene search.',
    dockerImage: 'ghcr.io/immich-app/immich-server:release',
    defaultPort: 2283,
    containerPort: 2283,
    iconBg: 'from-pink-500 to-amber-500',
    iconLabel: 'IM',
    downloads: '1.8M',
    rating: 4.9,
  },
  {
    id: 'nextcloud',
    name: 'Nextcloud Hub',
    developer: 'Nextcloud GmbH',
    version: '30.0.1',
    category: 'Productivity',
    description:
      'Private cloud drive, calendars, contacts, and collaborative office suite hosted on your PC.',
    dockerImage: 'nextcloud:latest',
    defaultPort: 8088,
    containerPort: 80,
    iconBg: 'from-sky-500 to-blue-700',
    iconLabel: 'NC',
    downloads: '3.1M',
    rating: 4.8,
  },
  {
    id: 'qbittorrent',
    name: 'qBittorrent Web',
    developer: 'LinuxServer.io',
    version: '5.0.1',
    category: 'Downloads',
    description:
      'Lightweight BitTorrent client with sleek Web UI and automated NAS folder sorting.',
    dockerImage: 'lscr.io/linuxserver/qbittorrent:latest',
    defaultPort: 8080,
    containerPort: 8080,
    iconBg: 'from-blue-500 to-cyan-400',
    iconLabel: 'qB',
    downloads: '1.9M',
    rating: 4.8,
  },
  {
    id: 'homeassistant',
    name: 'Home Assistant',
    developer: 'Open Home Foundation',
    version: '2025.2',
    category: 'Smart Home',
    description:
      'Local-first smart home automation hub supporting 2,000+ IoT devices and dashboards.',
    dockerImage: 'ghcr.io/home-assistant/home-assistant:stable',
    defaultPort: 8123,
    containerPort: 8123,
    iconBg: 'from-cyan-500 to-blue-600',
    iconLabel: 'HA',
    downloads: '2.7M',
    rating: 4.9,
  },
  {
    id: 'portainer',
    name: 'Portainer CE',
    developer: 'Portainer.io',
    version: '2.21.4',
    category: 'System',
    description: 'Visual Docker container, stack, volume, and image manager for power users.',
    dockerImage: 'portainer/portainer-ce:latest',
    defaultPort: 9000,
    containerPort: 9000,
    iconBg: 'from-sky-400 to-indigo-600',
    iconLabel: 'PT',
    downloads: '1.5M',
    rating: 4.7,
  },
  {
    id: 'pihole',
    name: 'Pi-hole DNS AdBlocker',
    developer: 'Pi-hole LLC',
    version: '2025.01',
    category: 'Networking',
    description:
      'Network-wide ad blocking and local DNS server protecting every device on your LAN.',
    dockerImage: 'pihole/pihole:latest',
    defaultPort: 8053,
    containerPort: 80,
    iconBg: 'from-rose-600 to-red-500',
    iconLabel: 'PH',
    downloads: '2.1M',
    rating: 4.9,
  },
  {
    id: 'syncthing',
    name: 'Syncthing',
    developer: 'Syncthing Foundation',
    version: '1.28.1',
    category: 'Backup & Sync',
    description:
      'Continuous encrypted peer-to-peer file synchronization between your PCs, phones, and NAS.',
    dockerImage: 'lscr.io/linuxserver/syncthing:latest',
    defaultPort: 8384,
    containerPort: 8384,
    iconBg: 'from-sky-500 to-teal-500',
    iconLabel: 'ST',
    downloads: '980K',
    rating: 4.8,
  },
  {
    id: 'vaultwarden',
    name: 'Vaultwarden',
    developer: 'Dani Garcia',
    version: '1.32.5',
    category: 'Productivity',
    description:
      'Fast, lightweight self-hosted Bitwarden-compatible password manager for your household.',
    dockerImage: 'vaultwarden/server:latest',
    defaultPort: 8222,
    containerPort: 80,
    iconBg: 'from-blue-600 to-indigo-700',
    iconLabel: 'VW',
    downloads: '1.1M',
    rating: 4.9,
  },
  {
    id: 'plex',
    name: 'Plex Media Server',
    developer: 'Plex Inc.',
    version: '1.41.2',
    category: 'Media',
    description:
      'Organize and stream your personal movies, TV, and music with rich metadata and transcoding.',
    dockerImage: 'lscr.io/linuxserver/plex:latest',
    defaultPort: 32400,
    containerPort: 32400,
    iconBg: 'from-amber-500 to-orange-600',
    iconLabel: 'PX',
    downloads: '4.2M',
    rating: 4.7,
  },
  {
    id: 'duplicati',
    name: 'Duplicati Cloud Backup',
    developer: 'Duplicati Team',
    version: '2.1.0',
    category: 'Backup & Sync',
    description:
      'AES-256 encrypted incremental backups from your NAS to S3, Backblaze B2, Google Drive, or SFTP.',
    dockerImage: 'lscr.io/linuxserver/duplicati:latest',
    defaultPort: 8200,
    containerPort: 8200,
    iconBg: 'from-emerald-500 to-cyan-600',
    iconLabel: 'DP',
    downloads: '640K',
    rating: 4.6,
  },
  {
    id: 'nginx-proxy',
    name: 'Nginx Proxy Manager',
    developer: 'JC21',
    version: '2.12.1',
    category: 'Networking',
    description:
      'Expose NAS services securely with custom domains and automatic Let’s Encrypt SSL certificates.',
    dockerImage: 'jc21/nginx-proxy-manager:latest',
    defaultPort: 81,
    containerPort: 81,
    iconBg: 'from-emerald-600 to-teal-700',
    iconLabel: 'NP',
    downloads: '1.3M',
    rating: 4.8,
  },
];

export function generateComposeYaml(catalog: AppCatalogItem): string {
  const storagePosix = STORAGE_ROOT.replace(/\\/g, '/');
  const configPosix = path.join(DATA_ROOT, 'compose', catalog.id, 'config').replace(/\\/g, '/');
  return [
    `# Auto-generated by OpenQTS 5.2 App Center (Docker Compose)`,
    `services:`,
    `  ${catalog.id}:`,
    `    image: ${catalog.dockerImage}`,
    `    container_name: openqts-${catalog.id}`,
    `    restart: unless-stopped`,
    `    ports:`,
    `      - "${catalog.defaultPort}:${catalog.containerPort}"`,
    `    volumes:`,
    `      - "${configPosix}:/config"`,
    `      - "${storagePosix}/Media:/media"`,
    `      - "${storagePosix}/Downloads:/downloads"`,
    `    environment:`,
    `      - TZ=Asia/Bangkok`,
  ].join('\n');
}

let dockerAvailableCache: boolean | null = null;

export async function isDockerAvailable(): Promise<boolean> {
  if (dockerAvailableCache !== null) return dockerAvailableCache;
  try {
    await execFileAsync('docker', ['info', '--format', '{{.ServerVersion}}'], {
      timeout: 2500,
    });
    dockerAvailableCache = true;
  } catch {
    dockerAvailableCache = false;
  }
  return dockerAvailableCache;
}

export async function listApps() {
  const state = getState();
  const dockerReady = await isDockerAvailable();

  const items = APP_CATALOG.map((catalog) => {
    const installed = state.installedApps.find((a) => a.appId === catalog.id);
    return {
      ...catalog,
      composeYaml: generateComposeYaml(catalog),
      installed: Boolean(installed),
      status: installed?.status || 'available',
      port: installed?.port || catalog.defaultPort,
      mode: installed?.mode || (dockerReady ? 'docker' : 'simulated'),
      pinnedToDesktop: installed?.pinnedToDesktop || false,
      installedAt: installed?.installedAt || null,
    };
  });

  return { dockerAvailable: dockerReady, apps: items };
}

export async function installApp(appId: string, actor: string): Promise<InstalledApp> {
  const catalog = APP_CATALOG.find((a) => a.id === appId);
  if (!catalog) throw new Error('Application not found in App Center');

  const state = getState();
  const existing = state.installedApps.find((a) => a.appId === appId);
  if (existing) return existing;

  const containerName = `openqts-${catalog.id}`;
  const stackDir = path.join(DATA_ROOT, 'compose', catalog.id);
  const composeFile = path.join(stackDir, 'docker-compose.yml');
  fs.mkdirSync(path.join(stackDir, 'config'), { recursive: true });
  fs.writeFileSync(composeFile, generateComposeYaml(catalog) + '\n', 'utf-8');

  let mode: 'docker' | 'simulated' = 'simulated';
  const dockerReady = await isDockerAvailable();
  if (dockerReady) {
    try {
      await execFileAsync('docker', ['compose', '-f', composeFile, 'up', '-d'], {
        timeout: 90000,
      });
      mode = 'docker';
    } catch {
      mode = 'simulated';
    }
  }

  const record: InstalledApp = {
    appId,
    status: 'running',
    port: catalog.defaultPort,
    installedAt: new Date().toISOString(),
    mode,
    containerName,
    composePath: composeFile,
    pinnedToDesktop: true,
  };
  state.installedApps.push(record);
  saveState(state);
  addEventLog(
    'success',
    'App Center',
    actor,
    `Installed ${catalog.name} (${mode === 'docker' ? 'Docker Compose' : 'sandbox mode'}) on port ${record.port}`
  );
  return record;
}

export async function toggleAppState(
  appId: string,
  action: 'start' | 'stop',
  actor: string
): Promise<InstalledApp> {
  const state = getState();
  const installed = state.installedApps.find((a) => a.appId === appId);
  if (!installed) throw new Error('App is not installed');

  if (installed.mode === 'docker' && installed.composePath && fs.existsSync(installed.composePath)) {
    try {
      await execFileAsync('docker', ['compose', '-f', installed.composePath, action], {
        timeout: 15000,
      });
    } catch {
      // continue updating state
    }
  }

  installed.status = action === 'start' ? 'running' : 'stopped';
  saveState(state);
  addEventLog(
    'info',
    'App Center',
    actor,
    `${action === 'start' ? 'Started' : 'Stopped'} application "${appId}"`
  );
  return installed;
}

export async function uninstallApp(appId: string, actor: string): Promise<void> {
  const state = getState();
  const idx = state.installedApps.findIndex((a) => a.appId === appId);
  if (idx === -1) throw new Error('App is not installed');

  const [removed] = state.installedApps.splice(idx, 1);
  if (removed.mode === 'docker' && removed.composePath && fs.existsSync(removed.composePath)) {
    try {
      await execFileAsync('docker', ['compose', '-f', removed.composePath, 'down'], {
        timeout: 15000,
      });
    } catch {
      // ignore
    }
  }
  saveState(state);
  addEventLog('warning', 'App Center', actor, `Uninstalled application "${appId}"`);
}
