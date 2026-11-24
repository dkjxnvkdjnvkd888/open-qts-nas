import { useEffect, useState, useRef, useCallback } from 'react';
import {
  Image as ImageIcon,
  Film,
  Upload,
  RefreshCw,
  Search,
  X,
  Download,
  Play,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { api } from '../api/client';
import { useTelemetry } from '../context/TelemetryContext';
import { formatBytes, formatDateTime } from '../utils/format';
import type { MediaItem } from '../types';

export function MultimediaStationApp() {
  const { notify, startTask, updateTask } = useTelemetry();
  const [items, setItems] = useState<MediaItem[]>([]);
  const [filter, setFilter] = useState<'all' | 'photo' | 'video'>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const loadMedia = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getMediaItems();
      setItems(res.items);
    } catch (err) {
      notify('QuMagie Media', (err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    void loadMedia();
  }, [loadMedia]);

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const isVideo = Array.from(files).some((f) => f.type.startsWith('video/'));
    const dest = isVideo ? 'Media/Movies' : 'Media/Photos';
    const taskId = startTask(`Uploading ${files.length} media file(s)`, `Target: /DataVol1/${dest}`);
    try {
      updateTask(taskId, { progress: 65 });
      await api.uploadFiles(dest, files);
      updateTask(taskId, {
        progress: 100,
        status: 'completed',
        detail: `Uploaded ${files.length} item(s) to ${dest}`,
      });
      notify('QuMagie Media', `Uploaded ${files.length} item(s) to ${dest}`, 'success');
      await loadMedia();
    } catch (err) {
      updateTask(taskId, { progress: 100, status: 'error', detail: (err as Error).message });
      notify('Upload Failed', (err as Error).message, 'error');
    } finally {
      if (uploadInputRef.current) uploadInputRef.current.value = '';
    }
  };

  const filtered = items.filter((item) => {
    if (filter !== 'all' && item.kind !== filter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return item.name.toLowerCase().includes(q) || item.folder.toLowerCase().includes(q);
    }
    return true;
  });

  const activeItem = activeIndex !== null ? filtered[activeIndex] || null : null;

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-white">
      {/* Header Bar */}
      <div className="h-12 px-4 border-b border-slate-200 bg-white flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Film className="w-5 h-5 text-[#db2777]" />
            <span className="text-[15px] font-semibold text-slate-900 tracking-tight">
              QuMagie <span className="font-normal text-slate-500">Photo &amp; Video</span>
            </span>
          </div>

          <div className="flex items-center border border-slate-300 rounded overflow-hidden text-xs">
            {(
              [
                ['all', `All (${items.length})`],
                ['photo', `Photos (${items.filter((i) => i.kind === 'photo').length})`],
                ['video', `Videos (${items.filter((i) => i.kind === 'video').length})`],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setFilter(id);
                  setActiveIndex(null);
                }}
                className={`px-3 py-1 font-medium transition-colors ${
                  filter === id
                    ? 'bg-[#db2777] text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-100'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative hidden sm:block">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search photos & videos..."
              className="w-44 bg-slate-50 border border-slate-300 rounded pl-8 pr-2.5 py-1 text-xs outline-none focus:border-pink-500"
            />
          </div>

          <input
            ref={uploadInputRef}
            type="file"
            multiple
            accept="image/*,video/*,.mp4,.webm,.mkv,.mov"
            className="hidden"
            onChange={(e) => void handleUpload(e.target.files)}
          />
          <button
            type="button"
            onClick={() => uploadInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#db2777] hover:bg-[#be185d] text-white text-xs font-medium"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Media</span>
          </button>
          <button
            type="button"
            onClick={() => void loadMedia()}
            className="p-1.5 rounded hover:bg-slate-100 text-slate-600"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Gallery Grid */}
      <div className="flex-1 overflow-y-auto p-4 bg-[#f8f9fb]">
        {filtered.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs gap-2">
            <ImageIcon className="w-10 h-10 opacity-30" />
            <span>
              No photos or videos found. Upload images or MP4/WebM movies into Media/Photos or
              Media/Movies.
            </span>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
            {filtered.map((item, idx) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveIndex(idx)}
                className="bg-white border border-slate-200 hover:border-pink-400 rounded overflow-hidden text-left flex flex-col transition-colors"
              >
                <div className="aspect-[16/10] bg-slate-900 relative overflow-hidden flex items-center justify-center">
                  {item.kind === 'photo' ? (
                    <img
                      src={api.getRawUrl(item.path)}
                      alt={item.name}
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-1.5 text-white">
                      <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                        <Play className="w-5 h-5 ml-0.5" />
                      </div>
                      <span className="text-[10px] font-mono uppercase bg-black/40 px-1.5 py-0.5 rounded">
                        {item.format} Video
                      </span>
                    </div>
                  )}
                  <span className="absolute top-1.5 right-1.5 text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded bg-black/65 text-white">
                    {item.format}
                  </span>
                </div>
                <div className="p-2.5">
                  <div className="text-xs font-medium text-slate-900 truncate">{item.name}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5 flex justify-between">
                    <span className="truncate">{item.folder}</span>
                    <span className="tabular-nums shrink-0 ml-2">{formatBytes(item.size)}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox & HTML5 Video Streamer Modal */}
      {activeItem && activeIndex !== null && (
        <div className="fixed inset-0 z-[85] bg-black/85 flex flex-col">
          <div className="h-12 px-5 bg-[#121629] text-white flex items-center justify-between border-b border-white/10">
            <div className="min-w-0">
              <div className="text-xs font-semibold truncate">{activeItem.name}</div>
              <div className="text-[10px] text-slate-400">
                /{activeItem.path} · {formatBytes(activeItem.size)} ·{' '}
                {formatDateTime(activeItem.modifiedAt)}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <a
                href={api.getDownloadUrl(activeItem.path)}
                className="inline-flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download</span>
              </a>
              <button
                type="button"
                onClick={() => setActiveIndex(null)}
                className="p-1.5 rounded hover:bg-white/10 text-slate-300 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 min-h-0 relative flex items-center justify-center p-6">
            {activeIndex > 0 && (
              <button
                type="button"
                onClick={() => setActiveIndex(activeIndex - 1)}
                className="absolute left-4 p-2 rounded-full bg-white/10 hover:bg-white/25 text-white"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}

            {activeItem.kind === 'photo' ? (
              <img
                src={api.getRawUrl(activeItem.path)}
                alt={activeItem.name}
                className="max-h-full max-w-full object-contain rounded"
              />
            ) : (
              <video
                key={activeItem.id}
                src={api.getRawUrl(activeItem.path)}
                controls
                autoPlay
                className="max-h-full max-w-full rounded bg-black"
              />
            )}

            {activeIndex < filtered.length - 1 && (
              <button
                type="button"
                onClick={() => setActiveIndex(activeIndex + 1)}
                className="absolute right-4 p-2 rounded-full bg-white/10 hover:bg-white/25 text-white"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
