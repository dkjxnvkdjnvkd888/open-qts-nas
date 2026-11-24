import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  Folder,
  FileText,
  Image as ImageIcon,
  Film,
  Music,
  Archive,
  File,
  Upload,
  FolderPlus,
  RefreshCw,
  Search,
  Download,
  Trash2,
  Edit3,
  Eye,
  LayoutGrid,
  List,
  ChevronRight,
  HardDrive,
  X,
  Clock,
  Camera,
} from 'lucide-react';
import { api } from '../api/client';
import { useTelemetry } from '../context/TelemetryContext';
import { formatBytes, formatDateTime, isImageExt, isTextExt } from '../utils/format';
import type { FileEntry, SharedFolder } from '../types';

function FileIcon({ entry, large = false }: { entry: FileEntry; large?: boolean }) {
  const cls = large ? 'w-10 h-10' : 'w-4 h-4';
  if (entry.isDirectory) return <Folder className={`${cls} text-[#f59e0b] fill-[#fbbf24]/30`} />;
  if (isImageExt(entry.extension)) return <ImageIcon className={`${cls} text-pink-600`} />;
  if (['mp4', 'mkv', 'mov', 'avi', 'webm'].includes(entry.extension))
    return <Film className={`${cls} text-indigo-600`} />;
  if (['mp3', 'flac', 'wav', 'aac', 'ogg', 'm4a'].includes(entry.extension))
    return <Music className={`${cls} text-purple-600`} />;
  if (['zip', 'tar', 'gz', '7z', 'rar'].includes(entry.extension))
    return <Archive className={`${cls} text-orange-600`} />;
  if (isTextExt(entry.extension)) return <FileText className={`${cls} text-blue-600`} />;
  return <File className={`${cls} text-slate-500`} />;
}

