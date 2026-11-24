import React, { useRef } from 'react';
import { Minus, Square, Copy, X } from 'lucide-react';
import {
  APP_DEFINITIONS,
  useWindowManager,
  type WindowInstance,
} from '../context/WindowManagerContext';

interface WindowProps {
  win: WindowInstance;
  children: React.ReactNode;
}

const TOPBAR_HEIGHT = 48;

export function Window({ win, children }: WindowProps) {
  const {
    activeWindowId,
    focusWindow,
    closeWindow,
    toggleMinimize,
    toggleMaximize,
    updateBounds,
  } = useWindowManager();

  const isActive = activeWindowId === win.id;
  const def = APP_DEFINITIONS[win.id];
  const elRef = useRef<HTMLDivElement>(null);

  if (win.minimized) return null;

  /**
   * Zero-lag Desktop OS Window Dragging:
   * Mutates DOM transform directly during pointermove (no React re-render per pixel)
   * and commits final (x, y) coordinates on pointerup.
   */
  const handleTitlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('button')) return;
    focusWindow(win.id);
    if (win.maximized) return;

    const el = elRef.current;
    if (!el) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const origX = win.x;
    const origY = win.y;
    let dx = 0;
    let dy = 0;

    el.style.willChange = 'transform';
    document.body.style.userSelect = 'none';

    const onMove = (ev: PointerEvent) => {
      const clampedX = Math.max(
        -win.width + 140,
        Math.min(window.innerWidth - 140, origX + (ev.clientX - startX))
      );
      const clampedY = Math.max(
        TOPBAR_HEIGHT,
        Math.min(window.innerHeight - 40, origY + (ev.clientY - startY))
      );
      dx = clampedX - origX;
      dy = clampedY - origY;
      el.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      el.style.transform = '';
      el.style.willChange = '';
      document.body.style.userSelect = '';
      if (dx !== 0 || dy !== 0) {
        updateBounds(win.id, { x: origX + dx, y: origY + dy });
      }
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  /** Zero-lag direct DOM resize, committing final width/height on pointerup */
  const startResize =
    (direction: 'se' | 'e' | 's') => (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      e.preventDefault();
      focusWindow(win.id);
      if (win.maximized) return;

      const el = elRef.current;
      if (!el) return;

      const startX = e.clientX;
      const startY = e.clientY;
      const origW = win.width;
      const origH = win.height;
      let nextW = origW;
      let nextH = origH;

      document.body.style.userSelect = 'none';

      const onMove = (ev: PointerEvent) => {
        if (direction === 'se' || direction === 'e') {
          nextW = Math.max(
            540,
            Math.min(window.innerWidth - win.x, origW + (ev.clientX - startX))
          );
          el.style.width = `${nextW}px`;
        }
        if (direction === 'se' || direction === 's') {
          nextH = Math.max(
            380,
            Math.min(window.innerHeight - win.y, origH + (ev.clientY - startY))
          );
          el.style.height = `${nextH}px`;
        }
      };

      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        document.body.style.userSelect = '';
        updateBounds(win.id, { width: nextW, height: nextH });
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    };

  const style: React.CSSProperties = win.maximized
    ? {
        left: 0,
        top: TOPBAR_HEIGHT,
        width: '100vw',
        height: `calc(100vh - ${TOPBAR_HEIGHT}px)`,
        zIndex: win.zIndex,
      }
    : {
        left: win.x,
        top: win.y,
        width: win.width,
        height: win.height,
        zIndex: win.zIndex,
      };

  return (
    <div
      ref={elRef}
      style={style}
      onMouseDown={() => focusWindow(win.id)}
      className={`fixed flex flex-col overflow-hidden bg-white ${
        win.closing ? 'qts-window-close' : 'qts-window-open'
      } ${win.maximized ? 'rounded-none' : 'rounded-[4px]'} ${
        isActive ? 'shadow-qts-window-active' : 'shadow-qts-window'
      }`}
    >
      {/* QNAP QTS 5.x Compact Silver Title Bar */}
      <div
        onPointerDown={handleTitlePointerDown}
        onDoubleClick={() => toggleMaximize(win.id)}
        className={`h-8 px-2.5 flex items-center justify-between border-b shrink-0 cursor-default select-none ${
          isActive
            ? 'bg-[#eff1f5] border-slate-300/90 text-slate-800'
            : 'bg-[#e6e9ef] border-slate-300/70 text-slate-500'
        }`}
      >
        <span className="text-[12px] font-medium truncate tracking-tight">{win.title}</span>

        <div className="flex items-center -mr-1">
          <button
            type="button"
            onClick={() => toggleMinimize(win.id)}
            title="Minimize"
            className="w-7 h-6 flex items-center justify-center text-slate-600 hover:bg-slate-300/80 hover:text-slate-900 transition-colors duration-100"
          >
            <Minus className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={() => toggleMaximize(win.id)}
            title={win.maximized ? 'Restore' : 'Maximize'}
            className="w-7 h-6 flex items-center justify-center text-slate-600 hover:bg-slate-300/80 hover:text-slate-900 transition-colors duration-100"
          >
            {win.maximized ? <Copy className="w-2.5 h-2.5" /> : <Square className="w-2.5 h-2.5" />}
          </button>
          <button
            type="button"
            onClick={() => closeWindow(win.id)}
            title="Close"
            className="w-7 h-6 flex items-center justify-center text-slate-600 hover:bg-[#e11d48] hover:text-white transition-colors duration-100"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Signature QTS 5.x Colored App Top Accent Bar */}
      <div className="h-[3px] w-full shrink-0" style={{ backgroundColor: def.accentHex }} />

      {/* Crisp Light Enterprise Window Body */}
      <div className="flex-1 min-h-0 bg-white text-slate-800 overflow-hidden flex flex-col select-text">
        {children}
      </div>

      {/* Resize Handles */}
      {!win.maximized && (
        <>
          <div
            onPointerDown={startResize('e')}
            className="absolute top-8 right-0 bottom-3 w-1.5 cursor-ew-resize"
          />
          <div
            onPointerDown={startResize('s')}
            className="absolute bottom-0 left-3 right-3 h-1.5 cursor-ns-resize"
          />
          <div
            onPointerDown={startResize('se')}
            className="absolute bottom-0 right-0 w-3.5 h-3.5 cursor-nwse-resize"
          />
        </>
      )}
    </div>
  );
}
