import {
  Settings,
  Folder,
  Database,
  Cloud,
  LayoutGrid,
  Gauge,
  Music,
  Film,
} from 'lucide-react';
import type { AppWindowId } from '../types';

export function AppBadgeIcon({
  id,
  size = 'md',
}: {
  id: AppWindowId;
  size?: 'xs' | 'sm' | 'md' | 'lg';
}) {
  const dims =
    size === 'xs'
      ? 'w-5 h-5 rounded-[4px]'
      : size === 'sm'
      ? 'w-7 h-7 rounded-md'
      : size === 'lg'
      ? 'w-[60px] h-[60px] rounded-[14px]'
      : 'w-9 h-9 rounded-lg';

  const glyph =
    size === 'xs'
      ? 'w-3 h-3'
      : size === 'sm'
      ? 'w-4 h-4'
      : size === 'lg'
      ? 'w-8 h-8'
      : 'w-5 h-5';

  switch (id) {
    case 'control-panel':
      return (
        <div
          className={`${dims} bg-gradient-to-b from-white to-slate-200 flex items-center justify-center text-slate-700 shadow-qts-icon border border-black/10 shrink-0`}
        >
          <Settings className={glyph} strokeWidth={2.2} />
        </div>
      );
    case 'file-station':
      return (
        <div
          className={`${dims} bg-gradient-to-b from-[#ff981a] to-[#e66b00] flex items-center justify-center text-white shadow-qts-icon border border-black/10 shrink-0`}
        >
          <Folder className={`${glyph} fill-white/95`} strokeWidth={1.8} />
        </div>
      );
    case 'storage-snapshots':
      return (
        <div
          className={`${dims} bg-gradient-to-b from-white to-slate-100 flex items-center justify-center text-[#1d63dc] shadow-qts-icon border border-black/10 shrink-0`}
        >
          <Database className={glyph} strokeWidth={2.1} />
        </div>
      );
    case 'myqnapcloud':
      return (
        <div
          className={`${dims} bg-gradient-to-b from-white to-slate-100 flex items-center justify-center text-[#2563eb] shadow-qts-icon border border-black/10 shrink-0`}
        >
          <Cloud className={glyph} strokeWidth={2.3} />
        </div>
      );
    case 'app-center':
      return (
        <div
          className={`${dims} bg-gradient-to-br from-[#ec4899] via-[#f97316] to-[#facc15] flex items-center justify-center text-white shadow-qts-icon border border-black/10 shrink-0`}
        >
          <LayoutGrid className={glyph} strokeWidth={2.2} />
        </div>
      );
    case 'resource-monitor':
      return (
        <div
          className={`${dims} bg-gradient-to-b from-white to-slate-100 flex items-center justify-center text-[#059669] shadow-qts-icon border border-black/10 shrink-0`}
        >
          <Gauge className={glyph} strokeWidth={2.2} />
        </div>
      );
    case 'music-station':
      return (
        <div
          className={`${dims} bg-gradient-to-b from-[#8b5cf6] to-[#6d28d9] flex items-center justify-center text-white shadow-qts-icon border border-black/10 shrink-0`}
        >
          <Music className={glyph} strokeWidth={2.2} />
        </div>
      );
    case 'photo-video':
      return (
        <div
          className={`${dims} bg-gradient-to-br from-[#ec4899] via-[#a855f7] to-[#0ea5e9] flex items-center justify-center text-white shadow-qts-icon border border-black/10 shrink-0`}
        >
          <Film className={glyph} strokeWidth={2.1} />
        </div>
      );
  }
}
