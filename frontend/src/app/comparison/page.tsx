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
  CheckCircle2,
  Loader2,
  Table as TableIcon,
  HelpCircle,
  Clock,
  History,
  Activity,
  ChevronRight,
  BrainCircuit,
  Sliders,
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
import {
  ModelComparisonResponse,
  ModelDiagnosticsResponse,
  ExplainabilityResponse,
  ExperimentRun,
} from "@/lib/types";

function formatScoreValue(score: number | null | undefined, metricName?: string, problemType?: string): string {
  if (score === null || score === undefined || typeof score !== "number") return "N/A";
  const m = (metricName || "").toLowerCase();
  const isRegression = problemType === "regression" || m.includes("r²") || m.includes("r2") || m.includes("mae") || m.includes("rmse") || m.includes("mse");
  if (isRegression) {
    return score.toFixed(4);
  }
  // Classification rates: Accuracy, Macro F1, Precision, Recall
  if (score <= 1.0) {
    return `${(score * 100).toFixed(2)}%`;
  }
  return score.toFixed(4);
}

export default function ComparisonPage() {
  const [activeTab, setActiveTab] = useState<"leaderboard" | "explainability" | "experiments">("leaderboard");
  const [comparison, setComparison] = useState<ModelComparisonResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // Deep inspection state
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [diagnostics, setDiagnostics] = useState<ModelDiagnosticsResponse | null>(null);
  const [diagLoading, setDiagLoading] = useState(false);

  // Explainability state
  const [explainData, setExplainData] = useState<ExplainabilityResponse | null>(null);
  const [explainLoading, setExplainLoading] = useState(false);

  // Experiments state
  const [experiments, setExperiments] = useState<ExperimentRun[]>([]);
  const [expLoading, setExpLoading] = useState(false);

  // Metric to chart
  const [selectedMetric, setSelectedMetric] = useState<string>("");

  useEffect(() => {
    async function init() {
      try {
        const comp = await api.getModelComparison();
        setComparison(comp);

        if (comp.available_models.length > 0) {
          setSelectedModel(comp.champion.name || comp.available_models[0]);
        }
        if (comp.scoreboard.length > 0) {
          const keys = Object.keys(comp.scoreboard[0]).filter(
            (k) => !["Model", "Training Time (s)", "CV Score (Mean ± Std)"].includes(k)
          );
          if (keys.length > 0) setSelectedMetric(keys[0]);
        }
      } catch (e) {
        console.error("Comparison load error:", e);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  useEffect(() => {
    if (!selectedModel) return;
    setDiagLoading(true);
    api.getModelDiagnostics(selectedModel)
      .then(setDiagnostics)
      .catch(console.error)
      .finally(() => setDiagLoading(false));
  }, [selectedModel]);

  useEffect(() => {
    if (activeTab === "explainability") {
      setExplainLoading(true);
      api.getExplainability(selectedModel)
        .then(setExplainData)
        .catch(console.error)
        .finally(() => setExplainLoading(false));
    } else if (activeTab === "experiments") {
      setExpLoading(true);
      api.getExperiments()
        .then((res) => setExperiments(res.experiments || []))
        .catch(console.error)
        .finally(() => setExpLoading(false));
    }
  }, [activeTab, selectedModel]);

  const handleDownloadModel = (modelName: string) => {
    window.open(api.downloadModelPipeline(modelName), "_blank");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090B] text-zinc-100 flex items-center justify-center p-8">
        <div className="p-8 rounded-2xl border border-zinc-800 bg-[#101014] text-center space-y-3">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500 mx-auto" />
          <div className="text-xs font-mono text-zinc-400">
            Synthesizing cross-validation metrics, leaderboard rankings, and explainability vectors...
          </div>
        </div>
      </div>
    );
  }

  if (!comparison || comparison.scoreboard.length === 0) {
    return (
      <div className="min-h-screen bg-[#09090B] text-zinc-100 p-8 flex items-center justify-center">
        <div className="max-w-xl mx-auto rounded-2xl border border-zinc-800 bg-[#101014] p-10 text-center space-y-5">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-base font-bold text-white">No Models Evaluated Yet</h3>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto leading-relaxed">
              Dispatch training jobs in the ML Studio to compare cross-validated models and view feature explainability on your active dataset.
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
    value: typeof row[selectedMetric] === "number" ? row[selectedMetric] : 0,
  }));

  const metricOptions = Object.keys(comparison.scoreboard[0]).filter(
    (k) => !["Model", "Training Time (s)", "CV Score (Mean ± Std)"].includes(k)
  );

  return (
    <div className="min-h-screen bg-[#09090B] text-zinc-100 p-4 sm:p-6 lg:p-8 selection:bg-blue-600 selection:text-white">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header Breadcrumb */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-800">
          <div className="space-y-1">
            <div className="flex items-center space-x-2 text-xs font-mono text-zinc-500 mb-1">
              <Link href="/studio" className="hover:text-zinc-300">ML Studio</Link>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="text-blue-400">Model Evaluation &amp; Explainability</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center space-x-3">
              <span>Model Comparison &amp; Intelligence</span>
            </h1>
          </div>

          <div className="flex items-center space-x-3">
            <Link
              href="/drift"
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold transition-colors"
            >
              <Activity className="w-3.5 h-3.5 text-blue-400" />
              <span>Data Drift</span>
            </Link>

            <Link
              href="/reports"
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm shadow-blue-600/30 transition-all"
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>Export Reports</span>
            </Link>
          </div>
        </div>

        {/* Champion Model Banner */}
        <div className="rounded-2xl border border-blue-500/30 bg-gradient-to-r from-blue-950/30 via-indigo-950/20 to-zinc-900/40 p-6 flex flex-col md:flex-row md:items-center justify-between gap-5 shadow-lg shadow-blue-950/30">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold text-xl shadow-md shadow-blue-600/40 shrink-0">
              ★
            </div>
            <div className="space-y-1">
              <div className="text-xs font-semibold text-blue-400 uppercase tracking-wider font-mono">
                Champion Model Architecture
              </div>
              <div className="text-xl font-bold text-white">
                {comparison.champion.name}
              </div>
              <div className="text-xs text-zinc-400 font-mono">
                Primary Metric: {comparison.champion.metric} ={" "}
                <span className="font-bold text-emerald-400">
                  {formatScoreValue(comparison.champion.score, comparison.champion.metric, comparison.problem_type)}
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

        {/* Navigation Tabs */}
        <div className="flex items-center space-x-2 border-b border-zinc-800 pb-2">
          <button
            onClick={() => setActiveTab("leaderboard")}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center space-x-2 ${
              activeTab === "leaderboard"
                ? "bg-zinc-800 text-white border border-zinc-700 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50"
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 text-blue-400" />
            <span>Scoreboard &amp; Leaderboard</span>
          </button>

          <button
            onClick={() => setActiveTab("explainability")}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center space-x-2 ${
              activeTab === "explainability"
                ? "bg-zinc-800 text-white border border-zinc-700 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50"
            }`}
          >
            <BrainCircuit className="w-3.5 h-3.5 text-purple-400" />
            <span>Explainable AI (XAI)</span>
          </button>

          <button
            onClick={() => setActiveTab("experiments")}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center space-x-2 ${
              activeTab === "experiments"
                ? "bg-zinc-800 text-white border border-zinc-700 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50"
            }`}
          >
            <History className="w-3.5 h-3.5 text-emerald-400" />
            <span>Experiment History</span>
          </button>
        </div>

        {/* TAB 1: LEADERBOARD & VISUALIZATION */}
        {activeTab === "leaderboard" && (
          <div className="space-y-8">
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
                        <th key={m} className="p-3.5 text-right">{m}</th>
                      ))}
                      <th className="p-3.5 text-center">CV Score (Mean ± Std)</th>
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
                            <td key={m} className="p-3.5 text-right font-bold text-zinc-200">
                              {typeof row[m] === "number" ? formatScoreValue(row[m], m, comparison.problem_type) : row[m]}
                            </td>
                          ))}
                          <td className="p-3.5 text-center font-bold text-blue-400">
                            {row["CV Score (Mean ± Std)"] || "N/A"}
                          </td>
                          <td className="p-3.5 text-right text-zinc-400">
                            {row["Training Time (s)"]}s
                          </td>
                          <td className="p-3.5 text-center">
                            <button
                              onClick={() => setSelectedModel(row["Model"])}
                              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                                isSelected
                                  ? "bg-blue-600 text-white"
                                  : "bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
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

            {/* Metric Comparison Bar Chart */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="p-5 rounded-2xl border border-zinc-800 bg-[#101014] space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm text-white">Algorithm Benchmark Comparison</h3>
                  <select
                    value={selectedMetric}
                    onChange={(e) => setSelectedMetric(e.target.value)}
                    className="p-1.5 rounded-lg border border-zinc-700 bg-zinc-900 text-xs font-mono text-zinc-200"
                  >
                    {metricOptions.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272A" vertical={false} />
                      <XAxis dataKey="name" stroke="#71717A" fontSize={10} interval={0} angle={-15} textAnchor="end" />
                      <YAxis stroke="#71717A" fontSize={11} domain={[0, "auto"]} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#18181B",
                          borderColor: "#3F3F46",
                          borderRadius: "8px",
                          fontSize: "12px",
                          color: "#FFFFFF",
                        }}
                      />
                      <Bar dataKey="value" fill="#3B82F6" radius={[4, 4, 0, 0]}>
                        {chartData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={entry.name === comparison.champion.name ? "#F59E0B" : "#3B82F6"}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Model Diagnostics Inspector */}
              <div className="p-5 rounded-2xl border border-zinc-800 bg-[#101014] space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-sm text-white">Active Inspector: {selectedModel}</h3>
                    <div className="text-xs font-mono text-zinc-500">
                      Problem Type: {comparison.problem_type}
                    </div>
                  </div>
                </div>

                {diagLoading ? (
                  <div className="h-64 flex items-center justify-center text-xs font-mono text-zinc-500 space-x-2">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                    <span>Loading diagnostic vectors...</span>
                  </div>
                ) : diagnostics ? (
                  <div className="space-y-4">
                    {diagnostics.confusion_matrix && (
                      <div className="space-y-2">
                        <div className="text-xs font-medium text-zinc-400">
                          Confusion Matrix (Ground Truth vs Prediction)
                        </div>
                        <div className="overflow-x-auto p-3 rounded-xl bg-zinc-950 border border-zinc-800">
                          <table className="w-full text-center text-xs font-mono">
                            <thead>
                              <tr className="border-b border-zinc-800 text-[11px] text-zinc-400">
                                <th className="p-1.5">True \ Pred</th>
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

                    {diagnostics.residuals && diagnostics.ground_truth && (
                      <div className="space-y-2">
                        <div className="text-xs font-medium text-zinc-400">
                          Residual Error Vectors (y_true vs residual error)
                        </div>
                        <div className="h-48 w-full">
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
                    Select an algorithm to view diagnostics
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: EXPLAINABLE AI (XAI) */}
        {activeTab === "explainability" && (
          <div className="space-y-6">
            <div className="p-5 rounded-2xl border border-zinc-800 bg-[#101014] space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-4">
                <div>
                  <h3 className="font-bold text-base text-white flex items-center space-x-2">
                    <BrainCircuit className="w-4 h-4 text-purple-400" />
                    <span>Explainable AI (Permutation Feature Importance)</span>
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Measuring the drop in model generalization performance when each feature is permuted across held-out test records.
                  </p>
                </div>
                {explainData && (
                  <div className="text-xs font-mono px-2.5 py-1 rounded-md bg-purple-500/10 border border-purple-500/20 text-purple-400">
                    Inspecting: {explainData.model_name}
                  </div>
                )}
              </div>

              {explainLoading ? (
                <div className="h-64 flex items-center justify-center text-xs font-mono text-zinc-500 space-x-2">
                  <Loader2 className="w-5 h-5 animate-spin text-purple-400" />
                  <span>Computing permutation importances and coefficient impact...</span>
                </div>
              ) : explainData ? (
                <div className="space-y-6">
                  {/* Top Drivers Alert */}
                  <div className="p-4 rounded-xl border border-purple-500/30 bg-purple-500/10 text-xs text-purple-200">
                    <span className="font-bold text-purple-300">Executive Insight: </span>
                    {explainData.summary}
                  </div>

                  {/* Permutation Importance Bar Chart */}
                  <div className="space-y-3">
                    <div className="text-xs font-semibold text-zinc-300 uppercase tracking-wider font-mono">
                      Permutation Importance Distribution (% Relative Score Drop)
                    </div>
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={explainData.permutation_importance}
                          layout="vertical"
                          margin={{ top: 5, right: 30, left: 60, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="2 2" stroke="#27272A" horizontal={false} />
                          <XAxis type="number" stroke="#71717A" fontSize={10} domain={[0, "auto"]} />
                          <YAxis dataKey="feature" type="category" stroke="#D4D4D8" fontSize={11} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "#18181B",
                              border: "1px solid #3F3F46",
                              borderRadius: "8px",
                              fontSize: "12px",
                              color: "#FFFFFF",
                            }}
                          />
                          <Bar dataKey="relative_pct" name="Relative % Importance" fill="#A855F7" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Importance Ranking Table */}
                  <div className="overflow-x-auto rounded-xl border border-zinc-800">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="bg-zinc-950 text-zinc-400 border-b border-zinc-800 uppercase text-[11px]">
                        <tr>
                          <th className="p-3">Rank</th>
                          <th className="p-3">Feature Name</th>
                          <th className="p-3 text-right">Mean Metric Drop</th>
                          <th className="p-3 text-right">Standard Deviation</th>
                          <th className="p-3 text-right">Relative Weight</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/60 bg-[#0A0A0D]">
                        {explainData.permutation_importance.map((item, idx) => (
                          <tr key={item.feature} className="hover:bg-zinc-900/40">
                            <td className="p-3 font-bold text-zinc-500">#{idx + 1}</td>
                            <td className="p-3 font-semibold text-zinc-100">{item.feature}</td>
                            <td className="p-3 text-right font-bold text-purple-400">
                              {item.importance_mean?.toFixed(4) ?? 0}
                            </td>
                            <td className="p-3 text-right text-zinc-400">
                              ±{item.importance_std?.toFixed(4) ?? 0}
                            </td>
                            <td className="p-3 text-right font-bold text-zinc-200">
                              {item.relative_pct}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-zinc-500 text-xs font-mono">
                  No explainability data available for this model.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: EXPERIMENT HISTORY */}
        {activeTab === "experiments" && (
          <div className="space-y-6">
            <div className="p-5 rounded-2xl border border-zinc-800 bg-[#101014] space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-4">
                <div>
                  <h3 className="font-bold text-base text-white flex items-center space-x-2">
                    <History className="w-4 h-4 text-emerald-400" />
                    <span>Reproducible Experiment Tracking</span>
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Audit trail of all model training runs, hyperparameters, CV folds, and scoreboard outputs in this temporary workspace session.
                  </p>
                </div>

                <a
                  href={api.exportExperimentsUrl()}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold transition-colors"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Export History (JSON)</span>
                </a>
              </div>

              {expLoading ? (
                <div className="h-64 flex items-center justify-center text-xs font-mono text-zinc-500 space-x-2">
                  <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
                  <span>Loading experiment records...</span>
                </div>
              ) : experiments.length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-zinc-800">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-zinc-950 text-zinc-400 border-b border-zinc-800 uppercase text-[11px]">
                      <tr>
                        <th className="p-3">Run ID</th>
                        <th className="p-3">Timestamp</th>
                        <th className="p-3">Dataset</th>
                        <th className="p-3">Target</th>
                        <th className="p-3">Features</th>
                        <th className="p-3">CV Folds</th>
                        <th className="p-3">Champion Model</th>
                        <th className="p-3 text-right">Duration</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60 bg-[#0A0A0D]">
                      {experiments.map((run) => (
                        <tr key={run.run_id} className="hover:bg-zinc-900/40">
                          <td className="p-3 font-bold text-emerald-400">{run.run_id}</td>
                          <td className="p-3 text-zinc-400">
                            {new Date(run.timestamp * 1000).toLocaleTimeString()}
                          </td>
                          <td className="p-3 text-zinc-200">{run.dataset_name}</td>
                          <td className="p-3 font-bold text-blue-400">`{run.target_col}`</td>
                          <td className="p-3 text-zinc-400">{run.feature_count} cols</td>
                          <td className="p-3 text-zinc-300">{run.cv_folds}-Fold</td>
                          <td className="p-3 font-semibold text-white">{run.champion_model}</td>
                          <td className="p-3 text-right text-zinc-400">{run.duration_seconds}s</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12 text-zinc-500 text-xs font-mono">
                  No previous experiment runs recorded in this session. Dispatch a training job in ML Studio to initialize experiment logs.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
