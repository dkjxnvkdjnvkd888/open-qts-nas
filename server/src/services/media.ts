import fs from 'node:fs';
import path from 'node:path';
import { STORAGE_ROOT } from '../store.js';

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

const PHOTO_EXTS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'svg']);
const VIDEO_EXTS = new Set(['mp4', 'webm', 'mkv', 'mov', 'm4v', 'avi']);

export function getMediaMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase().replace(/^\./, '');
  switch (ext) {
    case 'mp3':
      return 'audio/mpeg';
    case 'flac':
      return 'audio/flac';
    case 'wav':
      return 'audio/wav';
    case 'ogg':
    case 'opus':
      return 'audio/ogg';
    case 'm4a':
    case 'aac':
      return 'audio/mp4';
    case 'mp4':
    case 'm4v':
      return 'video/mp4';
    case 'webm':
      return 'video/webm';
    case 'mkv':
      return 'video/x-matroska';
    case 'mov':
      return 'video/quicktime';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    case 'svg':
      return 'image/svg+xml';
    default:
      return 'application/octet-stream';
  }
}

export function scanMultimediaLibrary(): MediaItem[] {
  const items: MediaItem[] = [];
  const roots = ['Media', 'Public', 'Downloads']
    .map((d) => path.join(STORAGE_ROOT, d))
    .filter((p) => fs.existsSync(p));

  function walk(dir: string, depth: number) {
    if (depth > 6 || items.length >= 600) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full, depth + 1);
      } else {
        const ext = path.extname(entry.name).toLowerCase().replace(/^\./, '');
        const kind = PHOTO_EXTS.has(ext)
          ? 'photo'
          : VIDEO_EXTS.has(ext)
          ? 'video'
          : null;
        if (!kind) continue;
        try {
          const st = fs.statSync(full);
          const relPosix = path.relative(STORAGE_ROOT, full).split(path.sep).join('/');
          items.push({
            id: Buffer.from(relPosix).toString('base64url'),
            kind,
            name: entry.name,
            path: relPosix,
            folder: path.posix.dirname(relPosix),
            format: ext.toUpperCase(),
            size: st.size,
            modifiedAt: st.mtime.toISOString(),
          });
        } catch {
          // ignore
        }
      }
    }
  }

  for (const r of roots) {
    walk(r, 0);
  }

  items.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
  return items;
}
