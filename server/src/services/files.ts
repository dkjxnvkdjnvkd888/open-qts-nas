import fs from 'node:fs';
import path from 'node:path';
import { STORAGE_ROOT, addEventLog } from '../store.js';

export interface FileEntry {
  name: string;
  path: string; // normalized relative posix path from STORAGE_ROOT
  isDirectory: boolean;
  size: number;
  modifiedAt: string;
  extension: string;
}

export function resolveSafePath(relPath = ''): string {
  const cleaned = relPath.replace(/\\/g, '/').replace(/^\/+/, '');
  const resolved = path.resolve(STORAGE_ROOT, cleaned);
  const rootResolved = path.resolve(STORAGE_ROOT);
  if (
    resolved !== rootResolved &&
    !resolved.startsWith(rootResolved + path.sep)
  ) {
    throw new Error('Access denied: path outside NAS storage root');
  }
  return resolved;
}

function toRelPosix(absPath: string): string {
  const rel = path.relative(STORAGE_ROOT, absPath);
  return rel.split(path.sep).join('/');
}

export function listDirectory(relPath = ''): FileEntry[] {
  const dir = resolveSafePath(relPath);
  if (!fs.existsSync(dir)) {
    throw new Error('Directory does not exist');
  }
  const stat = fs.statSync(dir);
  if (!stat.isDirectory()) {
    throw new Error('Path is not a directory');
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const results: FileEntry[] = [];

  for (const dirent of entries) {
    const full = path.join(dir, dirent.name);
    try {
      const st = fs.statSync(full);
      results.push({
        name: dirent.name,
        path: toRelPosix(full),
        isDirectory: dirent.isDirectory(),
        size: dirent.isDirectory() ? 0 : st.size,
        modifiedAt: st.mtime.toISOString(),
        extension: dirent.isDirectory()
          ? ''
          : path.extname(dirent.name).toLowerCase().replace(/^\./, ''),
      });
    } catch {
      // Skip unreadable entries
    }
  }

  results.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });

  return results;
}

export function createFolder(parentRelPath: string, folderName: string, actor: string): FileEntry {
  const safeName = folderName.trim().replace(/[<>:"/\\|?*]/g, '');
  if (!safeName || safeName === '.' || safeName === '..') {
    throw new Error('Invalid folder name');
  }
  const target = resolveSafePath(path.posix.join(parentRelPath || '', safeName));
  if (fs.existsSync(target)) {
    throw new Error('Folder or file with this name already exists');
  }
  fs.mkdirSync(target, { recursive: true });
  const st = fs.statSync(target);
  addEventLog('info', 'Storage', actor, `Created folder /${toRelPosix(target)}`);
  return {
    name: safeName,
    path: toRelPosix(target),
    isDirectory: true,
    size: 0,
    modifiedAt: st.mtime.toISOString(),
    extension: '',
  };
}

export function renameEntry(relPath: string, newName: string, actor: string): FileEntry {
  const safeName = newName.trim().replace(/[<>:"/\\|?*]/g, '');
  if (!safeName || safeName === '.' || safeName === '..') {
    throw new Error('Invalid new name');
  }
  const source = resolveSafePath(relPath);
  if (source === path.resolve(STORAGE_ROOT)) {
    throw new Error('Cannot rename NAS root');
  }
  const target = path.join(path.dirname(source), safeName);
  const rootResolved = path.resolve(STORAGE_ROOT);
  if (!target.startsWith(rootResolved + path.sep)) {
    throw new Error('Invalid destination');
  }
  if (fs.existsSync(target)) {
    throw new Error('An item with that name already exists');
  }
  fs.renameSync(source, target);
  const st = fs.statSync(target);
  addEventLog('info', 'Storage', actor, `Renamed /${relPath} to ${safeName}`);
  return {
    name: safeName,
    path: toRelPosix(target),
    isDirectory: st.isDirectory(),
    size: st.isDirectory() ? 0 : st.size,
    modifiedAt: st.mtime.toISOString(),
    extension: st.isDirectory()
      ? ''
      : path.extname(safeName).toLowerCase().replace(/^\./, ''),
  };
}

export function deleteEntry(relPath: string, actor: string): void {
  const target = resolveSafePath(relPath);
  if (target === path.resolve(STORAGE_ROOT)) {
    throw new Error('Cannot delete NAS root');
  }
  if (!fs.existsSync(target)) {
    throw new Error('Item not found');
  }
  fs.rmSync(target, { recursive: true, force: true });
  addEventLog('warning', 'Storage', actor, `Deleted /${relPath}`);
}

export function readTextPreview(relPath: string): { content: string; truncated: boolean; size: number } {
  const target = resolveSafePath(relPath);
  const st = fs.statSync(target);
  if (st.isDirectory()) {
    throw new Error('Cannot preview a directory');
  }
  const MAX_BYTES = 128 * 1024;
  const fd = fs.openSync(target, 'r');
  try {
    const len = Math.min(st.size, MAX_BYTES);
    const buf = Buffer.alloc(len);
    fs.readSync(fd, buf, 0, len, 0);
    return {
      content: buf.toString('utf-8'),
      truncated: st.size > MAX_BYTES,
      size: st.size,
    };
  } finally {
    fs.closeSync(fd);
  }
}

export function searchFiles(query: string, baseRelPath = ''): FileEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const startDir = resolveSafePath(baseRelPath);
  const matches: FileEntry[] = [];

  function walk(dir: string, depth: number) {
    if (depth > 5 || matches.length >= 100) return;
    let items: fs.Dirent[];
    try {
      items = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const item of items) {
      const full = path.join(dir, item.name);
      if (item.name.toLowerCase().includes(q)) {
        try {
          const st = fs.statSync(full);
          matches.push({
            name: item.name,
            path: toRelPosix(full),
            isDirectory: item.isDirectory(),
            size: item.isDirectory() ? 0 : st.size,
            modifiedAt: st.mtime.toISOString(),
            extension: item.isDirectory()
              ? ''
              : path.extname(item.name).toLowerCase().replace(/^\./, ''),
          });
        } catch {
          // ignore
        }
      }
      if (item.isDirectory()) {
        walk(full, depth + 1);
      }
    }
  }

  walk(startDir, 0);
  return matches;
}
