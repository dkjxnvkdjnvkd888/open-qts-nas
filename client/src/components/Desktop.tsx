import React, { useState, useEffect } from 'react';
import {
  FolderOpen,
  Settings,
  RefreshCw,
  Trash2,
  Cloud,
  Music,
  Gauge,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useWindowManager, APP_DEFINITIONS } from '../context/WindowManagerContext';
import { TopBar } from './TopBar';
import { Window } from './Window';
import { QboostWidget } from './QboostWidget';
import { ToastStack } from './ToastStack';
import { AppBadgeIcon } from './AppIcon';
import { ControlPanelApp } from '../apps/ControlPanelApp';
import { FileStationApp } from '../apps/FileStationApp';
import { StorageSnapshotsApp } from '../apps/StorageSnapshotsApp';
import { MyQnapCloudApp } from '../apps/MyQnapCloudApp';
import { AppCenterApp } from '../apps/AppCenterApp';
import { ResourceMonitorApp } from '../apps/ResourceMonitorApp';
import { MusicStationApp } from '../apps/MusicStationApp';
import { MultimediaStationApp } from '../apps/MultimediaStationApp';
import type { AppWindowId } from '../types';

const DESKTOP_APPS: AppWindowId[] = [
  'control-panel',
  'file-station',
  'storage-snapshots',
  'myqnapcloud',
  'app-center',
  'resource-monitor',
  'music-station',
  'photo-video',
];

function renderAppBody(id: AppWindowId) {
  switch (id) {
    case 'control-panel':
      return <ControlPanelApp />;
    case 'file-station':
      return <FileStationApp />;
    case 'storage-snapshots':
      return <StorageSnapshotsApp />;
    case 'myqnapcloud':
      return <MyQnapCloudApp />;
    case 'app-center':
      return <AppCenterApp />;
    case 'resource-monitor':
      return <ResourceMonitorApp />;
    case 'music-station':
      return <MusicStationApp />;
    case 'photo-video':
      return <MultimediaStationApp />;
  }
}