export function FileStationApp() {
  const { notify, startTask, updateTask } = useTelemetry();
  const [currentPath, setCurrentPath] = useState('');
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [shares, setShares] = useState<SharedFolder[]>([]);
  const [selected, setSelected] = useState<FileEntry | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [renaming, setRenaming] = useState<FileEntry | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [preview, setPreview] = useState<{
    entry: FileEntry;
    kind: 'text' | 'image';
    text?: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadDirectory = useCallback(
    async (relPath: string) => {
      setLoading(true);
      try {
        const res = await api.listFiles(relPath);
        setEntries(res.entries);
        setCurrentPath(res.path);
        setSelected(null);
        setSearchQuery('');
      } catch (err) {
        notify('File Station 5', (err as Error).message, 'error');
      } finally {
        setLoading(false);
      }
    },
    [notify]
  );

  useEffect(() => {
    void loadDirectory('');
    api
      .getShares()
      .then((res) => setShares(res.shares))
      .catch(() => {});
  }, [loadDirectory]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      void loadDirectory(currentPath);
      return;
    }
    setLoading(true);
    try {
      const res = await api.searchFiles(searchQuery, currentPath);
      setEntries(res.entries);
    } catch (err) {
      notify('Search Failed', (err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    try {
      await api.mkdir(currentPath, newFolderName.trim());
      setNewFolderName('');
      setCreatingFolder(false);
      notify('File Station 5', `Created folder "${newFolderName.trim()}"`, 'success');
      void loadDirectory(currentPath);
    } catch (err) {
      notify('Create Folder', (err as Error).message, 'error');
    }
  };

  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renaming || !renameValue.trim()) return;
    try {
      await api.renameFile(renaming.path, renameValue.trim());
      setRenaming(null);
      notify('File Station 5', `Renamed to "${renameValue.trim()}"`, 'success');
      void loadDirectory(currentPath);
    } catch (err) {
      notify('Rename Failed', (err as Error).message, 'error');
    }
  };

  const handleDelete = async (entry: FileEntry) => {
    if (!window.confirm(`Delete "${entry.name}" permanently?`)) return;
    try {
      await api.deleteFile(entry.path);
      notify('File Station 5', `Deleted "${entry.name}"`, 'warning');
      void loadDirectory(currentPath);
    } catch (err) {
      notify('Delete Failed', (err as Error).message, 'error');
    }
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const taskId = startTask(
      `Uploading ${files.length} file(s)`,
      `Destination: /DataVol1/${currentPath || ''}`
    );
    try {
      updateTask(taskId, { progress: 60 });
      const res = await api.uploadFiles(currentPath, files);
      updateTask(taskId, {
        progress: 100,
        status: 'completed',
        detail: `Uploaded ${res.uploaded.length} file(s) to /${currentPath || 'DataVol1'}`,
      });
      notify(
        'Upload Complete',
        `Uploaded ${res.uploaded.length} file(s) to /${currentPath || 'DataVol1'}`,
        'success'
      );
      void loadDirectory(currentPath);
    } catch (err) {
      updateTask(taskId, { progress: 100, status: 'error', detail: (err as Error).message });
      notify('Upload Failed', (err as Error).message, 'error');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const openEntry = async (entry: FileEntry) => {
    if (entry.isDirectory) {
      void loadDirectory(entry.path);
      return;
    }
    if (isImageExt(entry.extension)) {
      setPreview({ entry, kind: 'image' });
      return;
    }
    if (isTextExt(entry.extension) || entry.size < 65536) {
      try {
        const res = await api.previewFile(entry.path);
        setPreview({ entry, kind: 'text', text: res.content });
      } catch (err) {
        notify('Preview Unavailable', (err as Error).message, 'error');
      }
    } else {
      window.open(api.getDownloadUrl(entry.path), '_blank');
    }
  };

  const breadcrumbs = currentPath ? currentPath.split('/').filter(Boolean) : [];

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-white">
      {/* QNAP FileStation 5 Top Brand & Search Bar (exact match to Screenshot 3) */}
      <div className="h-12 px-4 border-b border-slate-200 bg-white flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-2">
          <Folder className="w-5 h-5 text-[#f59e0b] fill-[#f59e0b]" />
          <span className="text-[15px] font-semibold text-[#d97706] tracking-tight">
            FileStation <span className="font-normal text-slate-600">5</span>
          </span>
        </div>

        <form onSubmit={handleSearch} className="flex-1 max-w-md relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search in ${currentPath || 'DataVol1'}...`}
            className="w-full bg-slate-50 border border-slate-300 focus:border-amber-500 focus:bg-white rounded pl-8 pr-3 py-1.5 text-xs text-slate-800 outline-none"
          />
        </form>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => void loadDirectory(currentPath)}
            title="Refresh"
            className="p-1.5 rounded hover:bg-slate-100 text-slate-600"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}
            title="Toggle View"
            className="p-1.5 rounded hover:bg-slate-100 text-slate-600"
          >
            {viewMode === 'list' ? (
              <LayoutGrid className="w-4 h-4" />
            ) : (
              <List className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Main Split: Dark Charcoal Left Tree Sidebar + Crisp White File Table */}
      <div className="flex flex-1 min-h-0">
        {/* Authentic QNAP Dark Left Tree Sidebar (#323740) */}
        <aside className="w-52 bg-[#323740] text-slate-200 p-2.5 flex flex-col gap-0.5 shrink-0 overflow-y-auto text-xs">
          <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Clock className="w-3 h-3" />
            <span>Quick Access</span>
          </div>

          <button
            type="button"
            onClick={() => void loadDirectory('')}
            className={`flex items-center gap-2 px-2.5 py-1.5 rounded text-left transition-colors ${
              currentPath === ''
                ? 'bg-[#454c57] text-[#fbbf24] font-medium'
                : 'text-slate-200 hover:bg-white/5'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <span className="truncate">DataVol1 (Root)</span>
          </button>

          <div className="px-2 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Shared Folders
          </div>
          {shares.map((sh) => {
            const active = currentPath === sh.path || currentPath.startsWith(`${sh.path}/`);
            return (
              <button
                key={sh.id}
                type="button"
                onClick={() => void loadDirectory(sh.path)}
                className={`flex items-center gap-2 pl-4 pr-2.5 py-1.5 rounded text-left transition-colors ${
                  active
                    ? 'bg-[#454c57] text-[#fbbf24] font-medium'
                    : 'text-slate-300 hover:bg-white/5'
                }`}
              >
                <Folder className="w-3.5 h-3.5 text-[#f59e0b] shrink-0" />
                <span className="truncate">{sh.name}</span>
              </button>
            );
          })}
        </aside>

        {/* Right File Area */}
        <div className="flex-1 min-w-0 flex flex-col bg-white">
          {/* Action Toolbar */}
          <div className="px-3.5 py-2 border-b border-slate-200 bg-[#f8f9fb] flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => void handleUpload(e.target.files)}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-medium"
              >
                <Upload className="w-3.5 h-3.5 text-blue-600" />
                <span>Upload</span>
              </button>
              <button
                type="button"
                onClick={() => setCreatingFolder(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-medium"
              >
                <FolderPlus className="w-3.5 h-3.5 text-amber-600" />
                <span>Create Folder</span>
              </button>

              {selected && (
                <>
                  <div className="h-4 w-px bg-slate-300 mx-1" />
                  {!selected.isDirectory && (
                    <>
                      <button
                        type="button"
                        onClick={() => void openEntry(selected)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs"
                      >
                        <Eye className="w-3.5 h-3.5 text-blue-600" />
                        <span>Preview</span>
                      </button>
                      <a
                        href={api.getDownloadUrl(selected.path)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs"
                      >
                        <Download className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Download</span>
                      </a>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setRenaming(selected);
                      setRenameValue(selected.name);
                    }}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-amber-600" />
                    <span>Rename</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(selected)}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white border border-rose-300 hover:bg-rose-50 text-rose-600 text-xs"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() =>
                notify(
                  'Storage Snapshot',
                  `Quick snapshot scheduled for /DataVol1/${currentPath || ''}`,
                  'info'
                )
              }
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-[#1d63dc] hover:bg-[#1751b8] text-white text-xs font-medium"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Snapshot</span>
            </button>
          </div>

          {/* Path Breadcrumbs */}
          <div className="px-3.5 py-1.5 border-b border-slate-200 bg-white flex items-center gap-1 text-xs text-slate-500">
            <button
              type="button"
              onClick={() => void loadDirectory('')}
              className="hover:text-blue-600 font-medium text-slate-700"
            >
              DataVol1
            </button>
            {breadcrumbs.map((part, idx) => {
              const target = breadcrumbs.slice(0, idx + 1).join('/');
              return (
                <React.Fragment key={target}>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                  <button
                    type="button"
                    onClick={() => void loadDirectory(target)}
                    className="hover:text-blue-600 text-slate-700"
                  >
                    {part}
                  </button>
                </React.Fragment>
              );
            })}
          </div>

          {/* Inline Create Folder / Rename Bar */}
          {creatingFolder && (
            <form
              onSubmit={handleCreateFolder}
              className="px-3.5 py-2 bg-amber-50 border-b border-amber-200 flex items-center gap-2"
            >
              <FolderPlus className="w-4 h-4 text-amber-600" />
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="New folder name..."
                autoFocus
                className="flex-1 bg-white border border-slate-300 rounded px-2.5 py-1 text-xs text-slate-900 outline-none focus:border-amber-500"
              />
              <button
                type="submit"
                className="px-3 py-1 rounded bg-[#2563eb] text-white text-xs font-medium"
              >
                Create
              </button>
              <button
                type="button"
                onClick={() => setCreatingFolder(false)}
                className="px-2 py-1 text-xs text-slate-500 hover:text-slate-800"
              >
                Cancel
              </button>
            </form>
          )}

          {renaming && (
            <form
              onSubmit={handleRenameSubmit}
              className="px-3.5 py-2 bg-blue-50 border-b border-blue-200 flex items-center gap-2"
            >
              <Edit3 className="w-4 h-4 text-blue-600" />
              <input
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                autoFocus
                className="flex-1 bg-white border border-slate-300 rounded px-2.5 py-1 text-xs text-slate-900 outline-none focus:border-blue-500"
              />
              <button
                type="submit"
                className="px-3 py-1 rounded bg-[#2563eb] text-white text-xs font-medium"
              >
                Rename
              </button>
              <button
                type="button"
                onClick={() => setRenaming(null)}
                className="px-2 py-1 text-xs text-slate-500 hover:text-slate-800"
              >
                Cancel
              </button>
            </form>
          )}

          {/* File Table / Grid */}
          <div className="flex-1 overflow-y-auto">
            {entries.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs gap-2">
                <Folder className="w-10 h-10 opacity-30" />
                <span>Folder is empty. Click Upload or Create Folder.</span>
              </div>
            ) : viewMode === 'list' ? (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#f4f6f9] text-slate-600 border-b border-slate-200">
                    <th className="py-2 px-3.5 font-medium">Name</th>
                    <th className="py-2 px-3 font-medium w-40">Date Modified</th>
                    <th className="py-2 px-3 font-medium w-24">Type</th>
                    <th className="py-2 px-3 font-medium w-24 text-right">Size</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {entries.map((entry) => {
                    const isSel = selected?.path === entry.path;
                    return (
                      <tr
                        key={entry.path}
                        onClick={() => setSelected(entry)}
                        onDoubleClick={() => void openEntry(entry)}
                        className={`cursor-pointer ${
                          isSel
                            ? 'bg-blue-50 text-blue-900 font-medium'
                            : 'hover:bg-slate-50 text-slate-800'
                        }`}
                      >
                        <td className="py-2 px-3.5 flex items-center gap-2.5">
                          <FileIcon entry={entry} />
                          <span className="truncate">{entry.name}</span>
                        </td>
                        <td className="py-2 px-3 text-slate-500 tabular-nums">
                          {formatDateTime(entry.modifiedAt)}
                        </td>
                        <td className="py-2 px-3 text-slate-500 uppercase text-[11px]">
                          {entry.isDirectory ? 'Folder' : entry.extension || 'File'}
                        </td>
                        <td className="py-2 px-3 text-slate-600 tabular-nums text-right">
                          {entry.isDirectory ? '--' : formatBytes(entry.size)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="p-3 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2.5">
                {entries.map((entry) => {
                  const isSel = selected?.path === entry.path;
                  return (
                    <button
                      key={entry.path}
                      type="button"
                      onClick={() => setSelected(entry)}
                      onDoubleClick={() => void openEntry(entry)}
                      className={`p-3 rounded border flex flex-col items-center gap-1.5 text-center ${
                        isSel
                          ? 'bg-blue-50 border-blue-400 text-blue-900'
                          : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <FileIcon entry={entry} large />
                      <span className="text-xs w-full truncate">{entry.name}</span>
                      <span className="text-[10px] text-slate-400">
                        {entry.isDirectory ? 'Folder' : formatBytes(entry.size)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer Bar */}
          <div className="px-3.5 py-1.5 border-t border-slate-200 bg-[#f8f9fb] text-[11px] text-slate-500 flex items-center justify-between">
            <span>Showing {entries.length} item(s)</span>
            <span>Double-click folder to open or file to preview</span>
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {preview && (
        <div className="fixed inset-0 z-[80] bg-black/50 flex items-center justify-center p-6">
          <div className="bg-white border border-slate-300 rounded shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-800 truncate">
                {preview.entry.name}
              </span>
              <div className="flex items-center gap-3">
                <a
                  href={api.getDownloadUrl(preview.entry.path)}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Download
                </a>
                <button
                  type="button"
                  onClick={() => setPreview(null)}
                  className="text-slate-500 hover:text-slate-900"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4 bg-slate-50">
              {preview.kind === 'image' ? (
                <img
                  src={api.getRawUrl(preview.entry.path)}
                  alt={preview.entry.name}
                  className="max-h-[60vh] mx-auto rounded border border-slate-200"
                />
              ) : (
                <pre className="text-xs text-slate-800 whitespace-pre-wrap font-mono leading-relaxed">
                  {preview.text}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
