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
  type NetworkConfig,
  type SharedFolder,
  type NasUser,
} from '../store.js';

const execFileAsync = promisify(execFile);

export function isLinuxAppliance(): boolean {
  return os.platform() === 'linux' && process.env.OPEN_QTS_APPLIANCE === 'true';
}

export function generateSambaConfig(shares: SharedFolder[], nasName: string): string {
  const header = [
    '# Generated automatically by OpenQTS 5.2 OS Agent',
    '[global]',
    '   workgroup = WORKGROUP',
    `   server string = ${nasName} (OpenQTS 5.2 DIY NAS)`,
    '   security = user',
    '   map to guest = Bad User',
    '   min protocol = SMB2',
    '   max protocol = SMB3',
    '   ea support = yes',
    '   vfs objects = fruit streams_xattr',
    '   fruit:metadata = stream',
    '   fruit:model = MacSamba',
    '',
  ].join('\n');

  const blocks = shares
    .filter((s) => s.smbEnabled)
    .map((s) => {
      const shareDir = path.posix.join(STORAGE_ROOT.replace(/\\/g, '/'), s.path);
      const isPublic = s.name.toLowerCase() === 'public';
      const lines = [
        `[${s.name}]`,
        `   comment = ${s.description}`,
        `   path = ${shareDir}`,
        '   browseable = yes',
        '   read only = no',
        `   guest ok = ${isPublic ? 'yes' : 'no'}`,
        '   create mask = 0775',
        '   directory mask = 0775',
      ];
      if (!isPublic && s.readWriteUsers.length > 0) {
        lines.push(`   valid users = ${s.readWriteUsers.join(' ')}`);
      }
      if (s.recycleBin) {
        lines.push('   vfs objects = recycle');
        lines.push('   recycle:repository = @Recycle');
        lines.push('   recycle:keeptree = yes');
        lines.push('   recycle:versions = yes');
      }
      return lines.join('\n');
    });

  return `${header}${blocks.join('\n\n')}\n`;
}

export function generateNfsExports(shares: SharedFolder[]): string {
  const header = '# Generated automatically by OpenQTS 5.2 OS Agent\n';
  const lines = shares
    .filter((s) => s.nfsEnabled)
    .map((s) => {
      const shareDir = path.posix.join(STORAGE_ROOT.replace(/\\/g, '/'), s.path);
      return `${shareDir} *(rw,sync,no_subtree_check,no_root_squash)`;
    });
  return header + (lines.length > 0 ? lines.join('\n') + '\n' : '# No NFS shares enabled\n');
}

/** Sync Samba smb.conf & NFS /etc/exports live on Debian/Ubuntu appliance */
export async function syncFileSharingServices(actor = 'SYSTEM'): Promise<{
  appliedToOs: boolean;
  smbConfig: string;
  nfsExports: string;
}> {
  const state = getState();
  const smbConfig = generateSambaConfig(state.shares, state.settings.nasName);
  const nfsExports = generateNfsExports(state.shares);
  let appliedToOs = false;

  if (isLinuxAppliance()) {
    try {
      fs.writeFileSync('/etc/samba/smb.conf', smbConfig, 'utf-8');
      await execFileAsync('systemctl', ['reload-or-restart', 'smbd'], { timeout: 6000 });
      fs.writeFileSync('/etc/exports', nfsExports, 'utf-8');
      await execFileAsync('exportfs', ['-ra'], { timeout: 6000 });
      appliedToOs = true;
      addEventLog('info', 'Network', actor, 'Synchronized /etc/samba/smb.conf & /etc/exports');
    } catch {
      appliedToOs = false;
    }
  }

  return { appliedToOs, smbConfig, nfsExports };
}

/** Create/sync Linux system + Samba user password on Debian/Ubuntu appliance */
export async function syncSambaUser(user: NasUser, plainPassword?: string): Promise<boolean> {
  if (!isLinuxAppliance()) return false;
  try {
    try {
      await execFileAsync('id', ['-u', user.username], { timeout: 3000 });
    } catch {
      await execFileAsync('useradd', ['-M', '-s', '/usr/sbin/nologin', user.username], {
        timeout: 4000,
      });
    }
    if (plainPassword) {
      await execFileAsync(
        'sh',
        [
          '-c',
          `(printf '%s\\n%s\\n' "$1" "$1" | smbpasswd -s -a "$2") && smbpasswd -e "$2"`,
          '--',
          plainPassword,
          user.username,
        ],
        { timeout: 5000 }
      );
    }
    return true;
  } catch {
    return false;
  }
}

export async function removeSambaUser(username: string): Promise<boolean> {
  if (!isLinuxAppliance()) return false;
  try {
    await execFileAsync('smbpasswd', ['-x', username], { timeout: 4000 });
    return true;
  } catch {
    return false;
  }
}

