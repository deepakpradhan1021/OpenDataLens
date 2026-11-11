"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Database,
  ArrowRight,
  Upload,
  RefreshCw,
  Info,
  Sliders,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  HelpCircle,
  ShieldAlert,
} from "lucide-react";
import { api } from "@/lib/api";
import { DriftAnalysisResponse } from "@/lib/types";

export default function DriftPage() {
  const [loading, setLoading] = useState(false);
  const [driftReport, setDriftReport] = useState<DriftAnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [splitRatio, setSplitRatio] = useState(0.5);
  const [uploading, setUploading] = useState(false);

  const loadDrift = useCallback(async (ratio = splitRatio) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getDriftAnalysis(ratio);
      setDriftReport(data);
    } catch (err: any) {
      setError(
        err.response?.data?.detail ||
        "No active dataset found or dataset has insufficient samples. Please load a dataset first."
      );
      setDriftReport(null);
    } finally {
      setLoading(false);
    }
  }, [splitRatio]);

  useEffect(() => {
    loadDrift();
  }, [loadDrift]);

  const handleTargetUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const data = await api.compareTargetCSVDrift(file);
      setDriftReport(data);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to compare uploaded target dataset.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  return (
    <div className="min-h-screen bg-[#09090B] text-zinc-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header Breadcrumb */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
          <div>
            <div className="flex items-center space-x-2 text-xs text-zinc-500 font-mono mb-1.5">
              <Link href="/dashboard" className="hover:text-zinc-300">Workspace</Link>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="text-blue-400">Data Drift Detection</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center space-x-3">
              <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <Activity className="w-5 h-5" />
              </div>
              <span>Data Drift & Stability Monitor</span>
            </h1>
            <p className="text-sm text-zinc-400 mt-1 max-w-2xl">
              Track distribution shifts between baseline reference data and target evaluation splits using Population Stability Index (PSI), Kolmogorov-Smirnov statistics, and Total Variation Distance.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <label className="cursor-pointer inline-flex items-center space-x-2 px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 transition-colors">
              <Upload className="w-3.5 h-3.5 text-zinc-400" />
              <span>{uploading ? "Analyzing..." : "Compare Target CSV"}</span>
              <input
                type="file"
                accept=".csv,.txt"
                className="hidden"
                disabled={uploading}
                onChange={handleTargetUpload}
              />
            </label>

            <button
              onClick={() => loadDrift()}
              disabled={loading}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Recalculate</span>
            </button>
          </div>
        </div>

        {/* Error Notice */}
        {error && (
          <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-sm flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-semibold text-rose-200">Unable to Run Drift Detection</div>
              <div className="text-xs text-rose-300/90 mt-0.5">{error}</div>
              <div className="mt-3 flex items-center space-x-3">
                <Link
                  href="/explorer"
                  className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-xs font-semibold border border-rose-500/40"
                >
                  <Database className="w-3.5 h-3.5" />
                  <span>Load Curated Dataset in Explorer</span>
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Drift Summary Cards */}
        {driftReport && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Overall Status Card */}
              <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/60 flex flex-col justify-between">
                <div className="text-xs font-mono text-zinc-400 uppercase tracking-wider">Overall Drift Status</div>
                <div className="my-3">
                  <div className={`inline-flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-bold border ${
                    driftReport.overall_status === "insufficient_data"
                      ? "bg-zinc-800 border-zinc-700 text-zinc-300"
                      : driftReport.overall_status === "significant_drift"
                      ? "bg-rose-500/15 border-rose-500/30 text-rose-400"
                      : driftReport.overall_status === "moderate_drift"
                      ? "bg-amber-500/15 border-amber-500/30 text-amber-400"
                      : "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                  }`}>
                    {driftReport.overall_status === "insufficient_data" ? (
                      <AlertCircle className="w-4 h-4 text-zinc-400" />
                    ) : driftReport.overall_status === "significant_drift" ? (
                      <AlertTriangle className="w-4 h-4" />
                    ) : driftReport.overall_status === "moderate_drift" ? (
                      <AlertCircle className="w-4 h-4" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    <span>{driftReport.badge_label}</span>
                  </div>
                </div>
                <div className="text-xs text-zinc-500">
                  {driftReport.reference_rows} ref rows vs {driftReport.target_rows} target rows
                </div>
              </div>

              {/* Mean PSI Card */}
              <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/60 flex flex-col justify-between">
                <div className="text-xs font-mono text-zinc-400 uppercase tracking-wider">Mean Dataset PSI</div>
                <div className="text-3xl font-bold text-white my-2 font-mono">
                  {driftReport.mean_psi.toFixed(3)}
                </div>
                <div className="text-xs text-zinc-500 flex items-center space-x-1">
                  <span>Thresholds: Stable &lt;0.10, Warning &lt;0.25</span>
                </div>
              </div>

              {/* Drifted Features Count */}
              <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/60 flex flex-col justify-between">
                <div className="text-xs font-mono text-zinc-400 uppercase tracking-wider">Features Shifted</div>
                <div className="text-3xl font-bold text-white my-2 font-mono">
                  <span className={driftReport.drifted_features_count > 0 ? "text-rose-400" : "text-emerald-400"}>
                    {driftReport.drifted_features_count}
                  </span>
                  <span className="text-zinc-500 text-lg"> / {driftReport.total_features_evaluated}</span>
                </div>
                <div className="text-xs text-zinc-500">
                  {driftReport.warning_features_count} moderate, {driftReport.stable_features_count} stable
                </div>
              </div>

              {/* Schema Stability */}
              <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/60 flex flex-col justify-between">
                <div className="text-xs font-mono text-zinc-400 uppercase tracking-wider">Schema Integrity</div>
                <div className="text-3xl font-bold text-white my-2 font-mono">
                  {driftReport.schema_changes.removed_columns.length === 0 && driftReport.schema_changes.added_columns.length === 0 && (!driftReport.schema_changes.type_mismatches || driftReport.schema_changes.type_mismatches.length === 0) ? (
                    <span className="text-emerald-400 text-xl font-semibold flex items-center space-x-1.5">
                      <CheckCircle2 className="w-5 h-5" />
                      <span>Consistent</span>
                    </span>
                  ) : (
                    <span className="text-amber-400 text-lg font-semibold">
                      {driftReport.schema_changes.removed_columns.length} removed, {driftReport.schema_changes.added_columns.length} added
                      {driftReport.schema_changes.type_mismatches && driftReport.schema_changes.type_mismatches.length > 0 && `, ${driftReport.schema_changes.type_mismatches.length} type shifts`}
                    </span>
                  )}
                </div>
                <div className="text-xs text-zinc-500">
                  {driftReport.schema_changes.common_columns_count} matched columns
                </div>
              </div>
            </div>

            {/* Methodology & Statistical Interpretation Guide */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-500/5 text-xs text-zinc-300 space-y-1.5">
                <div className="flex items-center space-x-1.5 font-bold text-blue-300">
                  <Info className="w-4 h-4 text-blue-400" />
                  <span>On-Demand Partition Testing</span>
                </div>
                <p className="text-zinc-400 leading-relaxed">
                  OpenDataLens executes on-demand statistical comparisons across data splits or against an uploaded target CSV. Partition splitting compares baseline records against subsequent rows to audit structural changes, rather than claiming automated real-time background production monitoring.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 text-xs text-zinc-300 space-y-1.5">
                <div className="flex items-center space-x-1.5 font-bold text-zinc-200">
                  <Sliders className="w-4 h-4 text-indigo-400" />
                  <span>Metric Benchmarks &amp; Statistical Significance</span>
                </div>
                <p className="text-zinc-400 leading-relaxed">
                  <strong>PSI &lt; 0.10:</strong> Stable. <strong>0.10–0.25:</strong> Moderate drift. <strong>&gt; 0.25:</strong> Severe population shift. Two-sample Kolmogorov-Smirnov (KS) tests flag continuous distributional divergences at <em>p &lt; 0.05</em>. Partitions with &lt;10 observations are flagged as <em>Insufficient Data</em>.
                </p>
              </div>
            </div>

            {/* Executive Guidance Banner */}
            <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-500/5 text-xs text-zinc-300 flex items-start space-x-3">
              <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-blue-300">Statistical Interpretation: </span>
                {driftReport.summary}
                <span className="block text-zinc-400 mt-1">
                  *Note: Distribution drift does not automatically imply model degradation; it flags features requiring calibration or ground-truth validation.
                </span>
              </div>
            </div>

            {/* Feature Drift Detailed Table */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden shadow-sm">
              <div className="p-4 sm:px-6 border-b border-zinc-800 flex items-center justify-between">
                <div className="text-sm font-semibold text-white">Feature Drift Breakdown</div>
                <div className="text-xs font-mono text-zinc-400">
                  Sorted by PSI (Highest Drift First)
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-950/60 text-zinc-400 font-mono border-b border-zinc-800 uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Feature</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4">PSI Score</th>
                      <th className="py-3 px-4">Statistic / p-value</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Actionable Recommendation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {driftReport.features.map((feat) => (
                      <tr key={feat.feature} className="hover:bg-zinc-800/30 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-semibold text-zinc-200">
                          {feat.feature}
                        </td>
                        <td className="py-3.5 px-4 text-zinc-400 capitalize">
                          {feat.type}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-zinc-100">
                          {feat.psi.toFixed(4)}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-zinc-400">
                          {feat.type === "numeric" ? (
                            <span>KS={feat.ks_statistic ?? 0} (p={feat.ks_p_value ?? 1})</span>
                          ) : (
                            <span>TVD={feat.tvd ?? 0}</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold uppercase font-mono ${
                            feat.status === "insufficient_data"
                              ? "bg-zinc-800 text-zinc-400 border border-zinc-700"
                              : feat.status === "drifted"
                              ? "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                              : feat.status === "warning"
                              ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                              : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                          }`}>
                            {feat.status.replace("_", " ")}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-zinc-300 max-w-md">
                          {feat.recommendation}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
