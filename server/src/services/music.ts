import fs from 'node:fs';
import path from 'node:path';
import { STORAGE_ROOT, getState, saveState } from '../store.js';

export interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  fileName: string;
  path: string; // relative posix path from STORAGE_ROOT
  folder: string;
  format: string;
  size: number;
  modifiedAt: string;
  favorite: boolean;
}

const AUDIO_EXTENSIONS = new Set(['mp3', 'flac', 'wav', 'ogg', 'm4a', 'aac', 'opus']);

export function getAudioMimeType(filePath: string): string {
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
    default:
      return 'application/octet-stream';
  }
}

function parseTrackMeta(fileName: string, folderName: string) {
  const base = fileName.replace(/\.[^.]+$/, '');
  const cleaned = base.replace(/^\d+\s*[-._]\s*/, '');
  const dashSplit = cleaned.split(/\s+-\s+/);
  if (dashSplit.length >= 2) {
    return {
      artist: dashSplit[0].trim() || 'Unknown Artist',
      title: dashSplit.slice(1).join(' - ').trim() || cleaned,
      album: folderName || 'Media Library',
    };
  }
  return {
    artist: folderName === 'Music' || !folderName ? 'Local NAS Library' : folderName,
    title: cleaned || base,
    album: folderName || 'Media Library',
  };
}

export function scanMusicLibrary(): MusicTrack[] {
  const state = getState();
  const favSet = new Set(state.favoriteTracks || []);
  const tracks: MusicTrack[] = [];

  // Scan Media/ primarily, and also Public/ if users drop songs there
  const scanRoots = ['Media', 'Public', 'Downloads']
    .map((dir) => path.join(STORAGE_ROOT, dir))
    .filter((p) => fs.existsSync(p));

  function walk(dir: string, depth: number) {
    if (depth > 6 || tracks.length >= 500) return;
    let items: fs.Dirent[];
    try {
      items = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const item of items) {
      const full = path.join(dir, item.name);
      if (item.isDirectory()) {
        walk(full, depth + 1);
      } else {
        const ext = path.extname(item.name).toLowerCase().replace(/^\./, '');
        if (!AUDIO_EXTENSIONS.has(ext)) continue;
        try {
          const st = fs.statSync(full);
          const relPosix = path.relative(STORAGE_ROOT, full).split(path.sep).join('/');
          const folderName = path.basename(path.dirname(full));
          const meta = parseTrackMeta(item.name, folderName);
          tracks.push({
            id: Buffer.from(relPosix).toString('base64url'),
            title: meta.title,
            artist: meta.artist,
            album: meta.album,
            fileName: item.name,
            path: relPosix,
            folder: path.posix.dirname(relPosix),
            format: ext.toUpperCase(),
            size: st.size,
            modifiedAt: st.mtime.toISOString(),
            favorite: favSet.has(relPosix),
          });
        } catch {
          // ignore unreadable files
        }
      }
    }
  }

  for (const root of scanRoots) {
    walk(root, 0);
  }

  tracks.sort((a, b) => a.fileName.localeCompare(b.fileName, undefined, { sensitivity: 'base' }));
  return tracks;
}

export function toggleFavoriteTrack(relPath: string): boolean {
  const state = getState();
  const list = state.favoriteTracks || [];
  const idx = list.indexOf(relPath);
  let isFav = false;
  if (idx >= 0) {
    list.splice(idx, 1);
    isFav = false;
  } else {
    list.push(relPath);
    isFav = true;
  }
  state.favoriteTracks = list;
  saveState(state);
  return isFav;
}
