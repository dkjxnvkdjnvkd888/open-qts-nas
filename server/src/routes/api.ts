import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import {
  getState,
  saveState,
  hashPassword,
  verifyPassword,
  addEventLog,
  STORAGE_ROOT,
} from '../store.js';
import { createToken, requireAuth, requireAdmin, type AuthedRequest } from '../auth.js';
import { getSystemInfo, getTopProcesses, runQboostOptimize } from '../services/system.js';
import {
  getStorageSummary,
  createLogicalVolume,
  deleteLogicalVolume,
  createVolumeSnapshot,
  deleteVolumeSnapshot,
} from '../services/storage.js';
import {
  listDirectory,
  createFolder,
  renameEntry,
  deleteEntry,
  readTextPreview,
  searchFiles,
  resolveSafePath,
} from '../services/files.js';
import { listApps, installApp, toggleAppState, uninstallApp } from '../services/apps.js';
import { getTelemetryHistory } from '../services/monitor.js';
import { scanMusicLibrary, toggleFavoriteTrack } from '../services/music.js';
import { scanMultimediaLibrary, getMediaMimeType } from '../services/media.js';
import {
  getCloudConfig,
  updateCloudConfig,
  addProxyRule,
  toggleProxyRule,
  deleteProxyRule,
  syncDdnsNow,
  generateCaddyfile,
  generateNginxConfig,
} from '../services/cloud.js';
import {
  syncFileSharingServices,
  syncSambaUser,
  removeSambaUser,
  applyNetworkConfig,
  executePowerAction,
  checkFirmwareUpdates,
  runFirmwareOtaUpdate,
  isLinuxAppliance,
} from '../services/osAgent.js';

const router = Router();

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      try {
        const targetRel = typeof req.query.path === 'string' ? req.query.path : '';
        const dest = resolveSafePath(targetRel);
        fs.mkdirSync(dest, { recursive: true });
        cb(null, dest);
      } catch (err) {
        cb(err as Error, STORAGE_ROOT);
      }
    },
    filename: (_req, file, cb) => {
      const safe = path.basename(file.originalname).replace(/[<>:"/\\|?*]/g, '_');
      cb(null, safe || `upload-${Date.now()}`);
    },
  }),
  limits: { fileSize: 1024 * 1024 * 1024 },
});

// ========================
// PUBLIC / AUTH / SETUP WIZARD
// ========================

router.get('/public/info', (_req, res) => {
  const state = getState();
  const sys = getSystemInfo();
  res.json({
    nasName: state.settings.nasName,
    admVersion: sys.admVersion,
    wallpaper: state.settings.wallpaper,
    hostname: sys.hostname,
    platform: sys.platform,
    setupCompleted: state.setupCompleted,
    applianceMode: isLinuxAppliance(),
  });
});

router.post('/setup/complete', async (req, res) => {
  const { nasName, adminPassword, timezone } = req.body as {
    nasName?: string;
    adminPassword?: string;
    timezone?: string;
  };
  const state = getState();
  if (nasName?.trim()) {
    state.settings.nasName = nasName.trim();
    state.network.hostname = nasName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-');
  }
  if (timezone?.trim()) {
    state.settings.timezone = timezone.trim();
  }
  const adminUser = state.users.find((u) => u.id === 'u-admin');
  if (adminUser && adminPassword && adminPassword.trim().length >= 4) {
    adminUser.passwordHash = hashPassword(adminPassword.trim());
    await syncSambaUser(adminUser, adminPassword.trim());
  }
  state.setupCompleted = true;
  saveState(state);
  await syncFileSharingServices('SETUP_WIZARD');
  addEventLog('success', 'System', 'admin', 'Completed OpenQTS Smart Installation Setup Wizard.');
  res.json({ ok: true, setupCompleted: true });
});

router.post('/setup/reset', requireAuth, requireAdmin, (_req, res) => {
  const state = getState();
  state.setupCompleted = false;
  saveState(state);
  res.json({ ok: true, setupCompleted: false });
});