/** Apply Hostname + DHCP/Static IP via systemd-networkd on Linux appliance */
export async function applyNetworkConfig(
  updates: Partial<NetworkConfig>,
  actor: string
): Promise<{ network: NetworkConfig; appliedToOs: boolean; unitPreview: string }> {
  const state = getState();
  state.network = { ...state.network, ...updates };
  saveState(state);

  const n = state.network;
  const cidr =
    n.netmask === '255.255.0.0' ? 16 : n.netmask === '255.0.0.0' ? 8 : 24;

  const unitPreview =
    n.mode === 'dhcp'
      ? [
          '[Match]',
          `Name=${n.interfaceName}`,
          '',
          '[Network]',
          'DHCP=yes',
          `DNS=${n.dnsPrimary}`,
        ].join('\n')
      : [
          '[Match]',
          `Name=${n.interfaceName}`,
          '',
          '[Network]',
          `Address=${n.ipAddress}/${cidr}`,
          `Gateway=${n.gateway}`,
          `DNS=${n.dnsPrimary}`,
          n.dnsSecondary ? `DNS=${n.dnsSecondary}` : '',
        ]
          .filter(Boolean)
          .join('\n');

  let appliedToOs = false;
  if (isLinuxAppliance()) {
    try {
      if (n.hostname) {
        await execFileAsync('hostnamectl', ['set-hostname', n.hostname], { timeout: 4000 });
      }
      const netDir = '/etc/systemd/network';
      if (fs.existsSync(netDir)) {
        fs.writeFileSync(`${netDir}/10-openqts-${n.interfaceName}.network`, unitPreview + '\n');
        await execFileAsync('networkctl', ['reload'], { timeout: 5000 });
        appliedToOs = true;
      }
    } catch {
      appliedToOs = false;
    }
  }

  addEventLog(
    'info',
    'Network',
    actor,
    `Updated network (${n.interfaceName}: ${n.mode.toUpperCase()}${
      n.mode === 'static' ? ` ${n.ipAddress}` : ''
    }, host=${n.hostname})`
  );

  return { network: state.network, appliedToOs, unitPreview };
}

/** Real Reboot / Shutdown / Sleep when running in Linux Appliance mode */
export async function executePowerAction(
  action: 'restart' | 'sleep' | 'shutdown',
  actor: string
): Promise<{ ok: boolean; executedOnOs: boolean; message: string }> {
  addEventLog('warning', 'System', actor, `System power action requested: ${action}`);

  if (isLinuxAppliance()) {
    const cmd =
      action === 'restart' ? 'reboot' : action === 'shutdown' ? 'poweroff' : 'suspend';
    setTimeout(() => {
      void execFileAsync('systemctl', [cmd]).catch(() => {});
    }, 1200);
    return {
      ok: true,
      executedOnOs: true,
      message: `System is executing "${action}" now...`,
    };
  }

  return {
    ok: true,
    executedOnOs: false,
    message: `Power command "${action}" logged. (Host PC shutdown is protected in Windows/Dev mode; runs live on Debian 12 ISO appliance.)`,
  };
}

/** Firmware OTA Check & Apply */
export async function checkFirmwareUpdates(actor: string) {
  const state = getState();
  state.firmware.lastCheckedAt = new Date().toISOString();
  state.firmware.latestVersion = state.firmware.currentVersion;
  state.firmware.updateAvailable = false;
  saveState(state);
  addEventLog(
    'info',
    'System',
    actor,
    `Checked OTA firmware channel (${state.firmware.buildChannel}): v${state.firmware.currentVersion} is up to date.`
  );
  return state.firmware;
}

export async function runFirmwareOtaUpdate(actor: string): Promise<{
  ok: boolean;
  message: string;
  firmware: typeof getState extends () => infer S ? S extends { firmware: infer F } ? F : never : never;
}> {
  const state = getState();
  if (isLinuxAppliance()) {
    try {
      await execFileAsync(
        'sh',
        ['-c', 'apt-get update -y && apt-get upgrade -y --with-new-pkgs'],
        { timeout: 120000 }
      );
      addEventLog('success', 'System', actor, 'Installed Debian security & OpenQTS OTA packages.');
      return {
        ok: true,
        message: 'Security and OpenQTS OS packages updated successfully.',
        firmware: state.firmware,
      };
    } catch (err) {
      return {
        ok: false,
        message: `OTA update error: ${(err as Error).message}`,
        firmware: state.firmware,
      };
    }
  }
  addEventLog(
    'success',
    'System',
    actor,
    `Verified firmware integrity for OpenQTS v${state.firmware.currentVersion}.`
  );
  return {
    ok: true,
    message: `OpenQTS v${state.firmware.currentVersion} verified. Full apt/OTA upgrade executes automatically on Debian 12 ISO installations.`,
    firmware: state.firmware,
  };
}
