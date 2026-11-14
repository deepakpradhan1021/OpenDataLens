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
import { api, categorizeApiError } from "@/lib/api";
import { DriftAnalysisResponse } from "@/lib/types";
import { RetroDock } from "@/components/retro-dock";
import { Ring } from "@/components/loading-ui/ring";

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
      const cat = categorizeApiError(err);
      if (cat.type === "cold_start") {
        setError("Waking up the backend. This may take up to 50 seconds on Render's free tier. Please click Analyze Drift again shortly.");
      } else if (cat.type === "timeout") {
        setError("Drift computation timed out after 75s. Click Analyze Drift to retry.");
      } else {
        setError(cat.message || "No active dataset found or dataset has insufficient samples. Please load a dataset first.");
      }
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
    if (!file || uploading) return;
    setUploading(true);
    setError(null);
    try {
      const data = await api.compareTargetCSVDrift(file);
      setDriftReport(data);
    } catch (err: any) {
      const cat = categorizeApiError(err);
      if (cat.type === "cold_start") {
        setError("Waking up the backend. This may take up to 50 seconds on Render's free tier. Please upload your target CSV again once awake.");
      } else {
        setError(cat.message || "Failed to compare uploaded target dataset.");
      }
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground py-8 px-4 sm:px-6 lg:px-8 pb-28 sm:pb-32 transition-colors duration-200">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header Breadcrumb */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
          <div>
            <div className="flex items-center space-x-2 text-xs text-muted-foreground font-mono mb-1.5">
              <Link href="/dashboard" className="hover:text-foreground">Workspace</Link>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Data Drift Detection</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center space-x-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <Activity className="w-5 h-5" />
              </div>
              <span>Data Drift &amp; Stability Monitor</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              Track distribution shifts between baseline reference data and target evaluation splits using Population Stability Index (PSI), Kolmogorov-Smirnov statistics, and Total Variation Distance.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <label className="cursor-pointer inline-flex items-center space-x-2 px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-xs font-semibold text-foreground transition-colors shadow-sm">
              <Upload className="w-3.5 h-3.5 text-muted-foreground" />
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
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
            >
              {loading ? <Ring className="size-3.5 text-white" /> : <RefreshCw className="w-3.5 h-3.5" />}
              <span>Recalculate</span>
            </button>
          </div>
        </div>

        {/* Error Notice */}
        {error && (
          <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300 text-sm flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-semibold text-rose-800 dark:text-rose-200">Unable to Run Drift Detection</div>
              <div className="text-xs text-rose-700/90 dark:text-rose-300/90 mt-0.5">{error}</div>
              <div className="mt-3 flex items-center space-x-3">
                <Link
                  href="/explorer"
                  className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-800 dark:text-rose-200 text-xs font-semibold border border-rose-500/40"
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
              <div className="p-5 rounded-xl border border-border bg-card flex flex-col justify-between shadow-sm">
                <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Overall Drift Status</div>
                <div className="my-3">
                  <div className={`inline-flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-bold border ${
                    driftReport.overall_status === "insufficient_data"
                      ? "bg-muted border-border text-muted-foreground"
                      : driftReport.overall_status === "significant_drift"
                      ? "bg-rose-500/15 border-rose-500/30 text-rose-600 dark:text-rose-400"
                      : driftReport.overall_status === "moderate_drift"
                      ? "bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400"
                      : "bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                  }`}>
                    {driftReport.overall_status === "insufficient_data" ? (
                      <AlertCircle className="w-4 h-4 text-muted-foreground" />
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
                <div className="text-xs text-muted-foreground">
                  {driftReport.reference_rows} ref rows vs {driftReport.target_rows} target rows
                </div>
              </div>

              {/* Mean PSI Card */}
              <div className="p-5 rounded-xl border border-border bg-card flex flex-col justify-between shadow-sm">
                <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Mean Dataset PSI</div>
                <div className="text-3xl font-bold text-foreground my-2 font-mono">
                  {driftReport.mean_psi.toFixed(3)}
                </div>
                <div className="text-xs text-muted-foreground flex items-center space-x-1">
                  <span>Thresholds: Stable &lt;0.10, Warning &lt;0.25</span>
                </div>
              </div>

              {/* Drifted Features Count */}
              <div className="p-5 rounded-xl border border-border bg-card flex flex-col justify-between shadow-sm">
                <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Features Shifted</div>
                <div className="text-3xl font-bold text-foreground my-2 font-mono">
                  <span className={driftReport.drifted_features_count > 0 ? "text-rose-500" : "text-emerald-600 dark:text-emerald-400"}>
                    {driftReport.drifted_features_count}
                  </span>
                  <span className="text-muted-foreground text-lg"> / {driftReport.total_features_evaluated}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {driftReport.warning_features_count} moderate, {driftReport.stable_features_count} stable
                </div>
              </div>

              {/* Schema Stability */}
              <div className="p-5 rounded-xl border border-border bg-card flex flex-col justify-between shadow-sm">
                <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Schema Integrity</div>
                <div className="text-3xl font-bold text-foreground my-2 font-mono">
                  {driftReport.schema_changes.removed_columns.length === 0 && driftReport.schema_changes.added_columns.length === 0 && (!driftReport.schema_changes.type_mismatches || driftReport.schema_changes.type_mismatches.length === 0) ? (
                    <span className="text-emerald-600 dark:text-emerald-400 text-xl font-semibold flex items-center space-x-1.5">
                      <CheckCircle2 className="w-5 h-5" />
                      <span>Consistent</span>
                    </span>
                  ) : (
                    <span className="text-amber-500 text-lg font-semibold">
                      {driftReport.schema_changes.removed_columns.length} removed, {driftReport.schema_changes.added_columns.length} added
                      {driftReport.schema_changes.type_mismatches && driftReport.schema_changes.type_mismatches.length > 0 && `, ${driftReport.schema_changes.type_mismatches.length} type shifts`}
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {driftReport.schema_changes.common_columns_count} matched columns
                </div>
              </div>
            </div>

            {/* Methodology & Statistical Interpretation Guide */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-xs text-foreground space-y-1.5">
                <div className="flex items-center space-x-1.5 font-bold text-emerald-700 dark:text-emerald-400">
                  <Info className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>On-Demand Partition Testing</span>
                </div>
                <p className="text-muted-foreground leading-relaxed">
                  OpenDataLens executes on-demand statistical comparisons across data splits or against an uploaded target CSV. Partition splitting compares baseline records against subsequent rows to audit structural changes, rather than claiming automated real-time background production monitoring.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-border bg-card text-xs text-foreground space-y-1.5">
                <div className="flex items-center space-x-1.5 font-bold text-foreground">
                  <Sliders className="w-4 h-4 text-indigo-500" />
                  <span>Metric Benchmarks &amp; Statistical Significance</span>
                </div>
                <p className="text-muted-foreground leading-relaxed">
                  <strong>PSI &lt; 0.10:</strong> Stable. <strong>0.10–0.25:</strong> Moderate drift. <strong>&gt; 0.25:</strong> Severe population shift. Two-sample Kolmogorov-Smirnov (KS) tests flag continuous distributional divergences at <em>p &lt; 0.05</em>. Partitions with &lt;10 observations are flagged as <em>Insufficient Data</em>.
                </p>
              </div>
            </div>

            {/* Executive Guidance Banner */}
            <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-xs text-foreground flex items-start space-x-3">
              <Info className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-emerald-700 dark:text-emerald-400">Statistical Interpretation: </span>
                <span className="text-foreground">{driftReport.summary}</span>
                <span className="block text-muted-foreground mt-1">
                  *Note: Distribution drift does not automatically imply model degradation; it flags features requiring calibration or ground-truth validation.
                </span>
              </div>
            </div>

            {/* Feature Drift Detailed Table */}
            <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
              <div className="p-4 sm:px-6 border-b border-border flex items-center justify-between">
                <div className="text-sm font-semibold text-foreground">Feature Drift Breakdown</div>
                <div className="text-xs font-mono text-muted-foreground">
                  Sorted by PSI (Highest Drift First)
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted text-muted-foreground font-mono border-b border-border uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Feature</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4">PSI Score</th>
                      <th className="py-3 px-4">Statistic / p-value</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Actionable Recommendation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {driftReport.features.map((feat) => (
                      <tr key={feat.feature} className="hover:bg-muted/50 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-semibold text-foreground">
                          {feat.feature}
                        </td>
                        <td className="py-3.5 px-4 text-muted-foreground capitalize">
                          {feat.type}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-foreground">
                          {feat.psi.toFixed(4)}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-muted-foreground">
                          {feat.type === "numeric" ? (
                            <span>KS={feat.ks_statistic ?? 0} (p={feat.ks_p_value ?? 1})</span>
                          ) : (
                            <span>TVD={feat.tvd ?? 0}</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold uppercase font-mono ${
                            feat.status === "insufficient_data"
                              ? "bg-muted text-muted-foreground border border-border"
                              : feat.status === "drifted"
                              ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30"
                              : feat.status === "warning"
                              ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                              : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                          }`}>
                            {feat.status.replace("_", " ")}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-foreground/80 max-w-md">
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

      {/* Floating Command Dock */}
      <RetroDock />
    </div>
  );
}