router.post('/auth/login', (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || !password) {
    res.status(400).json({ error: 'Username and password are required' });
    return;
  }
  const state = getState();
  const user = state.users.find(
    (u) => u.username.toLowerCase() === username.trim().toLowerCase()
  );
  if (!user || !user.enabled || !verifyPassword(password, user.passwordHash)) {
    addEventLog('warning', 'Access', username, 'Failed login attempt');
    res.status(401).json({ error: 'Invalid username or password' });
    return;
  }
  const token = createToken(user);
  addEventLog('info', 'Access', user.username, 'Signed in to OpenQTS 5.2 Desktop');
  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      groups: user.groups,
    },
  });
});

router.get('/auth/me', requireAuth, (req: AuthedRequest, res) => {
  const state = getState();
  const user = state.users.find((u) => u.id === req.user?.userId);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.json({
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    groups: user.groups,
  });
});

// ========================
// SYSTEM, QBOOST, BACKUP/RESTORE, FIRMWARE OTA
// ========================

router.get('/system/info', requireAuth, (_req, res) => {
  res.json(getSystemInfo());
});

router.get('/system/telemetry', requireAuth, (_req, res) => {
  res.json({ history: getTelemetryHistory() });
});

router.get('/system/processes', requireAuth, async (_req, res) => {
  const processes = await getTopProcesses();
  res.json({ processes });
});

router.get('/system/logs', requireAuth, (_req, res) => {
  res.json({ logs: getState().logs });
});

router.post('/system/qboost', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const result = await runQboostOptimize();
    addEventLog(
      'success',
      'System',
      req.user!.username,
      `Qboost optimized memory (${result.freedMb} MB reclaimed via ${result.method})`
    );
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post('/system/power', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  const { action } = req.body as { action?: 'restart' | 'sleep' | 'shutdown' };
  const result = await executePowerAction(action || 'restart', req.user!.username);
  res.json(result);
});

router.get('/system/backup', requireAuth, requireAdmin, (req: AuthedRequest, res) => {
  const state = getState();
  const safeBackup = {
    exportedAt: new Date().toISOString(),
    version: state.firmware.currentVersion,
    settings: state.settings,
    network: state.network,
    shares: state.shares,
    services: state.services,
    cloud: { ...state.cloud, token: '' }, // redact secrets
  };
  addEventLog('info', 'System', req.user!.username, 'Exported OpenQTS system configuration backup');
  res.setHeader('Content-Disposition', 'attachment; filename="openqts-config-backup.json"');
  res.json(safeBackup);
});

router.post('/system/restore', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  try {
    const body = req.body as Partial<{
      settings: ReturnType<typeof getState>['settings'];
      network: ReturnType<typeof getState>['network'];
      shares: ReturnType<typeof getState>['shares'];
      services: ReturnType<typeof getState>['services'];
    }>;
    const state = getState();
    if (body.settings) state.settings = { ...state.settings, ...body.settings };
    if (body.network) state.network = { ...state.network, ...body.network };
    if (Array.isArray(body.shares)) state.shares = body.shares;
    if (Array.isArray(body.services)) state.services = body.services;
    saveState(state);
    await syncFileSharingServices(req.user!.username);
    addEventLog('success', 'System', req.user!.username, 'Restored OpenQTS configuration backup');
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

router.get('/system/firmware', requireAuth, (_req, res) => {
  res.json({ firmware: getState().firmware, applianceMode: isLinuxAppliance() });
});

router.post('/system/firmware/check', requireAuth, async (req: AuthedRequest, res) => {
  const firmware = await checkFirmwareUpdates(req.user!.username);
  res.json({ firmware });
});

router.post('/system/firmware/update', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  const result = await runFirmwareOtaUpdate(req.user!.username);
  res.json(result);
});

// ========================
// SETTINGS & NETWORK
// ========================

router.get('/settings', requireAuth, (_req, res) => {
  res.json(getState().settings);
});

router.put('/settings', requireAuth, async (req: AuthedRequest, res) => {
  const state = getState();
  state.settings = { ...state.settings, ...req.body };
  saveState(state);
  await syncFileSharingServices(req.user!.username);
  addEventLog('info', 'System', req.user!.username, 'Updated OpenQTS system & desktop settings');
  res.json(state.settings);
});

router.get('/network/config', requireAuth, async (_req, res) => {
  const sys = getSystemInfo();
  const state = getState();
  const sharing = await syncFileSharingServices('SYSTEM');
  res.json({
    network: state.network,
    interfaces: sys.networkInterfaces,
    smbConfig: sharing.smbConfig,
    nfsExports: sharing.nfsExports,
    applianceMode: isLinuxAppliance(),
  });
});

router.put('/network/config', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  const result = await applyNetworkConfig(req.body, req.user!.username);
  res.json(result);
});

