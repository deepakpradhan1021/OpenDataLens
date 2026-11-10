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
  Table as TableIcon,
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
      <div className="min-h-screen bg-[#09090B] text-zinc-100 flex items-center justify-center p-8">
        <div className="p-8 rounded-2xl border border-zinc-800 bg-[#101014] text-center space-y-3">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500 mx-auto" />
          <div className="text-xs font-mono text-zinc-400">
            Synthesizing cross-validation metrics and leaderboard rankings...
          </div>
        </div>
      </div>
    );
  }

  if (!comparison || comparison.scoreboard.length === 0) {
    return (
      <div className="min-h-screen bg-[#09090B] text-zinc-100 p-8">
        <div className="max-w-xl mx-auto rounded-2xl border border-zinc-800 bg-[#101014] p-10 text-center space-y-5">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-base font-bold text-white">No Models Evaluated Yet</h3>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto leading-relaxed">
              Dispatch training jobs in the ML Studio to compare cross-validated models on your active dataset.
            </p>
          </div>
          <Link
            href="/studio"
            className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-all"
          >
            <span>Open ML Studio</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    );
  }

  const chartData = comparison.scoreboard.map((row) => ({
    name: row["Model"],
    value: row[selectedMetric] || 0,
  }));

  const metricOptions = Object.keys(comparison.scoreboard[0]).filter(
    (k) => !["Model", "Training Time (s)"].includes(k)
  );

  return (
    <div className="min-h-screen bg-[#09090B] text-zinc-100 p-4 sm:p-6 lg:p-8 selection:bg-blue-600 selection:text-white">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-800">
          <div className="space-y-1">
            <div className="flex items-center space-x-2 text-xs font-mono text-blue-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              <span>Multi-Model Evaluation &amp; Benchmarks</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Model Comparison
            </h1>
          </div>

          <div className="flex items-center space-x-3">
            <Link
              href="/reports"
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm shadow-blue-600/30 transition-all"
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>Export Dossier</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Champion Model Banner */}
        <div className="rounded-2xl border border-blue-500/30 bg-gradient-to-r from-blue-900/20 via-indigo-900/20 to-zinc-900/40 p-6 flex flex-col md:flex-row md:items-center justify-between gap-5 shadow-lg shadow-blue-950/30">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold text-xl shadow-md shadow-blue-600/40 shrink-0">
              ★
            </div>
            <div className="space-y-1">
              <div className="text-xs font-semibold text-blue-400 uppercase tracking-wider">
                Champion Model Architecture
              </div>
              <div className="text-xl font-bold text-white">
                {comparison.champion.name}
              </div>
              <div className="text-xs text-zinc-400 font-mono">
                Primary Metric: {comparison.champion.metric} ={" "}
                <span className="font-bold text-emerald-400">
                  {(comparison.champion.score * 100).toFixed(2)}%
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleDownloadModel(comparison.champion.name)}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm flex items-center space-x-2 transition-all active:scale-95"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export .joblib Binary</span>
            </button>
          </div>
        </div>

        {/* Tournament Scoreboard Table */}
        <div className="rounded-2xl border border-zinc-800 bg-[#101014] overflow-hidden">
          <div className="p-4 sm:p-5 bg-zinc-900/50 border-b border-zinc-800 flex items-center justify-between">
            <h3 className="font-semibold text-sm text-white">
              Model Performance Scoreboard ({comparison.scoreboard.length} Algorithms)
            </h3>
            <span className="text-xs font-mono text-zinc-500">
              Ranked by {comparison.champion.metric}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-zinc-950 border-b border-zinc-800 text-zinc-400 uppercase text-[11px]">
                <tr>
                  <th className="p-3.5">Rank</th>
                  <th className="p-3.5">Model Algorithm</th>
                  {metricOptions.map((m) => (
                    <th key={m} className="p-3.5 text-right">
                      {m}
                    </th>
                  ))}
                  <th className="p-3.5 text-right">Train Time (s)</th>
                  <th className="p-3.5 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/80 bg-[#0A0A0D]">
                {comparison.scoreboard.map((row, idx) => {
                  const isChamp = row["Model"] === comparison.champion.name;
                  const isSelected = row["Model"] === selectedModel;
                  return (
                    <tr
                      key={row["Model"]}
                      className={`hover:bg-zinc-900/40 transition-colors ${
                        isSelected ? "bg-zinc-900/60" : ""
                      }`}
                    >
                      <td className="p-3.5 font-bold">
                        {isChamp ? <span className="text-amber-400">#1 ★</span> : <span className="text-zinc-500">#{idx + 1}</span>}
                      </td>
                      <td className="p-3.5 font-semibold text-white">
                        <div className="flex items-center space-x-2">
                          <span className={`w-2 h-2 rounded-full ${isChamp ? "bg-amber-400" : "bg-blue-500"}`} />
                          <span>{row["Model"]}</span>
                        </div>
                      </td>
                      {metricOptions.map((m) => (
                        <td key={m} className="p-3.5 text-right text-zinc-300 font-medium">
                          {typeof row[m] === "number" ? row[m].toFixed(4) : row[m]}
                        </td>
                      ))}
                      <td className="p-3.5 text-right text-zinc-400">
                        {row["Training Time (s)"]?.toFixed(3) || "0.010"}s
                      </td>
                      <td className="p-3.5 text-center">
                        <button
                          onClick={() => setSelectedModel(row["Model"])}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                            isSelected
                              ? "bg-blue-600 text-white shadow-sm"
                              : "bg-zinc-800 text-zinc-400 hover:text-white"
                          }`}
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Charts & Diagnostics Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Metric Comparison Chart */}
          <div className="rounded-2xl border border-zinc-800 bg-[#101014] p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <h3 className="font-semibold text-sm text-white">Benchmark Comparison Chart</h3>
              <select
                value={selectedMetric}
                onChange={(e) => setSelectedMetric(e.target.value)}
                className="bg-zinc-900 border border-zinc-700 rounded-lg text-xs text-white px-3 py-1.5 focus:outline-none focus:border-blue-500"
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
                    fontSize={11}
                    interval={0}
                    angle={-20}
                    textAnchor="end"
                  />
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
                  <Bar dataKey="value" fill="#3B82F6">
                    {chartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.name === comparison.champion.name ? "#10B981" : "#3B82F6"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Deep Inspection Panel */}
          <div className="rounded-2xl border border-zinc-800 bg-[#101014] p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="space-y-0.5">
                <h3 className="font-semibold text-sm text-white">Inspection: {selectedModel}</h3>
                <span className="text-[11px] font-mono text-zinc-500">Diagnostics &amp; Export</span>
              </div>
              <button
                onClick={() => handleDownloadModel(selectedModel)}
                className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center space-x-1"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Pipeline</span>
              </button>
            </div>

            {diagLoading ? (
              <div className="h-64 flex items-center justify-center text-xs font-mono text-zinc-500 space-x-2">
                <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                <span>Generating confusion matrix &amp; residual vectors...</span>
              </div>
            ) : diagnostics ? (
              <div className="space-y-4">
                {/* Confusion Matrix (Classification) */}
                {diagnostics.confusion_matrix && (
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-zinc-400">
                      Confusion Matrix Intensity Grid
                    </div>
                    <div className="overflow-x-auto p-3 rounded-xl bg-zinc-950 border border-zinc-800">
                      <table className="w-full text-center text-xs font-mono">
                        <thead>
                          <tr className="border-b border-zinc-800 text-[11px] text-zinc-400">
                            <th className="p-1.5">Pred \ True</th>
                            {(diagnostics.class_labels || []).map((l) => (
                              <th key={l} className="p-1.5">{l}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {diagnostics.confusion_matrix.map((row, rIdx) => (
                            <tr key={rIdx} className="border-b border-zinc-900">
                              <td className="p-1.5 text-[11px] font-semibold text-zinc-400">
                                {diagnostics.class_labels?.[rIdx] || `C${rIdx}`}
                              </td>
                              {row.map((cellVal, cIdx) => (
                                <td
                                  key={cIdx}
                                  className={`p-2 font-bold rounded ${
                                    rIdx === cIdx
                                      ? "bg-blue-600/30 text-blue-300"
                                      : cellVal > 0
                                      ? "bg-red-500/10 text-red-400"
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
                {diagnostics.residuals && diagnostics.ground_truth && (
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-zinc-400">
                      Residuals Distribution (y_true vs residual error)
                    </div>
                    <div className="h-44 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <ScatterChart>
                          <CartesianGrid strokeDasharray="2 2" stroke="#27272A" />
                          <XAxis dataKey="y_true" name="True Value" stroke="#71717A" fontSize={11} />
                          <YAxis dataKey="residual" name="Residual" stroke="#71717A" fontSize={11} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "#101014",
                              border: "1px solid #27272A",
                              borderRadius: "8px",
                              fontSize: "12px",
                              color: "#FFFFFF",
                            }}
                          />
                          <Scatter
                            data={diagnostics.residuals.map((r, i) => ({
                              residual: r,
                              y_true: diagnostics.ground_truth?.[i] ?? i,
                            }))}
                            fill="#10B981"
                          />
                        </ScatterChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-xs font-mono text-zinc-500">
                Select an algorithm from the scoreboard above
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Floating Command Dock */}
      <RetroDock />
    </div>
  );
}
