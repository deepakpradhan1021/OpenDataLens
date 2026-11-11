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
  Sparkles,
  Send,
  HelpCircle,
  ChevronRight,
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
import { QualityAnalysisResponse, CopilotResponse, ColumnDistributionResponse } from "@/lib/types";

export default function QualityPage() {
  const [quality, setQuality] = useState<QualityAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [qualityError, setQualityError] = useState<string | null>(null);
  const [selectedCol, setSelectedCol] = useState<string>("");
  const [distData, setDistData] = useState<ColumnDistributionResponse | null>(null);
  const [distLoading, setDistLoading] = useState(false);
  const [distError, setDistError] = useState<string | null>(null);

  // Copilot Assistant State
  const [copilotQuery, setCopilotQuery] = useState("");
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [copilotError, setCopilotError] = useState<string | null>(null);
  const [copilotResponse, setCopilotResponse] = useState<CopilotResponse | null>(null);

  const fetchQuality = async () => {
    setLoading(true);
    setQualityError(null);
    try {
      const q = await api.getQualityAnalysis();
      setQuality(q);
      const firstCol = Object.keys(q.missing_summary)[0];
      if (firstCol) {
        setSelectedCol(firstCol);
      }
    } catch (e: any) {
      console.error(e);
      setQualityError(e.response?.data?.detail || "Failed to load quality analysis. Ensure a dataset is active in your workspace.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuality();
  }, []);

  const fetchColumnDistribution = (colName: string) => {
    if (!colName) return;
    setDistLoading(true);
    setDistError(null);
    api.getColumnDistribution(colName)
      .then((res) => {
        setDistData(res);
        setDistError(null);
      })
      .catch((err: any) => {
        console.error(err);
        setDistError(err.response?.data?.detail || "Failed to calculate distribution histogram.");
        setDistData(null);
      })
      .finally(() => setDistLoading(false));
  };

  useEffect(() => {
    if (selectedCol) {
      fetchColumnDistribution(selectedCol);
    }
  }, [selectedCol]);

  const handleAskCopilot = async (question?: string) => {
    const qText = question || copilotQuery;
    if (!qText.trim()) return;
    setCopilotLoading(true);
    setCopilotError(null);
    try {
      const res = await api.queryCopilot(qText);
      setCopilotResponse(res);
      setCopilotQuery("");
    } catch (e: any) {
      console.error(e);
      setCopilotError(e.response?.data?.detail || "Copilot failed to generate an answer. Click to retry.");
    } finally {
      setCopilotLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090B] text-zinc-100 flex items-center justify-center p-8">
        <div className="p-8 rounded-2xl border border-zinc-800 bg-[#101014] text-center space-y-3">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500 mx-auto" />
          <div className="text-xs font-mono text-zinc-400">
            Computing statistical moments, IQR outlier boundaries, and quality health scores...
          </div>
        </div>
      </div>
    );
  }

  if (qualityError) {
    return (
      <div className="min-h-screen bg-[#09090B] text-zinc-100 p-8 flex items-center justify-center">
        <div className="max-w-xl mx-auto rounded-2xl border border-rose-500/30 bg-[#101014] p-10 text-center space-y-5">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-base font-bold text-white">Quality Analysis Error</h3>
            <p className="text-xs text-rose-300 max-w-sm mx-auto leading-relaxed">
              {qualityError}
            </p>
          </div>
          <div className="flex items-center justify-center space-x-3 pt-2">
            <button
              onClick={() => fetchQuality()}
              className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold border border-zinc-700 transition-colors"
            >
              Retry Analysis
            </button>
            <Link
              href="/explorer"
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-all"
            >
              <span>Go to Explorer</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!quality) {
    return (
      <div className="min-h-screen bg-[#09090B] text-zinc-100 p-8 flex items-center justify-center">
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

  const missingChartData = Object.entries(quality.missing_summary).map(([name, info]) => ({
    name,
    missingPct: info.missing_pct,
    missingCount: info.missing_count,
  }));

  const outlierEntries = quality.outliers ? Object.entries(quality.outliers) : [];

  return (
    <div className="min-h-screen bg-[#09090B] text-zinc-100 p-4 sm:p-6 lg:p-8 selection:bg-blue-600 selection:text-white">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header Breadcrumb */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-800">
          <div className="space-y-1">
            <div className="flex items-center space-x-2 text-xs font-mono text-zinc-500 mb-1">
              <Link href="/explorer" className="hover:text-zinc-300">Explorer</Link>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="text-blue-400">Quality Intelligence &amp; Profiling</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center space-x-3">
              <span>Data Quality Intelligence</span>
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400">
              Audit completeness, IQR numerical outliers, target leakage risks, and high-cardinality flags.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <Link
              href="/studio"
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm shadow-blue-600/30 transition-all active:scale-95"
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>Proceed to ML Studio</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Top 4 KPI Health Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl border border-zinc-800 bg-[#101014] space-y-2">
            <div className="flex items-center justify-between text-zinc-400 text-xs font-mono">
              <span>Completeness Score</span>
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-3xl font-bold font-mono text-white">
              {quality.overview.completeness_score}%
            </div>
            <div className="text-xs text-zinc-500">
              {quality.overview.total_missing_cells.toLocaleString()} missing cells out of{" "}
              {quality.overview.total_cells.toLocaleString()}
            </div>
          </div>

          <div className="p-5 rounded-2xl border border-zinc-800 bg-[#101014] space-y-2">
            <div className="flex items-center justify-between text-zinc-400 text-xs font-mono">
              <span>Duplicate Rows</span>
              <TableIcon className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-3xl font-bold font-mono text-white">
              {quality.overview.duplicate_rows}
            </div>
            <div className="text-xs text-zinc-500">
              {quality.overview.duplicate_pct}% duplication rate
            </div>
          </div>

          <div className="p-5 rounded-2xl border border-zinc-800 bg-[#101014] space-y-2">
            <div className="flex items-center justify-between text-zinc-400 text-xs font-mono">
              <span>Features Audited</span>
              <Layers className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-3xl font-bold font-mono text-white">
              {quality.overview.total_cols}
            </div>
            <div className="text-xs text-zinc-500">
              {quality.column_types.numeric.length} numeric, {quality.column_types.categorical.length} categorical
            </div>
          </div>

          <div className="p-5 rounded-2xl border border-zinc-800 bg-[#101014] space-y-2">
            <div className="flex items-center justify-between text-zinc-400 text-xs font-mono">
              <span>Memory Footprint</span>
              <Cpu className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-3xl font-bold font-mono text-white">
              {quality.overview.memory_mb} <span className="text-sm font-normal text-zinc-400">MB</span>
            </div>
            <div className="text-xs text-zinc-500">
              {quality.overview.total_rows.toLocaleString()} memory-resident records
            </div>
          </div>
        </div>

        {/* AI DATASET COPILOT ASSISTANT */}
        <div className="rounded-2xl border border-blue-500/30 bg-gradient-to-r from-blue-950/20 via-zinc-900/60 to-zinc-900/40 p-6 space-y-4 shadow-lg shadow-blue-950/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-white">AI Dataset Copilot</h3>
                <p className="text-xs text-zinc-400">Deterministic workspace intelligence based on verified audit metrics</p>
              </div>
            </div>
          </div>

          {/* Quick Questions Buttons */}
          <div className="flex flex-wrap gap-2 pt-1">
            {[
              "Explain my dataset",
              "Which columns have missing values?",
              "What should I clean first?",
              "Are there any outliers?",
            ].map((prompt) => (
              <button
                key={prompt}
                onClick={() => handleAskCopilot(prompt)}
                className="px-3 py-1 rounded-lg border border-zinc-700 bg-zinc-800/80 hover:bg-zinc-700 text-xs text-zinc-300 hover:text-white transition-colors"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Input Box */}
          <div className="flex items-center space-x-2 pt-2">
            <input
              type="text"
              value={copilotQuery}
              onChange={(e) => setCopilotQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAskCopilot()}
              placeholder="Ask Copilot a question about this dataset (e.g. 'Explain my dataset' or 'What should I clean first?')..."
              className="flex-1 p-2.5 rounded-xl border border-zinc-700 bg-zinc-950/80 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={() => handleAskCopilot()}
              disabled={copilotLoading}
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center space-x-1.5 transition-colors disabled:opacity-50"
            >
              {copilotLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              <span>Ask</span>
            </button>
          </div>

          {/* Copilot Error Alert */}
          {copilotError && (
            <div className="mt-2 p-3 rounded-xl border border-rose-500/30 bg-rose-950/20 text-xs text-rose-300 flex items-center justify-between">
              <span>{copilotError}</span>
              <button
                onClick={() => handleAskCopilot()}
                className="px-2.5 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-white font-semibold transition-colors"
              >
                Retry
              </button>
            </div>
          )}

          {/* Copilot Answer Display */}
          {copilotResponse && (
            <div className="mt-3 p-4 rounded-xl border border-blue-500/20 bg-blue-950/30 text-xs text-zinc-200 space-y-2 animate-in fade-in duration-200">
              <div className="font-semibold text-blue-300 text-[11px] uppercase tracking-wider font-mono">
                Copilot Analysis ({copilotResponse.intent})
              </div>
              <div className="whitespace-pre-line leading-relaxed text-zinc-100">
                {copilotResponse.answer}
              </div>
            </div>
          )}
        </div>

        {/* Automated Recommendations */}
        {quality.recommendations.length > 0 && (
          <div className="rounded-2xl border border-zinc-800 bg-[#101014] p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center space-x-2">
                <Info className="w-4 h-4 text-blue-400" />
                <h3 className="font-semibold text-sm text-white">
                  Automated Quality Recommendations ({quality.recommendations.length})
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

        {/* Outlier Detection via IQR */}
        {outlierEntries.length > 0 && (
          <div className="rounded-2xl border border-zinc-800 bg-[#101014] p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <h3 className="font-semibold text-sm text-white flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span>Numerical Outlier Detection (Interquartile Range Method)</span>
              </h3>
              <span className="text-xs font-mono text-zinc-500">Boundaries: Q1 - 1.5×IQR / Q3 + 1.5×IQR</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {outlierEntries.map(([col, o]) => (
                <div key={col} className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-semibold text-zinc-200">{col}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      o.outlier_pct > 3.0 ? "bg-rose-500/20 text-rose-400" : "bg-zinc-800 text-zinc-400"
                    }`}>
                      {o.outlier_count} outliers ({o.outlier_pct}%)
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-zinc-500">
                    Valid Range: [{o.lower_bound} to {o.upper_bound}]
                  </div>
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
            ) : distError ? (
              <div className="h-64 flex flex-col items-center justify-center p-6 text-center space-y-3">
                <AlertTriangle className="w-6 h-6 text-rose-400" />
                <div className="text-xs text-rose-300 font-mono">{distError}</div>
                <button
                  onClick={() => fetchColumnDistribution(selectedCol)}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-white border border-zinc-700 transition-colors"
                >
                  Retry Distribution Profiling
                </button>
              </div>
            ) : distData?.type === "empty" ? (
              <div className="h-64 flex flex-col items-center justify-center p-6 text-center space-y-2 text-zinc-500">
                <AlertCircle className="w-6 h-6 text-zinc-600" />
                <div className="text-xs font-mono">No non-null observations in column &apos;{selectedCol}&apos;.</div>
              </div>
            ) : distData?.type === "categorical" ? (
              <div className="space-y-4">
                <div className="h-52 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={distData.categories || []}>
                      <CartesianGrid strokeDasharray="2 2" stroke="#27272A" vertical={false} />
                      <XAxis dataKey="category" stroke="#71717A" fontSize={10} interval={0} angle={-15} textAnchor="end" />
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
                      <Bar dataKey="count" fill="#3B82F6" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center p-3 rounded-xl bg-zinc-900/40 border border-zinc-800/80 text-xs">
                  <div>
                    <div className="text-zinc-500 text-[10px] uppercase font-mono">Distinct Categories</div>
                    <div className="font-bold text-white">{distData.unique ?? distData.categories?.length ?? "N/A"}</div>
                  </div>
                  <div>
                    <div className="text-zinc-500 text-[10px] uppercase font-mono">Top Category</div>
                    <div className="font-bold text-blue-400 truncate">{distData.categories?.[0]?.category ?? "N/A"}</div>
                  </div>
                  <div>
                    <div className="text-zinc-500 text-[10px] uppercase font-mono">Top Category Count</div>
                    <div className="font-bold text-white">{distData.categories?.[0]?.count ?? "N/A"}</div>
                  </div>
                </div>
              </div>
            ) : distData?.type === "numeric" ? (
              <div className="space-y-4">
                <div className="h-52 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={distData.bins || []}>
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

                <div className="grid grid-cols-4 gap-2 text-center p-3 rounded-xl bg-zinc-900/40 border border-zinc-800/80 text-xs">
                  <div>
                    <div className="text-zinc-500 text-[10px] uppercase font-mono">Mean</div>
                    <div className="font-bold text-white">{distData.mean !== undefined ? distData.mean.toFixed(2) : "N/A"}</div>
                  </div>
                  <div>
                    <div className="text-zinc-500 text-[10px] uppercase font-mono">Median</div>
                    <div className="font-bold text-white">{distData.median !== undefined ? distData.median.toFixed(2) : "N/A"}</div>
                  </div>
                  <div>
                    <div className="text-zinc-500 text-[10px] uppercase font-mono">Min</div>
                    <div className="font-bold text-white">{distData.min !== undefined ? distData.min.toFixed(2) : "N/A"}</div>
                  </div>
                  <div>
                    <div className="text-zinc-500 text-[10px] uppercase font-mono">Max</div>
                    <div className="font-bold text-white">{distData.max !== undefined ? distData.max.toFixed(2) : "N/A"}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-xs font-mono text-zinc-500">
                Select a column from the dropdown above
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
