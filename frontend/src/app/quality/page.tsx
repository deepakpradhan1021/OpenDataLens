"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  AlertTriangle,
  Database,
  BarChart2,
  Table as TableIcon,
  ArrowRight,
  TrendingUp,
  Cpu,
  Layers,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts";
import { api } from "@/lib/api";
import { QualityAnalysisResponse } from "@/lib/types";
import { EmptyState } from "@/components/empty-state";
import { RetroDock } from "@/components/retro-dock";
import { RetroHeartDocIcon } from "@/components/retro-icons";

export default function QualityPage() {
  const [quality, setQuality] = useState<QualityAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCol, setSelectedCol] = useState<string>("");
  const [distData, setDistData] = useState<any>(null);
  const [distLoading, setDistLoading] = useState(false);

  useEffect(() => {
    async function fetchQuality() {
      try {
        const q = await api.getQualityAnalysis("default");
        setQuality(q);
        const firstCol = Object.keys(q.missing_summary)[0];
        if (firstCol) {
          setSelectedCol(firstCol);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchQuality();
  }, []);

  useEffect(() => {
    if (!selectedCol) return;
    setDistLoading(true);
    api
      .getColumnDistribution(selectedCol, "default")
      .then(setDistData)
      .catch(console.error)
      .finally(() => setDistLoading(false));
  }, [selectedCol]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0C0C0E] text-white flex items-center justify-center p-8 bg-retro-grid">
        <div className="retro-window-dark p-8 text-center space-y-3 border border-zinc-800">
          <Loader2 className="w-6 h-6 animate-spin text-[#1864FF] mx-auto" />
          <div className="font-mono text-xs uppercase tracking-wider text-zinc-300">
            COMPUTING STATISTICAL MOMENTS & RUNNING QUALITY AUDIT...
          </div>
        </div>
      </div>
    );
  }

  if (!quality) {
    return (
      <div className="min-h-screen bg-[#0C0C0E] text-white p-8 bg-retro-grid">
        <div className="max-w-xl mx-auto retro-window-dark p-8 text-center space-y-6 border border-zinc-800">
          <RetroHeartDocIcon size={48} className="mx-auto" />
          <div className="space-y-2">
            <h3 className="font-mono text-base font-bold uppercase">NO ACTIVE DATASET LOADED</h3>
            <p className="font-mono text-xs text-zinc-400">
              Please mount a dataset into workspace memory before running statistical diagnostics.
            </p>
          </div>
          <Link href="/explorer" className="btn-retro btn-retro-blue text-xs py-2 px-4">
            GO TO DATASET EXPLORER ↗
          </Link>
        </div>
      </div>
    );
  }

  // Missing values data for Recharts
  const missingChartData = Object.entries(quality.missing_summary).map(
    ([col, stats]) => ({
      name: col,
      missingPct: stats.missing_pct,
      missingCount: stats.missing_count,
    })
  );

  return (
    <div className="min-h-screen bg-[#0C0C0E] text-white p-4 sm:p-6 lg:p-8 bg-retro-grid selection:bg-[#1864FF] selection:text-white">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Workstation Title Header */}
        <div className="retro-window-dark p-4 border border-zinc-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-[#9AE6B4] font-mono text-xs font-bold uppercase tracking-wider">
                <span className="w-2 h-2 bg-[#9AE6B4] inline-block" />
                <span>MODULE_03 // DATA DIAGNOSTICS & STATISTICAL PROFILER</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-mono font-bold tracking-tight text-white uppercase">
                DATA QUALITY PROFILER
              </h1>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/studio"
                className="btn-retro btn-retro-blue text-xs flex items-center gap-1.5"
              >
                <Cpu className="w-3.5 h-3.5" />
                <span>PROCEED TO ML STUDIO</span>
                <span>↗</span>
              </Link>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-3 font-mono text-xs text-zinc-400">
            <div>
              TOTAL TESTED CELLS: {quality.overview.total_cells.toLocaleString()} ({quality.overview.total_rows} ROWS × {quality.overview.total_cols} COLS)
            </div>
            <div className="text-[#9AE6B4] font-bold">
              COMPLETENESS SCORE: {quality.overview.completeness_score.toFixed(1)}%
            </div>
          </div>
        </div>

        {/* 4 Diagnostic Registers */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="retro-window-dark p-4 border border-zinc-800 space-y-1">
            <div className="font-mono text-[10px] text-zinc-400 font-bold uppercase">
              REG_A: COMPLETENESS_SCORE
            </div>
            <div className="text-2xl font-mono font-bold text-[#9AE6B4]">
              {quality.overview.completeness_score.toFixed(1)}%
            </div>
            <div className="text-xs font-mono text-zinc-400">
              {quality.overview.total_missing_cells} NULL CELLS
            </div>
          </div>

          <div className="retro-window-dark p-4 border border-zinc-800 space-y-1">
            <div className="font-mono text-[10px] text-zinc-400 font-bold uppercase">
              REG_B: DUPLICATE_RECORDS
            </div>
            <div className="text-2xl font-mono font-bold text-white">
              {quality.overview.duplicate_rows}
            </div>
            <div className="text-xs font-mono text-zinc-400">
              {quality.overview.duplicate_pct.toFixed(2)}% OF TOTAL ROWS
            </div>
          </div>

          <div className="retro-window-dark p-4 border border-zinc-800 space-y-1">
            <div className="font-mono text-[10px] text-zinc-400 font-bold uppercase">
              REG_C: COLUMN_TYPES
            </div>
            <div className="text-2xl font-mono font-bold text-[#1864FF]">
              {quality.column_types.numeric.length} NUM / {quality.column_types.categorical.length} CAT
            </div>
            <div className="text-xs font-mono text-zinc-400">
              {quality.column_types.id_candidate.length} ID CANDIDATES DETECTED
            </div>
          </div>

          <div className="retro-window-dark p-4 border border-zinc-800 space-y-1">
            <div className="font-mono text-[10px] text-zinc-400 font-bold uppercase">
              REG_D: MEMORY_FOOTPRINT
            </div>
            <div className="text-2xl font-mono font-bold text-white">
              {quality.overview.memory_mb.toFixed(2)} MB
            </div>
            <div className="text-xs font-mono text-zinc-400">
              OPTIMIZED IN-MEMORY PANDAS DF
            </div>
          </div>
        </div>

        {/* Automated Quality Recommendations (Punchcard Style) */}
        {quality.recommendations.length > 0 && (
          <div className="retro-window-dark p-4 border border-zinc-800 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800 font-mono text-xs font-bold text-white uppercase">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-[#FBBF24] inline-block" />
                <span>AUTOMATED DATA QUALITY RECOMMENDATIONS ({quality.recommendations.length})</span>
              </div>
              <span className="text-zinc-500 text-[10px]">PRE-FLIGHT ML CHECKS</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {quality.recommendations.map((rec, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-zinc-950 border border-zinc-800 space-y-1.5 font-mono text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white uppercase">{rec.title}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 font-bold uppercase ${
                        rec.type === "danger"
                          ? "bg-red-500/20 text-red-400 border border-red-500/30"
                          : rec.type === "warning"
                          ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                          : "bg-[#1864FF]/20 text-[#1864FF] border border-[#1864FF]/30"
                      }`}
                    >
                      {rec.type}
                    </span>
                  </div>
                  <p className="text-zinc-400 text-[11px] leading-relaxed">
                    {rec.description}
                  </p>
                  {rec.action && (
                    <div className="text-[#9AE6B4] text-[10px] pt-1">
                      RECOMMENDED ACTION: {rec.action}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Missing Values Diagnostic Chart & Column Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Missing Values Chart */}
          <div className="retro-window-dark p-4 border border-zinc-800 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800 font-mono text-xs font-bold uppercase">
              <span>MISSING VALUES BY FEATURE (%)</span>
              <span className="text-zinc-500 text-[10px]">THRESHOLD: 0% IDEAL</span>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={missingChartData}>
                  <CartesianGrid strokeDasharray="2 2" stroke="#27272A" vertical={false} />
                  <XAxis
                    dataKey="name"
                    stroke="#71717A"
                    fontSize={10}
                    fontFamily="monospace"
                    interval={0}
                    angle={-20}
                    textAnchor="end"
                  />
                  <YAxis
                    stroke="#71717A"
                    fontSize={10}
                    fontFamily="monospace"
                    domain={[0, 100]}
                    unit="%"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0C0C0E",
                      border: "1px solid #000000",
                      fontFamily: "monospace",
                      fontSize: "11px",
                      color: "#FFFFFF",
                    }}
                  />
                  <Bar dataKey="missingPct" fill="#1864FF">
                    {missingChartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.missingPct > 20 ? "#EF4444" : entry.missingPct > 0 ? "#F59E0B" : "#1864FF"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Interactive Feature Distribution Inspector */}
          <div className="retro-window-dark p-4 border border-zinc-800 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800 font-mono text-xs font-bold uppercase">
              <span>FEATURE DISTRIBUTION INSPECTOR</span>
              <select
                value={selectedCol}
                onChange={(e) => setSelectedCol(e.target.value)}
                className="bg-zinc-900 border border-zinc-700 font-mono text-[11px] text-white px-2 py-1 uppercase focus:outline-none focus:border-[#1864FF]"
              >
                {Object.keys(quality.missing_summary).map((col) => (
                  <option key={col} value={col}>
                    {col}
                  </option>
                ))}
              </select>
            </div>

            {distLoading ? (
              <div className="h-64 flex items-center justify-center font-mono text-xs text-zinc-500 gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-[#1864FF]" />
                <span>CALCULATING HISTOGRAM BUCKETS...</span>
              </div>
            ) : distData ? (
              <div className="space-y-4">
                <div className="h-52 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={distData.bins}>
                      <CartesianGrid strokeDasharray="2 2" stroke="#27272A" vertical={false} />
                      <XAxis dataKey="bin" stroke="#71717A" fontSize={9} fontFamily="monospace" />
                      <YAxis stroke="#71717A" fontSize={10} fontFamily="monospace" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#0C0C0E",
                          border: "1px solid #000000",
                          fontFamily: "monospace",
                          fontSize: "11px",
                          color: "#FFFFFF",
                        }}
                      />
                      <Bar dataKey="count" fill="#9AE6B4" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {distData.stats && (
                  <div className="grid grid-cols-4 gap-2 text-center font-mono text-[10px] p-2 bg-zinc-950 border border-zinc-800">
                    <div>
                      <div className="text-zinc-500">MEAN</div>
                      <div className="font-bold text-white">{distData.stats.mean?.toFixed(2) ?? "N/A"}</div>
                    </div>
                    <div>
                      <div className="text-zinc-500">STD DEV</div>
                      <div className="font-bold text-white">{distData.stats.std?.toFixed(2) ?? "N/A"}</div>
                    </div>
                    <div>
                      <div className="text-zinc-500">MIN</div>
                      <div className="font-bold text-white">{distData.stats.min?.toFixed(2) ?? "N/A"}</div>
                    </div>
                    <div>
                      <div className="text-zinc-500">MAX</div>
                      <div className="font-bold text-white">{distData.stats.max?.toFixed(2) ?? "N/A"}</div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center font-mono text-xs text-zinc-500">
                SELECT A COLUMN ABOVE TO VIEW STATISTICAL DENSITY
              </div>
            )}
          </div>
        </div>

        {/* Correlation Matrix Heatmap (Vintage ASCII / Block Density) */}
        {quality.correlation_matrix && (
          <div className="retro-window-dark p-4 border border-zinc-800 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800 font-mono text-xs font-bold uppercase">
              <span>PEARSON CORRELATION MATRIX (NUMERIC FEATURES)</span>
              <span className="text-zinc-500 text-[10px]">RANGE: -1.00 TO +1.00</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-center font-mono text-xs border-collapse">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <th className="p-2 text-left text-zinc-500 text-[10px] bg-zinc-950">FEATURES</th>
                    {quality.correlation_matrix.columns.map((col) => (
                      <th key={col} className="p-2 text-[10px] text-zinc-300 uppercase truncate max-w-[100px]">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {quality.correlation_matrix.columns.map((rowCol, rIdx) => (
                    <tr key={rowCol}>
                      <td className="p-2 text-left font-bold text-white text-[10px] bg-zinc-950 truncate max-w-[120px]">
                        {rowCol}
                      </td>
                      {quality.correlation_matrix!.values[rIdx].map((val, cIdx) => {
                        const numVal = val !== null ? val : 0;
                        const isHigh = Math.abs(numVal) > 0.7 && rIdx !== cIdx;
                        return (
                          <td
                            key={cIdx}
                            className={`p-2 text-[10px] ${
                              isHigh
                                ? "bg-[#1864FF]/30 text-[#93C5FD] font-bold"
                                : numVal > 0.3
                                ? "text-zinc-200"
                                : "text-zinc-500"
                            }`}
                          >
                            {val !== null ? numVal.toFixed(2) : "0.00"}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Floating Retro Dock */}
      <RetroDock />
    </div>
  );
}
