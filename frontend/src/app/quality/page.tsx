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
  Info,
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
      <div className="min-h-screen bg-[#09090B] text-zinc-100 flex items-center justify-center p-8">
        <div className="p-8 rounded-2xl border border-zinc-800 bg-[#101014] text-center space-y-3">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500 mx-auto" />
          <div className="text-xs font-mono text-zinc-400">
            Computing statistical moments and evaluating data quality metrics...
          </div>
        </div>
      </div>
    );
  }

  if (!quality) {
    return (
      <div className="min-h-screen bg-[#09090B] text-zinc-100 p-8">
        <div className="max-w-xl mx-auto rounded-2xl border border-zinc-800 bg-[#101014] p-10 text-center space-y-5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-base font-bold text-white">No Dataset Available to Audit</h3>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto leading-relaxed">
              Mount a dataset into workspace memory via the Dataset Explorer before running statistical diagnostics.
            </p>
          </div>
          <Link
            href="/explorer"
            className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-all"
          >
            <span>Open Dataset Explorer</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    );
  }

  const missingChartData = Object.entries(quality.missing_summary).map(
    ([col, stats]) => ({
      name: col,
      missingPct: stats.missing_pct,
      missingCount: stats.missing_count,
    })
  );

  return (
    <div className="min-h-screen bg-[#09090B] text-zinc-100 p-4 sm:p-6 lg:p-8 selection:bg-blue-600 selection:text-white">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-800">
          <div className="space-y-1">
            <div className="flex items-center space-x-2 text-xs font-mono text-emerald-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>Diagnostic Quality Engine &amp; Health Checks</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Data Quality Profiler
            </h1>
          </div>

          <div className="flex items-center space-x-3">
            <Link
              href="/studio"
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm shadow-blue-600/30 transition-all"
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>Proceed to ML Studio</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* 4 Health KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-zinc-800 bg-[#101014] p-5 space-y-2">
            <div className="text-xs font-medium text-zinc-400 flex items-center justify-between">
              <span>Completeness Score</span>
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-emerald-400">
              {quality.overview.completeness_score.toFixed(1)}%
            </div>
            <div className="text-xs text-zinc-500 font-mono">
              {quality.overview.total_missing_cells} null cells detected
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-[#101014] p-5 space-y-2">
            <div className="text-xs font-medium text-zinc-400 flex items-center justify-between">
              <span>Duplicate Rows</span>
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-white">
              {quality.overview.duplicate_rows}
            </div>
            <div className="text-xs text-zinc-500 font-mono">
              {quality.overview.duplicate_pct.toFixed(2)}% of total rows
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-[#101014] p-5 space-y-2">
            <div className="text-xs font-medium text-zinc-400 flex items-center justify-between">
              <span>Feature Types</span>
              <Database className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-2xl font-bold text-blue-400">
              {quality.column_types.numeric.length} num / {quality.column_types.categorical.length} cat
            </div>
            <div className="text-xs text-zinc-500 font-mono">
              {quality.column_types.id_candidate.length} identifier candidates
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-[#101014] p-5 space-y-2">
            <div className="text-xs font-medium text-zinc-400 flex items-center justify-between">
              <span>Memory Footprint</span>
              <Layers className="w-4 h-4 text-violet-400" />
            </div>
            <div className="text-2xl font-bold text-white">
              {quality.overview.memory_mb.toFixed(2)} MB
            </div>
            <div className="text-xs text-zinc-500 font-mono">
              Optimized Pandas DataFrame
            </div>
          </div>
        </div>

        {/* Automated Recommendations */}
        {quality.recommendations.length > 0 && (
          <div className="rounded-2xl border border-zinc-800 bg-[#101014] p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center space-x-2">
                <Info className="w-4 h-4 text-blue-400" />
                <h3 className="font-semibold text-sm text-white">
                  Automated Data Quality Recommendations ({quality.recommendations.length})
                </h3>
              </div>
              <span className="text-xs text-zinc-500 font-mono">Pre-flight ML validation</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {quality.recommendations.map((rec, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl border border-zinc-800/80 bg-zinc-900/30 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-white">{rec.title}</span>
                    <span
                      className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${
                        rec.type === "danger"
                          ? "bg-red-500/10 text-red-400 border border-red-500/20"
                          : rec.type === "warning"
                          ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                          : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                      }`}
                    >
                      {rec.type}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">{rec.description}</p>
                  {rec.action && (
                    <div className="text-[11px] font-mono text-emerald-400 pt-1">
                      Action: {rec.action}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Missing Values Chart */}
          <div className="rounded-2xl border border-zinc-800 bg-[#101014] p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <h3 className="font-semibold text-sm text-white">Missing Values Ratio by Feature (%)</h3>
              <span className="text-xs font-mono text-zinc-500">Threshold: 0% Ideal</span>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={missingChartData}>
                  <CartesianGrid strokeDasharray="2 2" stroke="#27272A" vertical={false} />
                  <XAxis
                    dataKey="name"
                    stroke="#71717A"
                    fontSize={11}
                    interval={0}
                    angle={-20}
                    textAnchor="end"
                  />
                  <YAxis stroke="#71717A" fontSize={11} domain={[0, 100]} unit="%" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#101014",
                      border: "1px solid #27272A",
                      borderRadius: "8px",
                      fontSize: "12px",
                      color: "#FFFFFF",
                    }}
                  />
                  <Bar dataKey="missingPct" fill="#3B82F6">
                    {missingChartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.missingPct > 20 ? "#EF4444" : entry.missingPct > 0 ? "#F59E0B" : "#3B82F6"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Feature Distribution Inspector */}
          <div className="rounded-2xl border border-zinc-800 bg-[#101014] p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <h3 className="font-semibold text-sm text-white">Feature Distribution Inspector</h3>
              <select
                value={selectedCol}
                onChange={(e) => setSelectedCol(e.target.value)}
                className="bg-zinc-900 border border-zinc-700 rounded-lg text-xs text-white px-3 py-1.5 focus:outline-none focus:border-blue-500"
              >
                {Object.keys(quality.missing_summary).map((col) => (
                  <option key={col} value={col}>
                    {col}
                  </option>
                ))}
              </select>
            </div>

            {distLoading ? (
              <div className="h-64 flex items-center justify-center text-xs font-mono text-zinc-500 space-x-2">
                <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                <span>Computing distribution histograms...</span>
              </div>
            ) : distData ? (
              <div className="space-y-4">
                <div className="h-52 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={distData.bins}>
                      <CartesianGrid strokeDasharray="2 2" stroke="#27272A" vertical={false} />
                      <XAxis dataKey="bin" stroke="#71717A" fontSize={10} />
                      <YAxis stroke="#71717A" fontSize={11} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#101014",
                          border: "1px solid #27272A",
                          borderRadius: "8px",
                          fontSize: "12px",
                          color: "#FFFFFF",
                        }}
                      />
                      <Bar dataKey="count" fill="#10B981" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {distData.stats && (
                  <div className="grid grid-cols-4 gap-2 text-center p-3 rounded-xl bg-zinc-900/40 border border-zinc-800/80 text-xs">
                    <div>
                      <div className="text-zinc-500 text-[10px] uppercase font-mono">Mean</div>
                      <div className="font-bold text-white">{distData.stats.mean?.toFixed(2) ?? "N/A"}</div>
                    </div>
                    <div>
                      <div className="text-zinc-500 text-[10px] uppercase font-mono">Std Dev</div>
                      <div className="font-bold text-white">{distData.stats.std?.toFixed(2) ?? "N/A"}</div>
                    </div>
                    <div>
                      <div className="text-zinc-500 text-[10px] uppercase font-mono">Min</div>
                      <div className="font-bold text-white">{distData.stats.min?.toFixed(2) ?? "N/A"}</div>
                    </div>
                    <div>
                      <div className="text-zinc-500 text-[10px] uppercase font-mono">Max</div>
                      <div className="font-bold text-white">{distData.stats.max?.toFixed(2) ?? "N/A"}</div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-xs font-mono text-zinc-500">
                Select a column above to view distribution
              </div>
            )}
          </div>
        </div>

        {/* Correlation Matrix */}
        {quality.correlation_matrix && (
          <div className="rounded-2xl border border-zinc-800 bg-[#101014] p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <h3 className="font-semibold text-sm text-white">
                Pearson Correlation Heatmap (Numeric Features)
              </h3>
              <span className="text-xs font-mono text-zinc-500">Range: -1.00 to +1.00</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-center text-xs font-mono border-collapse">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <th className="p-2 text-left text-zinc-400 bg-zinc-900/60 rounded-tl-lg">Feature</th>
                    {quality.correlation_matrix.columns.map((col) => (
                      <th key={col} className="p-2 text-zinc-300 truncate max-w-[110px]">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/80">
                  {quality.correlation_matrix.columns.map((rowCol, rIdx) => (
                    <tr key={rowCol}>
                      <td className="p-2 text-left font-semibold text-white bg-zinc-900/40 truncate max-w-[120px]">
                        {rowCol}
                      </td>
                      {quality.correlation_matrix!.values[rIdx].map((val, cIdx) => {
                        const numVal = val !== null ? val : 0;
                        const isHigh = Math.abs(numVal) > 0.7 && rIdx !== cIdx;
                        return (
                          <td
                            key={cIdx}
                            className={`p-2 transition-colors ${
                              isHigh
                                ? "bg-blue-600/30 text-blue-300 font-bold"
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

      {/* Floating Command Dock */}
      <RetroDock />
    </div>
  );
}
