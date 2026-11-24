import { useEffect, useState, useRef, useCallback } from 'react';
import {
  Music,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Repeat,
  Shuffle,
  Heart,
  Upload,
  RefreshCw,
  Search,
  FolderOpen,
  Disc3,
  Download,
} from 'lucide-react';
import { api } from '../api/client';
import { useTelemetry } from '../context/TelemetryContext';
import { formatBytes } from '../utils/format';
import type { MusicTrack } from '../types';

function formatAudioTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function MusicStationApp() {
  const { notify, startTask, updateTask } = useTelemetry();
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [view, setView] = useState<'spotlight' | 'library' | 'favorites'>('spotlight');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const [currentTrack, setCurrentTrack] = useState<MusicTrack | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [muted, setMuted] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const loadTracks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getMusicTracks();
      setTracks(res.tracks);
    } catch (err) {
      notify('Music Station 5', (err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    void loadTracks();
  }, [loadTracks]);

  const playTrack = useCallback((track: MusicTrack) => {
    setCurrentTrack(track);
    setPlaying(true);
    setCurrentTime(0);
    window.setTimeout(() => {
      const audio = audioRef.current;
      if (audio) {
        audio.src = api.getRawUrl(track.path);
        audio.volume = muted ? 0 : volume;
        void audio.play().catch(() => setPlaying(false));
      }
    }, 20);
  }, [muted, volume]);

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!currentTrack && tracks.length > 0) {
      playTrack(tracks[0]);
      return;
    }
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      void audio.play().then(() => setPlaying(true)).catch(() => {});
    }
  };

  const playAdjacent = useCallback(
    (dir: 1 | -1) => {
      if (tracks.length === 0) return;
      if (shuffle) {
        const rand = tracks[Math.floor(Math.random() * tracks.length)];
        playTrack(rand);
        return;
      }
      const idx = currentTrack ? tracks.findIndex((t) => t.id === currentTrack.id) : -1;
      const nextIdx = idx === -1 ? 0 : (idx + dir + tracks.length) % tracks.length;
      playTrack(tracks[nextIdx]);
    },
    [tracks, currentTrack, shuffle, playTrack]
  );

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = muted ? 0 : volume;
  }, [volume, muted]);

  const handleToggleFavorite = async (track: MusicTrack) => {
    try {
      const res = await api.toggleFavoriteTrack(track.path);
      setTracks((prev) =>
        prev.map((t) => (t.path === track.path ? { ...t, favorite: res.favorite } : t))
      );
      if (currentTrack?.path === track.path) {
        setCurrentTrack({ ...currentTrack, favorite: res.favorite });
      }
    } catch (err) {
      notify('Music Station 5', (err as Error).message, 'error');
    }
  };

  const handleUploadAudio = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const taskId = startTask(
      `Uploading ${files.length} audio file(s)`,
      'Target: /DataVol1/Media/Music'
    );
    try {
      updateTask(taskId, { progress: 65 });
      await api.uploadFiles('Media/Music', files);
      updateTask(taskId, {
        progress: 100,
        status: 'completed',
        detail: `Added ${files.length} track(s) to Media/Music`,
      });
      notify('Music Station 5', `Uploaded ${files.length} audio file(s) to Media/Music`, 'success');
      await loadTracks();
      setView('library');
    } catch (err) {
      updateTask(taskId, { progress: 100, status: 'error', detail: (err as Error).message });
      notify('Upload Failed', (err as Error).message, 'error');
    } finally {
      if (uploadInputRef.current) uploadInputRef.current.value = '';
    }
  };

  const filtered = tracks.filter((t) => {
    if (view === 'favorites' && !t.favorite) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q) ||
        t.format.toLowerCase().includes(q) ||
        t.folder.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-white">
      <audio
        ref={audioRef}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
        onEnded={() => {
          if (repeat && audioRef.current) {
            audioRef.current.currentTime = 0;
            void audioRef.current.play();
          } else {
            playAdjacent(1);
          }
        }}
      />

      {/* QNAP MusicStation 5 Sub-header (Screenshot 1 match) */}
      <div className="h-12 px-4 border-b border-slate-200 bg-white flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Music className="w-5 h-5 text-[#7c3aed]" />
            <span className="text-[15px] font-semibold text-[#6d28d9] tracking-tight">
              MusicStation <span className="font-normal text-slate-500">5</span>
            </span>
          </div>

          <div className="flex items-center border border-slate-300 rounded overflow-hidden text-xs">
            {(
              [
                ['spotlight', 'Spotlight'],
                ['library', `Library (${tracks.length})`],
                ['favorites', 'Favorites'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setView(id)}
                className={`px-3 py-1 font-medium transition-colors ${
                  view === id
                    ? 'bg-[#7c3aed] text-white'
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
              onChange={(e) => {
                setSearch(e.target.value);
                if (view === 'spotlight') setView('library');
              }}
              placeholder="Search tracks, FLAC, MP3..."
              className="w-48 bg-slate-50 border border-slate-300 rounded pl-8 pr-2.5 py-1 text-xs text-slate-800 outline-none focus:border-purple-500"
            />
          </div>

          <input
            ref={uploadInputRef}
            type="file"
            multiple
            accept=".mp3,.flac,.wav,.ogg,.m4a,.aac,audio/*"
            className="hidden"
            onChange={(e) => void handleUploadAudio(e.target.files)}
          />
          <button
            type="button"
            onClick={() => uploadInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-xs font-medium"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Music</span>
          </button>
          <button
            type="button"
            onClick={() => void loadTracks()}
            title="Rescan Media folder"
            className="p-1.5 rounded hover:bg-slate-100 text-slate-600"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto">
        {view === 'spotlight' ? (
          <div className="min-h-full bg-gradient-to-br from-[#3b1c6d] via-[#4a2885] to-[#1e5c7a] text-white p-7 flex flex-col items-center justify-center">
            <div className="text-center max-w-2xl mb-8">
              <h2 className="text-3xl font-light tracking-tight">Welcome to Music Station 5</h2>
              <p className="text-xs text-white/80 mt-2 leading-relaxed">
                Stream lossless FLAC, WAV, and MP3 tracks directly from your NAS{' '}
                <code className="bg-black/25 px-1.5 py-0.5 rounded">/Media/Music</code> folder to
                any browser on your LAN or over myQNAPcloud.
              </p>
            </div>

            {/* 5 QNAP Music Station Spotlight Tiles (matching Screenshot 1) */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5 w-full max-w-4xl">
              {[
                {
                  title: 'Random 100',
                  sub: 'Shuffle all songs',
                  bg: 'from-teal-700/80 to-emerald-900/80',
                  onClick: () => {
                    setShuffle(true);
                    setView('library');
                    if (tracks.length > 0) playTrack(tracks[0]);
                  },
                },
                {
                  title: 'Recently Added',
                  sub: `${tracks.length} track(s)`,
                  bg: 'from-amber-600/80 to-amber-900/80',
                  onClick: () => setView('library'),
                },
                {
                  title: 'Play All Media',
                  sub: 'MP3 / FLAC / WAV',
                  bg: 'from-lime-700/80 to-emerald-900/80',
                  onClick: () => {
                    setView('library');
                    if (tracks.length > 0) playTrack(tracks[0]);
                  },
                },
                {
                  title: 'My Favorites',
                  sub: `${tracks.filter((t) => t.favorite).length} starred`,
                  bg: 'from-cyan-700/80 to-slate-800/80',
                  onClick: () => setView('favorites'),
                },
                {
                  title: 'Add Songs',
                  sub: 'Upload to Media/',
                  bg: 'from-emerald-700/80 to-teal-900/80',
                  onClick: () => uploadInputRef.current?.click(),
                },
              ].map((card) => (
                <button
                  key={card.title}
                  type="button"
                  onClick={card.onClick}
                  className={`h-32 rounded bg-gradient-to-br ${card.bg} border border-white/15 hover:border-white/40 p-4 flex flex-col items-center justify-center text-center transition-colors duration-100`}
                >
                  <span className="text-sm font-medium text-white">{card.title}</span>
                  <span className="text-[11px] text-white/75 mt-1">{card.sub}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-4">
            {filtered.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
                <FolderOpen className="w-10 h-10 opacity-30" />
                <span>No audio files found. Upload .mp3, .flac, or .wav files into Media/Music.</span>
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#f4f6f9] text-slate-600 border-b border-slate-200">
                    <th className="py-2 px-3 w-10">#</th>
                    <th className="py-2 px-3 font-medium">Title</th>
                    <th className="py-2 px-3 font-medium">Artist / Folder</th>
                    <th className="py-2 px-3 font-medium w-20">Format</th>
                    <th className="py-2 px-3 font-medium w-24 text-right">Size</th>
                    <th className="py-2 px-3 font-medium w-20 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((t, idx) => {
                    const active = currentTrack?.id === t.id;
                    return (
                      <tr
                        key={t.id}
                        onDoubleClick={() => playTrack(t)}
                        className={`cursor-pointer ${
                          active
                            ? 'bg-purple-50 text-purple-900 font-medium'
                            : 'hover:bg-slate-50 text-slate-800'
                        }`}
                      >
                        <td className="py-2 px-3">
                          <button
                            type="button"
                            onClick={() => (active ? togglePlayPause() : playTrack(t))}
                            className="w-6 h-6 rounded-full bg-purple-100 hover:bg-purple-600 hover:text-white text-purple-700 flex items-center justify-center transition-colors"
                          >
                            {active && playing ? (
                              <Pause className="w-3 h-3" />
                            ) : (
                              <Play className="w-3 h-3 ml-0.5" />
                            )}
                          </button>
                        </td>
                        <td className="py-2 px-3">
                          <div className="truncate max-w-xs">{t.title}</div>
                          <div className="text-[10px] text-slate-400 truncate">/{t.path}</div>
                        </td>
                        <td className="py-2 px-3 text-slate-600">{t.artist}</td>
                        <td className="py-2 px-3">
                          <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 font-mono text-[10px] font-semibold">
                            {t.format}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-slate-500 text-right tabular-nums">
                          {formatBytes(t.size)}
                        </td>
                        <td className="py-2 px-3 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => void handleToggleFavorite(t)}
                              className="p-1 text-slate-400 hover:text-rose-500"
                              title="Favorite"
                            >
                              <Heart
                                className={`w-3.5 h-3.5 ${
                                  t.favorite ? 'fill-rose-500 text-rose-500' : ''
                                }`}
                              />
                            </button>
                            <a
                              href={api.getDownloadUrl(t.path)}
                              className="p-1 text-slate-400 hover:text-blue-600"
                              title="Download"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* QNAP MusicStation 5 Dark Audio Transport Bar (Screenshot 1 match) */}
      <div className="h-[66px] bg-[#1e232d] text-slate-200 border-t border-slate-700 px-4 flex items-center justify-between gap-4 shrink-0">
        {/* Controls */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => playAdjacent(-1)}
            className="p-1.5 text-slate-300 hover:text-white"
            title="Previous"
          >
            <SkipBack className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={togglePlayPause}
            className="w-9 h-9 rounded-full border border-white/50 hover:border-white flex items-center justify-center text-white"
            title={playing ? 'Pause' : 'Play'}
          >
            {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </button>
          <button
            type="button"
            onClick={() => playAdjacent(1)}
            className="p-1.5 text-slate-300 hover:text-white"
            title="Next"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </div>

        {/* Now Playing & Seek Bar */}
        <div className="flex-1 min-w-0 max-w-xl">
          <div className="flex items-center justify-between text-xs mb-1 gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Disc3
                className={`w-4 h-4 text-purple-400 shrink-0 ${playing ? 'animate-spin' : ''}`}
              />
              <span className="truncate font-medium text-white">
                {currentTrack ? `${currentTrack.title} — ${currentTrack.artist}` : 'No track playing'}
              </span>
              {currentTrack && (
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-600/40 text-purple-200 font-mono">
                  {currentTrack.format}
                </span>
              )}
            </div>
            <span className="text-[11px] text-slate-400 tabular-nums shrink-0">
              {formatAudioTime(currentTime)} / {formatAudioTime(duration)}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={currentTime}
            onChange={(e) => {
              const next = Number(e.target.value);
              setCurrentTime(next);
              if (audioRef.current) audioRef.current.currentTime = next;
            }}
            className="w-full h-1 accent-purple-500 cursor-pointer"
          />
        </div>

        {/* Volume & Modes */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setShuffle((v) => !v)}
            className={`p-1 ${shuffle ? 'text-purple-400' : 'text-slate-400 hover:text-white'}`}
            title="Shuffle"
          >
            <Shuffle className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setRepeat((v) => !v)}
            className={`p-1 ${repeat ? 'text-purple-400' : 'text-slate-400 hover:text-white'}`}
            title="Repeat Track"
          >
            <Repeat className="w-3.5 h-3.5" />
          </button>
          <div className="hidden sm:flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setMuted((m) => !m)}
              className="text-slate-300 hover:text-white"
            >
              {muted || volume === 0 ? (
                <VolumeX className="w-4 h-4" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={(e) => {
                setMuted(false);
                setVolume(Number(e.target.value));
              }}
              className="w-20 h-1 accent-sky-400 cursor-pointer"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
