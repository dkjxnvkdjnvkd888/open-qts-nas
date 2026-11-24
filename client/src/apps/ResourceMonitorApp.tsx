import { useEffect, useState } from 'react';
import { Cpu, MemoryStick, ArrowDownUp, ListTree, RefreshCw } from 'lucide-react';
import { useTelemetry } from '../context/TelemetryContext';
import { api } from '../api/client';
import { formatBytes } from '../utils/format';
import type { ProcessItem } from '../types';

function MetricChart({
  values,
  max = 100,
  stroke,
  fill,
}: {
  values: number[];
  max?: number;
  stroke: string;
  fill: string;
}) {
  const width = 460;
  const height = 105;
  const pts = values.length > 1 ? values : [0, ...values];
  const stepX = width / Math.max(1, pts.length - 1);
  const safeMax = Math.max(max, ...pts, 1);

  const coords = pts.map((v, i) => {
    const x = i * stepX;
    const y = height - (Math.min(v, safeMax) / safeMax) * (height - 10) - 5;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const linePath = `M ${coords.join(' L ')}`;
  const areaPath = `${linePath} L ${width},${height} L 0,${height} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-28 overflow-visible">
      {[25, 50, 75].map((pct) => (
        <line
          key={pct}
          x1={0}
          x2={width}
          y1={(height * pct) / 100}
          y2={(height * pct) / 100}
          stroke="#e2e8f0"
          strokeDasharray="3 3"
        />
      ))}
      <path d={areaPath} fill={fill} />
      <path d={linePath} fill="none" stroke={stroke} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

export function ResourceMonitorApp() {
  const { history, latest, connected } = useTelemetry();
  const [tab, setTab] = useState<'charts' | 'processes'>('charts');
  const [processes, setProcesses] = useState<ProcessItem[]>([]);
  const [loadingProc, setLoadingProc] = useState(false);

  const loadProcesses = async () => {
    setLoadingProc(true);
    try {
      const res = await api.getProcesses();
      setProcesses(res.processes);
    } catch {
      // ignore
    } finally {
      setLoadingProc(false);
    }
  };

  useEffect(() => {
    if (tab === 'processes') {
      void loadProcesses();
    }
  }, [tab]);

  const cpuSeries = history.map((h) => h.cpuPercent);
  const memSeries = history.map((h) => h.memoryPercent);
  const netSeries = history.map((h) => h.networkRxKbps + h.networkTxKbps);

  return (
    <div className="flex flex-1 min-h-0 bg-white">
      <aside className="w-48 bg-[#f5f7fa] border-r border-slate-200 p-3 flex flex-col gap-1 shrink-0 text-xs">
        <div className="px-2 pb-2.5 mb-1 border-b border-slate-200 font-semibold text-slate-800">
          Resource Monitor
        </div>
        <button
          type="button"
          onClick={() => setTab('charts')}
          className={`flex items-center gap-2.5 px-2.5 py-2 rounded font-medium text-left ${
            tab === 'charts' ? 'bg-[#059669] text-white' : 'text-slate-700 hover:bg-slate-200/70'
          }`}
        >
          <Cpu className="w-4 h-4" />
          <span>System Resources</span>
        </button>
        <button
          type="button"
          onClick={() => setTab('processes')}
          className={`flex items-center gap-2.5 px-2.5 py-2 rounded font-medium text-left ${
            tab === 'processes' ? 'bg-[#059669] text-white' : 'text-slate-700 hover:bg-slate-200/70'
          }`}
        >
          <ListTree className="w-4 h-4" />
          <span>Processes</span>
        </button>

        <div className="mt-auto pt-3 border-t border-slate-200 text-[11px] text-slate-500 px-2">
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-500' : 'bg-amber-500'}`}
            />
            <span>{connected ? 'Live Telemetry' : 'Reconnecting'}</span>
          </div>
        </div>
      </aside>

      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {tab === 'charts' ? (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="border border-slate-200 rounded p-4 bg-white">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                    <Cpu className="w-4 h-4 text-blue-600" />
                    CPU Utilization
                  </span>
                  <span className="text-lg font-bold text-blue-700 tabular-nums">
                    {latest ? `${latest.cpuPercent}%` : '--'}
                  </span>
                </div>
                <MetricChart values={cpuSeries} stroke="#2563eb" fill="rgba(37,99,235,0.12)" />
                <div className="mt-2 flex justify-between text-[11px] text-slate-500">
                  <span>Thermal: {latest ? `${latest.temperatureC}°C` : '--'}</span>
                  <span>1.5s interval</span>
                </div>
              </div>

              <div className="border border-slate-200 rounded p-4 bg-white">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                    <MemoryStick className="w-4 h-4 text-purple-600" />
                    Memory Utilization
                  </span>
                  <span className="text-lg font-bold text-purple-700 tabular-nums">
                    {latest ? `${latest.memoryPercent}%` : '--'}
                  </span>
                </div>
                <MetricChart values={memSeries} stroke="#7c3aed" fill="rgba(124,58,237,0.12)" />
                <div className="mt-2 flex justify-between text-[11px] text-slate-500 tabular-nums">
                  <span>Used: {latest ? formatBytes(latest.memoryUsedBytes) : '--'}</span>
                  <span>Total: {latest ? formatBytes(latest.memoryTotalBytes) : '--'}</span>
                </div>
              </div>
            </div>

            <div className="border border-slate-200 rounded p-4 bg-white">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                  <ArrowDownUp className="w-4 h-4 text-emerald-600" />
                  Network Interface Throughput
                </span>
                <div className="flex items-center gap-4 text-xs tabular-nums font-medium">
                  <span className="text-emerald-700">
                    ↓ {latest ? `${latest.networkRxKbps.toFixed(0)} KB/s` : '--'}
                  </span>
                  <span className="text-blue-700">
                    ↑ {latest ? `${latest.networkTxKbps.toFixed(0)} KB/s` : '--'}
                  </span>
                </div>
              </div>
              <MetricChart
                values={netSeries}
                max={400}
                stroke="#059669"
                fill="rgba(5,150,105,0.12)"
              />
            </div>
          </>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Active Host Processes</h3>
              <button
                type="button"
                onClick={() => void loadProcesses()}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-slate-300 text-xs text-slate-700 hover:bg-slate-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingProc ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>
            <div className="border border-slate-200 rounded overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#f4f6f9] text-slate-600 border-b border-slate-200">
                    <th className="py-2 px-4 font-medium w-20">PID</th>
                    <th className="py-2 px-4 font-medium">Process</th>
                    <th className="py-2 px-4 font-medium w-24">CPU</th>
                    <th className="py-2 px-4 font-medium w-28">Memory</th>
                    <th className="py-2 px-4 font-medium w-24">State</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {processes.map((p) => (
                    <tr key={p.pid} className="hover:bg-slate-50">
                      <td className="py-2 px-4 font-mono text-slate-500">{p.pid}</td>
                      <td className="py-2 px-4 font-medium text-slate-900">{p.name}</td>
                      <td className="py-2 px-4 text-blue-700 tabular-nums">{p.cpuPercent}%</td>
                      <td className="py-2 px-4 text-purple-700 tabular-nums">{p.memoryMb} MB</td>
                      <td className="py-2 px-4">
                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[10px] font-semibold">
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