export function Desktop() {
  const { settings, updateSettings } = useAuth();
  const { windows, openWindow } = useWindowManager();
  const [selectedIcon, setSelectedIcon] = useState<AppWindowId | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const close = () => setContextMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, []);

  const handleContextMenu = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-window="true"]')) return;
    e.preventDefault();
    const x = Math.min(e.clientX, window.innerWidth - 210);
    const y = Math.min(e.clientY, window.innerHeight - 210);
    setContextMenu({ x, y });
  };

  const wallpaperId = settings?.wallpaper || 'qts-wave';
  const wallpaperClass = wallpaperId.startsWith('qts-')
    ? `wallpaper-${wallpaperId}`
    : 'wallpaper-qts-wave';

  return (
    <div
      onContextMenu={handleContextMenu}
      onClick={() => setSelectedIcon(null)}
      className={`w-full h-full ${wallpaperClass} relative overflow-hidden`}
    >
      {/* Authentic QNAP QTS 5.x Smooth Flowing Wave SVG Backdrop (matching Screenshot 2) */}
      <svg
        viewBox="0 0 1440 900"
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-full pointer-events-none"
      >
        <defs>
          <linearGradient id="qtsWave1" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.48" />
            <stop offset="50%" stopColor="#06b6d4" stopOpacity="0.42" />
            <stop offset="100%" stopColor="#67e8f9" stopOpacity="0.52" />
          </linearGradient>
          <linearGradient id="qtsWave2" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.25" />
          </linearGradient>
        </defs>
        <path
          d="M0,255 C240,145 480,335 760,260 C1020,190 1240,320 1440,360 L1440,545 C1200,490 950,420 680,480 C400,545 190,460 0,510 Z"
          fill="url(#qtsWave1)"
        />
        <path
          d="M0,470 C290,390 610,560 960,460 C1180,398 1330,435 1440,465 L1440,900 L0,900 Z"
          fill="url(#qtsWave2)"
        />
      </svg>

      {/* Top QTS Taskbar & Slide-Out Main Menu Drawer */}
      <TopBar />

      {/* Top-Left Aligned QTS 5.x Desktop Icon Grid (zero bounce, crisp OS feel) */}
      <main className="relative z-10 pt-20 pl-10 pr-8 pb-20 h-full overflow-y-auto">
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-x-5 gap-y-7 max-w-4xl">
          {DESKTOP_APPS.map((id) => {
            const def = APP_DEFINITIONS[id];
            const isSelected = selectedIcon === id;
            return (
              <button
                key={id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedIcon(id);
                  openWindow(id);
                }}
                className={`flex flex-col items-center gap-2 p-2 rounded transition-colors duration-100 focus:outline-none ${
                  isSelected
                    ? 'bg-white/20 ring-1 ring-white/40'
                    : 'hover:bg-white/10'
                }`}
              >
                <AppBadgeIcon id={id} size="lg" />
                <span className="text-[12px] font-medium text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)] text-center leading-tight max-w-[104px]">
                  {def.title}
                </span>
              </button>
            );
          })}
        </div>
      </main>

      {/* Bottom-Left Recycle Bin & OpenQTS Brand Watermark (matching Screenshot 2) */}
      <div className="fixed bottom-5 left-6 z-10 flex flex-col items-start gap-3">
        <button
          type="button"
          onClick={() => openWindow('file-station')}
          title="Network Recycle Bin"
          className="p-2 rounded text-white/80 hover:text-white hover:bg-white/10 transition-colors"
        >
          <Trash2 className="w-7 h-7" strokeWidth={1.4} />
        </button>
        <div className="text-xl font-light tracking-wide text-white/75 select-none pointer-events-none">
          Open<span className="font-semibold text-white/90">QTS</span>
          <span className="text-xs ml-1.5 text-white/55">5.2</span>
        </div>
      </div>

      {/* Bottom-Center QTS Quick Bar Dots & Utility Icons (matching Screenshot 2) */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-10 hidden sm:flex flex-col items-center gap-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-white" />
          <span className="w-1.5 h-1.5 rounded-full bg-white/40" />
          <span className="w-1.5 h-1.5 rounded-full bg-white/40" />
        </div>
        <div className="flex items-center gap-2 text-white/80">
          <button
            type="button"
            onClick={() => openWindow('myqnapcloud')}
            title="myQNAPcloud"
            className="w-6 h-6 rounded-full border border-white/40 flex items-center justify-center hover:bg-white/15"
          >
            <Cloud className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => openWindow('resource-monitor')}
            title="Resource Monitor"
            className="w-6 h-6 rounded-full border border-white/40 flex items-center justify-center hover:bg-white/15"
          >
            <Gauge className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => openWindow('music-station')}
            title="Music Station 5"
            className="w-6 h-6 rounded-full border border-white/40 flex items-center justify-center hover:bg-white/15"
          >
            <Music className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Floating Circular Qboost RAM/CPU Widget at Bottom-Right */}
      <QboostWidget />

      {/* Multi-Window Desktop Layer */}
      {windows.map((win) => (
        <div key={win.id} data-window="true">
          <Window win={win}>{renderAppBody(win.id)}</Window>
        </div>
      ))}

      {/* Desktop Right-Click Context Menu */}
      {contextMenu && (
        <div
          style={{ left: contextMenu.x, top: contextMenu.y }}
          className="fixed z-[85] w-52 bg-white text-slate-800 rounded shadow-2xl border border-slate-200 py-1 text-xs qts-popover-in"
        >
          <button
            type="button"
            onClick={() => openWindow('file-station')}
            className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-slate-100 text-left"
          >
            <FolderOpen className="w-3.5 h-3.5 text-amber-600" />
            <span>Open File Station 5</span>
          </button>
          <button
            type="button"
            onClick={() => openWindow('music-station')}
            className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-slate-100 text-left"
          >
            <Music className="w-3.5 h-3.5 text-purple-600" />
            <span>Open Music Station 5</span>
          </button>
          <button
            type="button"
            onClick={() => openWindow('myqnapcloud')}
            className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-slate-100 text-left"
          >
            <Cloud className="w-3.5 h-3.5 text-blue-600" />
            <span>myQNAPcloud DDNS</span>
          </button>
          <div className="my-1 border-t border-slate-100" />
          <button
            type="button"
            onClick={() => openWindow('control-panel')}
            className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-slate-100 text-left"
          >
            <Settings className="w-3.5 h-3.5 text-slate-600" />
            <span>Control Panel &amp; Wallpaper</span>
          </button>
          <button
            type="button"
            onClick={() =>
              void updateSettings({
                showDesktopWidgets: !(settings?.showDesktopWidgets ?? true),
              })
            }
            className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-slate-100 text-left"
          >
            <Gauge className="w-3.5 h-3.5 text-emerald-600" />
            <span>
              {settings?.showDesktopWidgets ? 'Hide Qboost Widget' : 'Show Qboost Widget'}
            </span>
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-slate-100 text-left"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
            <span>Refresh Desktop</span>
          </button>
        </div>
      )}

      {/* Corner Notifications */}
      <ToastStack />
    </div>
  );
}
