"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Award,
  BarChart3,
  ArrowRight,
  Download,
  Cpu,
  Layers,
  Sparkles,
  TrendingUp,
  FileCode,
  ArrowUpRight,
  CheckCircle2,
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
  ScatterChart,
  Scatter,
} from "recharts";
import { api } from "@/lib/api";
import { ModelComparisonResponse, ModelDiagnosticsResponse } from "@/lib/types";
import { EmptyState } from "@/components/empty-state";
import { RetroDock } from "@/components/retro-dock";
import { RetroRocketIcon, RetroDisketteIcon } from "@/components/retro-icons";

export default function ComparisonPage() {
  const [comparison, setComparison] = useState<ModelComparisonResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // Deep inspection state
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [diagnostics, setDiagnostics] = useState<ModelDiagnosticsResponse | null>(null);
  const [diagLoading, setDiagLoading] = useState(false);

  // Metric to chart
  const [selectedMetric, setSelectedMetric] = useState<string>("");

  useEffect(() => {
    async function init() {
      try {
        const comp = await api.getModelComparison("default");
        setComparison(comp);

        if (comp.available_models.length > 0) {
          setSelectedModel(comp.champion.name || comp.available_models[0]);
        }
        if (comp.scoreboard.length > 0) {
          const keys = Object.keys(comp.scoreboard[0]).filter(
            (k) => !["Model", "Training Time (s)"].includes(k)
          );
          if (keys.length > 0) setSelectedMetric(keys[0]);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  useEffect(() => {
    if (!selectedModel) return;
    setDiagLoading(true);
    api
      .getModelDiagnostics(selectedModel, "default")
      .then(setDiagnostics)
      .catch(console.error)
      .finally(() => setDiagLoading(false));
  }, [selectedModel]);

  const handleDownloadModel = async (modelName: string) => {
    try {
      const blob = await api.downloadModel(modelName, "default");
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${modelName.replace(/\s+/g, "_").toLowerCase()}_pipeline.joblib`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Failed to download model", e);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0C0C0E] text-white flex items-center justify-center p-8 bg-retro-grid">
        <div className="retro-window-dark p-8 text-center space-y-3 border border-zinc-800">
          <Loader2 className="w-6 h-6 animate-spin text-[#1864FF] mx-auto" />
          <div className="font-mono text-xs uppercase tracking-wider text-zinc-300">
            COMPUTING TOURNAMENT SCOREBOARD & CROSS-VALIDATION STATS...
          </div>
        </div>
      </div>
    );
  }

  if (!comparison || comparison.scoreboard.length === 0) {
    return (
      <div className="min-h-screen bg-[#0C0C0E] text-white p-8 bg-retro-grid">
        <div className="max-w-xl mx-auto retro-window-dark p-8 text-center space-y-6 border border-zinc-800">
          <RetroRocketIcon size={48} className="mx-auto" />
          <div className="space-y-2">
            <h3 className="font-mono text-base font-bold uppercase">NO MODELS EVALUATED YET</h3>
            <p className="font-mono text-xs text-zinc-400">
              Please train candidate models in the ML Studio before inspecting tournament benchmarks.
            </p>
          </div>
          <Link href="/studio" className="btn-retro btn-retro-blue text-xs py-2 px-4">
            GO TO ML STUDIO ↗
          </Link>
        </div>
      </div>
    );
  }

  // Bar chart data from scoreboard
  const chartData = comparison.scoreboard.map((row) => ({
    name: row["Model"],
    value: row[selectedMetric] || 0,
  }));

  const metricOptions = Object.keys(comparison.scoreboard[0]).filter(
    (k) => !["Model", "Training Time (s)"].includes(k)
  );

  return (
    <div className="min-h-screen bg-[#0C0C0E] text-white p-4 sm:p-6 lg:p-8 bg-retro-grid selection:bg-[#1864FF] selection:text-white">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Workstation Title Header */}
        <div className="retro-window-dark p-4 border border-zinc-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-[#EF4444] font-mono text-xs font-bold uppercase tracking-wider">
                <span className="w-2 h-2 bg-[#EF4444] inline-block" />
                <span>MODULE_05 // TOURNAMENT BENCHMARKS & LEADERBOARD</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-mono font-bold tracking-tight text-white uppercase">
                MODEL SHOWDOWN
              </h1>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/reports"
                className="btn-retro btn-retro-blue text-xs flex items-center gap-1.5"
              >
                <FileCode className="w-3.5 h-3.5" />
                <span>EXPORT REPORT CENTER</span>
                <span>↗</span>
              </Link>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-3 font-mono text-xs text-zinc-400">
            <div>
              PROBLEM TYPE: <span className="text-white font-bold uppercase">{comparison.problem_type}</span>
            </div>
            <div>
              TOTAL ARCHITECTURES BENCHMARKED: {comparison.scoreboard.length}
            </div>
          </div>
        </div>

        {/* Champion Model Banner (Retro Silver Window) */}
        <div className="retro-window-light border border-black p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-[#1864FF] text-white flex items-center justify-center font-bold text-xl border border-black shadow-[2px_2px_0px_0px_#000]">
              ★
            </div>
            <div className="space-y-0.5">
              <div className="font-mono text-xs font-bold uppercase tracking-wider text-black">
                CHAMPION ARCHITECTURE BENCHMARK
              </div>
              <div className="text-xl font-bold font-mono text-black">
                {comparison.champion.name}
              </div>
              <div className="font-mono text-xs text-zinc-600">
                OPTIMIZED METRIC: {comparison.champion.metric} ={" "}
                <span className="font-bold text-[#1864FF]">
                  {(comparison.champion.score * 100).toFixed(2)}%
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleDownloadModel(comparison.champion.name)}
              className="btn-retro btn-retro-blue text-xs py-2 px-4 flex items-center gap-2 shadow-[2px_2px_0px_0px_#002B99]"
            >
              <Download className="w-3.5 h-3.5" />
              <span>DOWNLOAD .JOBLIB BINARY</span>
            </button>
          </div>
        </div>

        {/* Tournament Scoreboard Table */}
        <div className="retro-window-dark border border-zinc-800 overflow-hidden space-y-0">
          <div className="p-4 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between">
            <span className="font-mono text-xs font-bold uppercase text-white">
              TOURNAMENT SCOREBOARD LEADERBOARD
            </span>
            <span className="text-[10px] font-mono text-zinc-500">
              SORTED BY PRIMARY EVALUATION CRITERION
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead className="bg-[#121215] border-b border-zinc-800 text-zinc-400 uppercase text-[11px]">
                <tr>
                  <th className="p-3">RANK</th>
                  <th className="p-3">MODEL ALGORITHM</th>
                  {metricOptions.map((m) => (
                    <th key={m} className="p-3 text-right">
                      {m}
                    </th>
                  ))}
                  <th className="p-3 text-right">TRAIN TIME (S)</th>
                  <th className="p-3 text-center">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800 bg-[#0C0C0E]">
                {comparison.scoreboard.map((row, idx) => {
                  const isChamp = row["Model"] === comparison.champion.name;
                  const isSelected = row["Model"] === selectedModel;
                  return (
                    <tr
                      key={row["Model"]}
                      className={`hover:bg-zinc-900/60 transition-colors ${
                        isSelected ? "bg-zinc-900/90" : ""
                      }`}
                    >
                      <td className="p-3 font-bold text-zinc-500">
                        {isChamp ? <span className="text-amber-400 font-black">#1 ★</span> : `#${idx + 1}`}
                      </td>
                      <td className="p-3 font-bold text-white flex items-center gap-2">
                        <span className={`w-2 h-2 ${isChamp ? "bg-amber-400" : "bg-[#1864FF]"}`} />
                        <span>{row["Model"]}</span>
                      </td>
                      {metricOptions.map((m) => (
                        <td key={m} className="p-3 text-right text-zinc-300 font-bold">
                          {typeof row[m] === "number" ? row[m].toFixed(4) : row[m]}
                        </td>
                      ))}
                      <td className="p-3 text-right text-zinc-400">
                        {row["Training Time (s)"]?.toFixed(3) || "0.010"}s
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => setSelectedModel(row["Model"])}
                          className={`px-2 py-1 font-mono text-[10px] font-bold uppercase border ${
                            isSelected
                              ? "bg-[#1864FF] text-white border-white"
                              : "bg-zinc-900 text-zinc-400 border-zinc-700 hover:text-white"
                          }`}
                        >
                          INSPECT
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Visual Benchmark Chart & Deep Diagnostics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Metric Comparison Bar Chart */}
          <div className="retro-window-dark p-4 border border-zinc-800 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800 font-mono text-xs font-bold uppercase">
              <span>METRIC SHOWDOWN CHART</span>
              <select
                value={selectedMetric}
                onChange={(e) => setSelectedMetric(e.target.value)}
                className="bg-zinc-900 border border-zinc-700 font-mono text-[11px] text-white px-2 py-1 uppercase focus:outline-none focus:border-[#1864FF]"
              >
                {metricOptions.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
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
                  <Bar dataKey="value" fill="#1864FF">
                    {chartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.name === comparison.champion.name ? "#9AE6B4" : "#1864FF"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Deep Inspection Panel */}
          <div className="retro-window-dark p-4 border border-zinc-800 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800 font-mono text-xs font-bold uppercase">
              <span>DEEP DIAGNOSTICS: {selectedModel}</span>
              <button
                onClick={() => handleDownloadModel(selectedModel)}
                className="text-[10px] font-mono text-[#1864FF] hover:underline flex items-center gap-1 font-bold"
              >
                <Download className="w-3 h-3" />
                <span>SAVE .JOBLIB</span>
              </button>
            </div>

            {diagLoading ? (
              <div className="h-64 flex items-center justify-center font-mono text-xs text-zinc-500 gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-[#1864FF]" />
                <span>EXTRACTING CONFUSION MATRIX & RESIDUALS...</span>
              </div>
            ) : diagnostics ? (
              <div className="space-y-4">
                {/* Confusion Matrix (Classification) */}
                {diagnostics.confusion_matrix && (
                  <div className="space-y-2">
                    <div className="font-mono text-[11px] text-zinc-400 uppercase font-bold">
                      CONFUSION MATRIX INTENSITY GRID
                    </div>
                    <div className="overflow-x-auto p-2 bg-zinc-950 border border-zinc-800">
                      <table className="w-full text-center font-mono text-xs">
                        <thead>
                          <tr className="border-b border-zinc-800 text-[10px] text-zinc-400">
                            <th className="p-1">PRED \ TRUE</th>
                            {(diagnostics.class_labels || []).map((l) => (
                              <th key={l} className="p-1 uppercase">{l}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {diagnostics.confusion_matrix.map((row, rIdx) => (
                            <tr key={rIdx} className="border-b border-zinc-900">
                              <td className="p-1 text-[10px] font-bold text-zinc-400 uppercase">
                                {diagnostics.class_labels?.[rIdx] || `C${rIdx}`}
                              </td>
                              {row.map((cellVal, cIdx) => (
                                <td
                                  key={cIdx}
                                  className={`p-2 font-bold ${
                                    rIdx === cIdx
                                      ? "bg-[#1864FF]/40 text-[#93C5FD]"
                                      : cellVal > 0
                                      ? "bg-red-950/40 text-red-300"
                                      : "text-zinc-600"
                                  }`}
                                >
                                  {cellVal}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Residuals (Regression) */}
                {diagnostics.residuals && (
                  <div className="space-y-2">
                    <div className="font-mono text-[11px] text-zinc-400 uppercase font-bold">
                      RESIDUALS DISTRIBUTION (Y_TRUE VS RESIDUAL)
                    </div>
                    <div className="h-44 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <ScatterChart>
                          <CartesianGrid strokeDasharray="2 2" stroke="#27272A" />
                          <XAxis dataKey="y_true" name="True Value" stroke="#71717A" fontSize={10} fontFamily="monospace" />
                          <YAxis dataKey="residual" name="Residual" stroke="#71717A" fontSize={10} fontFamily="monospace" />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "#0C0C0E",
                              border: "1px solid #000000",
                              fontFamily: "monospace",
                              fontSize: "11px",
                              color: "#FFFFFF",
                            }}
                          />
                          <Scatter
                            data={diagnostics.residuals.map((r, i) => ({
                              residual: r,
                              y_true: diagnostics.ground_truth?.[i] ?? i,
                            }))}
                            fill="#9AE6B4"
                          />
                        </ScatterChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center font-mono text-xs text-zinc-500">
                SELECT A MODEL FROM THE SCOREBOARD ABOVE
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Floating Retro Dock */}
      <RetroDock />
    </div>
  );
}