// ========================
// STORAGE & BTRFS SNAPSHOTS
// ========================

router.get('/storage', requireAuth, async (_req, res) => {
  const data = await getStorageSummary();
  res.json(data);
});

router.post('/storage/volumes', requireAuth, requireAdmin, (req: AuthedRequest, res) => {
  try {
    const vol = createLogicalVolume(req.body, req.user!.username);
    res.status(201).json(vol);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

router.delete('/storage/volumes/:id', requireAuth, requireAdmin, (req: AuthedRequest, res) => {
  try {
    const ok = deleteLogicalVolume(String(req.params.id), req.user!.username);
    if (!ok) {
      res.status(404).json({ error: 'Volume not found' });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

router.get('/storage/snapshots', requireAuth, (_req, res) => {
  res.json({ snapshots: getState().snapshots });
});

router.post('/storage/snapshots', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  try {
    const { volumeId = 'vol-1', note = '' } = req.body as { volumeId?: string; note?: string };
    const snap = await createVolumeSnapshot(volumeId, note, req.user!.username);
    res.status(201).json(snap);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

router.delete('/storage/snapshots/:id', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  const ok = await deleteVolumeSnapshot(String(req.params.id), req.user!.username);
  if (!ok) {
    res.status(404).json({ error: 'Snapshot not found' });
    return;
  }
  res.json({ ok: true });
});

// ========================
// FILE STATION 5
// ========================

router.get('/files/list', requireAuth, (req, res) => {
  try {
    const relPath = typeof req.query.path === 'string' ? req.query.path : '';
    const entries = listDirectory(relPath);
    res.json({ path: relPath, entries, storageRoot: STORAGE_ROOT });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

router.get('/files/search', requireAuth, (req, res) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    const base = typeof req.query.path === 'string' ? req.query.path : '';
    const entries = searchFiles(q, base);
    res.json({ query: q, entries });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

router.post('/files/mkdir', requireAuth, (req: AuthedRequest, res) => {
  try {
    const { path: parentPath = '', name } = req.body as { path?: string; name?: string };
    if (!name) {
      res.status(400).json({ error: 'Folder name required' });
      return;
    }
    const created = createFolder(parentPath, name, req.user!.username);
    res.status(201).json(created);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

router.post('/files/rename', requireAuth, (req: AuthedRequest, res) => {
  try {
    const { path: relPath, newName } = req.body as { path?: string; newName?: string };
    if (!relPath || !newName) {
      res.status(400).json({ error: 'path and newName are required' });
      return;
    }
    const updated = renameEntry(relPath, newName, req.user!.username);
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

router.delete('/files/delete', requireAuth, (req: AuthedRequest, res) => {
  try {
    const relPath = typeof req.query.path === 'string' ? req.query.path : '';
    if (!relPath) {
      res.status(400).json({ error: 'path query param is required' });
      return;
    }
    deleteEntry(relPath, req.user!.username);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

router.post('/files/upload', requireAuth, upload.array('files', 20), (req: AuthedRequest, res) => {
  const files = (req.files as Express.Multer.File[]) || [];
  const targetPath = typeof req.query.path === 'string' ? req.query.path : '/';
  addEventLog(
    'info',
    'Storage',
    req.user!.username,
    `Uploaded ${files.length} file(s) to /${targetPath}`
  );
  res.status(201).json({
    uploaded: files.map((f) => ({ name: f.filename, size: f.size })),
  });
});

router.get('/files/preview', requireAuth, (req, res) => {
  try {
    const relPath = typeof req.query.path === 'string' ? req.query.path : '';
    const preview = readTextPreview(relPath);
    res.json(preview);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

router.get('/files/download', requireAuth, (req, res) => {
  try {
    const relPath = typeof req.query.path === 'string' ? req.query.path : '';
    const full = resolveSafePath(relPath);
    if (!fs.existsSync(full) || fs.statSync(full).isDirectory()) {
      res.status(404).json({ error: 'File not found' });
      return;
    }
    res.download(full);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

router.get('/files/raw', requireAuth, (req, res) => {
  try {
    const relPath = typeof req.query.path === 'string' ? req.query.path : '';
    const full = resolveSafePath(relPath);
    if (!fs.existsSync(full) || fs.statSync(full).isDirectory()) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    const stat = fs.statSync(full);
    const total = stat.size;
    const range = req.headers.range;
    const contentType = getMediaMimeType(full);

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : total - 1;
      if (isNaN(start) || isNaN(end) || start >= total || end >= total) {
        res.status(416).setHeader('Content-Range', `bytes */${total}`).end();
        return;
      }
      const chunkSize = end - start + 1;
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${total}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': contentType,
      });
      fs.createReadStream(full, { start, end }).pipe(res);
      return;
    }

    if (contentType !== 'application/octet-stream') {
      res.setHeader('Content-Type', contentType);
      res.setHeader('Accept-Ranges', 'bytes');
    }
    res.sendFile(full);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

// ========================
// MUSIC STATION 5 & PHOTO/VIDEO STATION
// ========================

router.get('/music/tracks', requireAuth, (_req, res) => {
  res.json({ tracks: scanMusicLibrary() });
});

router.post('/music/favorite', requireAuth, (req, res) => {
  const { path: relPath } = req.body as { path?: string };
  if (!relPath) {
    res.status(400).json({ error: 'Track path is required' });
    return;
  }
  const favorite = toggleFavoriteTrack(relPath);
  res.json({ path: relPath, favorite });
});

router.get('/media/items', requireAuth, (_req, res) => {
  res.json({ items: scanMultimediaLibrary() });
});

// ========================
// myQNAPcloud (DDNS & REVERSE PROXY)
// ========================

router.get('/cloud/config', requireAuth, (_req, res) => {
  const cloud = getCloudConfig();
  res.json({
    cloud,
    caddyfile: generateCaddyfile(cloud),
    nginxConfig: generateNginxConfig(cloud),
  });
});

router.put('/cloud/config', requireAuth, requireAdmin, (req: AuthedRequest, res) => {
  const cloud = updateCloudConfig(req.body, req.user!.username);
  res.json({
    cloud,
    caddyfile: generateCaddyfile(cloud),
    nginxConfig: generateNginxConfig(cloud),
  });
});

router.post('/cloud/ddns/sync', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  try {
    const cloud = await syncDdnsNow(req.user!.username);
    res.json({
      cloud,
      caddyfile: generateCaddyfile(cloud),
      nginxConfig: generateNginxConfig(cloud),
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post('/cloud/proxy', requireAuth, requireAdmin, (req: AuthedRequest, res) => {
  const { name, domain, targetHost, targetPort, httpsEnabled, websockets } = req.body as {
    name?: string;
    domain?: string;
    targetHost?: string;
    targetPort?: number;
    httpsEnabled?: boolean;
    websockets?: boolean;
  };
  if (!domain?.trim() || !targetPort) {
    res.status(400).json({ error: 'Domain and target port are required' });
    return;
  }
  const rule = addProxyRule(
    {
      name: (name || domain).trim(),
      domain: domain.trim(),
      targetHost: (targetHost || '127.0.0.1').trim(),
      targetPort: Number(targetPort),
      httpsEnabled: httpsEnabled ?? true,
      websockets: websockets ?? true,
      enabled: true,
    },
    req.user!.username
  );
  const cloud = getCloudConfig();
  res.status(201).json({
    rule,
    cloud,
    caddyfile: generateCaddyfile(cloud),
    nginxConfig: generateNginxConfig(cloud),
  });
});

router.put('/cloud/proxy/:id', requireAuth, requireAdmin, (req: AuthedRequest, res) => {
  const { enabled } = req.body as { enabled?: boolean };
  const updated = toggleProxyRule(String(req.params.id), Boolean(enabled), req.user!.username);
  if (!updated) {
    res.status(404).json({ error: 'Proxy rule not found' });
    return;
  }
  const cloud = getCloudConfig();
  res.json({
    rule: updated,
    cloud,
    caddyfile: generateCaddyfile(cloud),
    nginxConfig: generateNginxConfig(cloud),
  });
});

router.delete('/cloud/proxy/:id', requireAuth, requireAdmin, (req: AuthedRequest, res) => {
  const ok = deleteProxyRule(String(req.params.id), req.user!.username);
  if (!ok) {
    res.status(404).json({ error: 'Proxy rule not found' });
    return;
  }
  const cloud = getCloudConfig();
  res.json({
    ok: true,
    cloud,
    caddyfile: generateCaddyfile(cloud),
    nginxConfig: generateNginxConfig(cloud),
  });
});

// ========================
// APP CENTER (DOCKER COMPOSE)
// ========================

router.get('/apps', requireAuth, async (_req, res) => {
  res.json(await listApps());
});

router.post('/apps/:id/install', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  try {
    const installed = await installApp(String(req.params.id), req.user!.username);
    res.status(201).json(installed);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

router.post('/apps/:id/:action', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  try {
    const action = String(req.params.action);
    if (action !== 'start' && action !== 'stop') {
      res.status(400).json({ error: 'Invalid action' });
      return;
    }
    const updated = await toggleAppState(String(req.params.id), action, req.user!.username);
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

router.delete('/apps/:id', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  try {
    await uninstallApp(String(req.params.id), req.user!.username);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

// ========================
// ACCESS CONTROL (AUTO-SYNCS SAMBA & NFS)
// ========================

router.get('/users', requireAuth, (_req, res) => {
  const users = getState().users.map(({ passwordHash: _pw, ...safe }) => safe);
  res.json({ users });
});

router.post('/users', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  const { username, fullName, email, password, role } = req.body as {
    username?: string;
    fullName?: string;
    email?: string;
    password?: string;
    role?: 'admin' | 'user';
  };
  if (!username || !password) {
    res.status(400).json({ error: 'Username and password are required' });
    return;
  }
  const state = getState();
  if (state.users.some((u) => u.username.toLowerCase() === username.toLowerCase())) {
    res.status(409).json({ error: 'Username already exists' });
    return;
  }
  const newUser = {
    id: `u-${Date.now()}`,
    username: username.trim(),
    fullName: (fullName || username).trim(),
    email: (email || `${username}@openqts.local`).trim(),
    role: role === 'admin' ? ('admin' as const) : ('user' as const),
    groups: role === 'admin' ? ['administrators', 'everyone'] : ['everyone'],
    passwordHash: hashPassword(password),
    enabled: true,
    createdAt: new Date().toISOString(),
  };
  state.users.push(newUser);
  saveState(state);
  await syncSambaUser(newUser, password);
  await syncFileSharingServices(req.user!.username);
  addEventLog('success', 'Access', req.user!.username, `Created user "${newUser.username}" (+SMB sync)`);
  const { passwordHash: _pw, ...safe } = newUser;
  res.status(201).json(safe);
});

router.delete('/users/:id', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  const state = getState();
  if (req.params.id === 'u-admin') {
    res.status(400).json({ error: 'Default administrator cannot be deleted' });
    return;
  }
  const idx = state.users.findIndex((u) => u.id === req.params.id);
  if (idx === -1) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  const [removed] = state.users.splice(idx, 1);
  saveState(state);
  await removeSambaUser(removed.username);
  await syncFileSharingServices(req.user!.username);
  addEventLog('warning', 'Access', req.user!.username, `Deleted user "${removed.username}"`);
  res.json({ ok: true });
});

router.get('/shares', requireAuth, (_req, res) => {
  res.json({ shares: getState().shares });
});

router.post('/shares', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  const { name, description, volume, smbEnabled, nfsEnabled, recycleBin } = req.body as {
    name?: string;
    description?: string;
    volume?: string;
    smbEnabled?: boolean;
    nfsEnabled?: boolean;
    recycleBin?: boolean;
  };
  if (!name?.trim()) {
    res.status(400).json({ error: 'Share name is required' });
    return;
  }
  const cleanName = name.trim().replace(/[<>:"/\\|?*]/g, '');
  const state = getState();
  if (state.shares.some((s) => s.name.toLowerCase() === cleanName.toLowerCase())) {
    res.status(409).json({ error: 'Shared folder already exists' });
    return;
  }
  fs.mkdirSync(path.join(STORAGE_ROOT, cleanName), { recursive: true });
  const share = {
    id: `sh-${Date.now()}`,
    name: cleanName,
    path: cleanName,
    volume: volume || 'DataVol1',
    description: description || 'Network shared folder',
    smbEnabled: smbEnabled ?? true,
    nfsEnabled: nfsEnabled ?? false,
    recycleBin: recycleBin ?? true,
    readOnlyUsers: [],
    readWriteUsers: ['admin'],
  };
  state.shares.push(share);
  saveState(state);
  await syncFileSharingServices(req.user!.username);
  addEventLog('success', 'Access', req.user!.username, `Created shared folder "${share.name}" (+SMB/NFS sync)`);
  res.status(201).json(share);
});

router.put('/shares/:id', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  const state = getState();
  const share = state.shares.find((s) => s.id === req.params.id);
  if (!share) {
    res.status(404).json({ error: 'Shared folder not found' });
    return;
  }
  Object.assign(share, req.body);
  saveState(state);
  await syncFileSharingServices(req.user!.username);
  addEventLog('info', 'Access', req.user!.username, `Updated shared folder "${share.name}" (+SMB/NFS sync)`);
  res.json(share);
});

router.delete('/shares/:id', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  const state = getState();
  const idx = state.shares.findIndex((s) => s.id === req.params.id);
  if (idx === -1) {
    res.status(404).json({ error: 'Shared folder not found' });
    return;
  }
  const [removed] = state.shares.splice(idx, 1);
  saveState(state);
  await syncFileSharingServices(req.user!.username);
  addEventLog('warning', 'Access', req.user!.username, `Removed shared folder "${removed.name}"`);
  res.json({ ok: true });
});

router.get('/services', requireAuth, (_req, res) => {
  res.json({ services: getState().services });
});

router.put('/services/:id', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  const state = getState();
  const svc = state.services.find((s) => s.id === req.params.id);
  if (!svc) {
    res.status(404).json({ error: 'Service not found' });
    return;
  }
  const { enabled, port } = req.body as { enabled?: boolean; port?: number };
  if (typeof enabled === 'boolean') {
    svc.enabled = enabled;
    svc.status = enabled ? 'running' : 'stopped';
  }
  if (typeof port === 'number' && port > 0 && port < 65536) {
    svc.port = port;
  }
  saveState(state);
  if (svc.id === 'smb' || svc.id === 'nfs') {
    await syncFileSharingServices(req.user!.username);
  }
  addEventLog(
    'info',
    'Network',
    req.user!.username,
    `${svc.enabled ? 'Enabled' : 'Disabled'} ${svc.name} (port ${svc.port})`
  );
  res.json(svc);
});

export default router;
