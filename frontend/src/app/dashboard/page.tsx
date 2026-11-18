"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Database,
  ShieldCheck,
  Cpu,
  BarChart3,
  FileText,
  Sparkles,
  ArrowRight,
  Activity,
  Award,
  Terminal,
  ArrowUpRight,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Loader2,
  PieChart,
} from "lucide-react";
import { Ring } from "@/components/loading-ui/ring";
import { api, subscribeColdStart } from "@/lib/api";
import { EmptyState } from "@/components/empty-state";
import { RetroDock } from "@/components/retro-dock";

function formatScore(score: number | null | undefined, metricName?: string, problemType?: string) {
  if (score === null || score === undefined) return "N/A";
  const m = (metricName || "").toLowerCase();
  const isReg = problemType === "regression" || m.includes("r²") || m.includes("r2") || m.includes("mae") || m.includes("rmse") || m.includes("mse");
  if (isReg) {
    return score.toFixed(4);
  }
  return score <= 1.0 ? `${(score * 100).toFixed(2)}%` : score.toFixed(4);
}

export default function DashboardPage() {
  const [activeDataset, setActiveDataset] = useState<any>(null);
  const [quality, setQuality] = useState<any>(null);
  const [comparison, setComparison] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isWaking, setIsWaking] = useState(false);

  useEffect(() => {
    const unsub = subscribeColdStart((status) => {
      setIsWaking(status.isWaking);
    });
    return unsub;
  }, []);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        const ds = await api.getActiveDataset().catch(() => null);
        setActiveDataset(ds);

        if (ds) {
          const q = await api.getQualityAnalysis().catch(() => null);
          setQuality(q);
          const comp = await api.getModelComparison().catch(() => null);
          setComparison(comp);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadDashboardData();
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8 pb-28 sm:pb-32">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border">
          <div className="space-y-1">
            <div className="flex items-center space-x-2 text-xs font-mono text-emerald-600 dark:text-emerald-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Telemetry Hub &amp; Active Session Overview</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Platform Dashboard
            </h1>
          </div>

          <div className="flex items-center space-x-3">
            <Link
              href="/explorer"
              className="inline-flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-card hover:bg-muted text-muted-foreground hover:text-foreground border border-border text-xs font-medium transition-all shadow-sm"
            >
              <Database className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Switch Dataset</span>
            </Link>
            <Link
              href="/studio"
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium shadow-sm shadow-emerald-600/30 transition-all"
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>New Training Run</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="p-16 rounded-2xl border border-border bg-card/40 text-center text-xs font-mono text-muted-foreground flex flex-col items-center justify-center space-y-2">
            <div className="flex items-center space-x-2.5">
              <Ring className="size-4 text-emerald-500" />
              <span>
                {isWaking
                  ? "Waking up the backend. This may take up to 50 seconds on Render's free tier..."
                  : "Querying active in-memory session..."}
              </span>
            </div>
            {isWaking && (
              <p className="text-[11px] text-muted-foreground/80">
                Render free-tier instances sleep after 15 min of inactivity.
              </p>
            )}
          </div>
        ) : !activeDataset ? (
          /* Empty State */
          <div className="rounded-2xl border border-border bg-card p-12 text-center space-y-6 max-w-xl mx-auto shadow-xl">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
              <Database className="w-7 h-7" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-foreground">No Dataset Currently Mounted</h3>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-sm mx-auto">
                Mount a curated benchmark, search public Hugging Face repositories, or upload a local CSV to populate your workspace.
              </p>
            </div>
            <div className="pt-2">
              <Link
                href="/explorer"
                className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-600/25 transition-all"
              >
                <span>Go to Dataset Explorer</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* 4 Modern Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1 */}
              <div className="rounded-2xl border border-border bg-card p-5 flex flex-col justify-between space-y-4 hover:border-emerald-500/40 transition-colors shadow-sm">
                <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
                  <span>Active Dataset</span>
                  <Database className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <div className="text-xl font-semibold tracking-tight text-foreground truncate">
                    {activeDataset.metadata.name}
                  </div>
                  <div className="text-xs text-muted-foreground font-normal pt-1">
                    Source: <span className="text-foreground font-medium">{activeDataset.metadata.source?.toUpperCase() || "CURATED"}</span>
                  </div>
                </div>
                <div className="text-[11px] font-mono text-muted-foreground font-medium">
                  Memory: {activeDataset.memory_mb.toFixed(2)} MB
                </div>
              </div>

              {/* Card 2 */}
              <div className="rounded-2xl border border-border bg-card p-5 flex flex-col justify-between space-y-4 hover:border-emerald-500/40 transition-colors shadow-sm">
                <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
                  <span>Matrix Dimensions</span>
                  <Layers className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                </div>
                <div>
                  <div className="text-xl font-semibold font-mono tracking-tight text-foreground">
                    {activeDataset.total_rows.toLocaleString()} × {activeDataset.total_cols}
                  </div>
                  <div className="text-xs text-muted-foreground font-normal pt-1">
                    {activeDataset.columns.filter((c: any) => c.dtype.includes("int") || c.dtype.includes("float")).length} numeric,{" "}
                    {activeDataset.columns.filter((c: any) => !c.dtype.includes("int") && !c.dtype.includes("float")).length} categorical
                  </div>
                </div>
                <div className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-medium">
                  {comparison?.ml_meta?.test_size
                    ? `Configured ${Math.round((1 - comparison.ml_meta.test_size) * 100)}/${Math.round(comparison.ml_meta.test_size * 100)} train/test split`
                    : "Train/test split configurable in Studio (80/20 default)"}
                </div>
              </div>

              {/* Card 3 */}
              <div className="rounded-2xl border border-border bg-card p-5 flex flex-col justify-between space-y-4 hover:border-emerald-500/40 transition-colors shadow-sm">
                <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
                  <span>Completeness Health</span>
                  <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <div className="text-xl font-semibold font-mono tracking-tight text-emerald-600 dark:text-emerald-400">
                    {quality ? `${quality.overview.completeness_score.toFixed(1)}%` : "Pending"}
                  </div>
                  <div className="text-xs text-muted-foreground font-normal pt-1">
                    {quality ? `${quality.overview.duplicate_rows} duplicate rows` : "Awaiting audit"}
                  </div>
                </div>
                <Link
                  href="/quality"
                  className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 hover:underline flex items-center space-x-1 transition-colors"
                >
                  <span>View Quality Audit</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>

              {/* Card 4 */}
              <div className="rounded-2xl border border-border bg-card p-5 flex flex-col justify-between space-y-4 hover:border-emerald-500/40 transition-colors shadow-sm">
                <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
                  <span>Evaluated Models</span>
                  <Cpu className="w-4 h-4 text-violet-500" />
                </div>
                <div>
                  <div className="text-xl font-semibold tracking-tight text-foreground truncate">
                    {comparison?.champion ? comparison.champion.name : "0 Models"}
                  </div>
                  <div className="text-xs text-muted-foreground font-normal pt-1">
                    {comparison?.champion
                      ? <>Score: <span className="font-mono text-foreground font-medium">{formatScore(comparison.champion.score, comparison.champion.metric, comparison.problem_type)}</span></>
                      : "Ready to train"}
                  </div>
                </div>
                <Link
                  href="/studio"
                  className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 hover:underline flex items-center space-x-1 transition-colors"
                >
                  <span>Open ML Studio</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>

            {/* Champion Model Banner if exists */}
            {comparison?.champion && (
              <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg shadow-emerald-950/10">
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-lg shadow-md shadow-emerald-600/40">
                    ★
                  </div>
                  <div className="space-y-0.5">
                    <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                      Champion Model Architecture
                    </div>
                    <div className="text-lg font-bold text-foreground">
                      {comparison.champion.name}
                    </div>
                    <div className="text-xs text-muted-foreground font-mono">
                      Metric: {comparison.champion.metric} ={" "}
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        {formatScore(comparison.champion.score, comparison.champion.metric, comparison.problem_type)}
                      </span>{" "}
                      across {comparison.scoreboard?.length || 0} trained algorithms
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Link
                    href="/comparison"
                    className="px-4 py-2 rounded-xl bg-card hover:bg-muted text-foreground text-xs font-semibold border border-border transition-colors shadow-sm"
                  >
                    Leaderboard
                  </Link>
                  <Link
                    href="/reports"
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition-colors"
                  >
                    Export Artifacts
                  </Link>
                </div>
              </div>
            )}

            {/* Quick Action Station */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {/* Module 1 */}
              <div className="rounded-2xl border border-border bg-card p-5 space-y-4 hover:border-emerald-500/40 transition-colors shadow-sm flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-semibold text-muted-foreground uppercase">
                      Module 01
                    </span>
                    <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-semibold text-sm text-foreground">Quality Profiler</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Audit null percentages, duplicate records, distribution skewness, and high correlation matrices.
                    </p>
                  </div>
                </div>
                <Link
                  href="/quality"
                  className="w-full inline-flex items-center justify-center space-x-2 py-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground border border-border text-xs font-semibold transition-colors"
                >
                  <span>Launch Audit</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {/* Module 2 */}
              <div className="rounded-2xl border border-border bg-card p-5 space-y-4 hover:border-emerald-500/40 transition-colors shadow-sm flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-semibold text-muted-foreground uppercase">
                      Module 02
                    </span>
                    <PieChart className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-semibold text-sm text-foreground">Visual Analytics</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Interactive binned histograms, timelines, categorical rankings, and multi-dimensional charts.
                    </p>
                  </div>
                </div>
                <Link
                  href="/visualize"
                  className="w-full inline-flex items-center justify-center space-x-2 py-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground border border-border text-xs font-semibold transition-colors"
                >
                  <span>Launch Studio</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {/* Module 3 */}
              <div className="rounded-2xl border border-border bg-card p-5 space-y-4 hover:border-emerald-500/40 transition-colors shadow-sm flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-semibold text-muted-foreground uppercase">
                      Module 03
                    </span>
                    <Cpu className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-semibold text-sm text-foreground">ML Training Studio</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Auto-detect target columns, select input features, configure preprocessing, and run parallel training.
                    </p>
                  </div>
                </div>
                <Link
                  href="/studio"
                  className="w-full inline-flex items-center justify-center space-x-2 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition-colors"
                >
                  <span>Train Models</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {/* Module 4 */}
              <div className="rounded-2xl border border-border bg-card p-5 space-y-4 hover:border-emerald-500/40 transition-colors shadow-sm flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-semibold text-muted-foreground uppercase">
                      Module 04
                    </span>
                    <FileText className="w-4 h-4 text-violet-500" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-semibold text-sm text-foreground">Evaluation Reports</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Download executive PDF dossiers, Excel workbooks, HTML telemetry audits, and serialized models.
                    </p>
                  </div>
                </div>
                <Link
                  href="/reports"
                  className="w-full inline-flex items-center justify-center space-x-2 py-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground border border-border text-xs font-semibold transition-colors"
                >
                  <span>Download Reports</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {/* Live Event Stream Log */}
            <div className="rounded-2xl border border-border bg-card p-5 space-y-3 shadow-sm">
              <div className="flex items-center justify-between pb-3 border-b border-border text-[11px] font-mono font-medium text-muted-foreground uppercase tracking-wider">
                <div className="flex items-center space-x-2">
                  <Terminal className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Session Telemetry Log</span>
                </div>
                <span className="text-emerald-600 dark:text-emerald-400 flex items-center space-x-1 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>Active In-Memory Bus</span>
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-zinc-950 font-mono text-xs text-zinc-300 space-y-1.5 leading-relaxed">
                <div>[SYSTEM] FastAPI Microservice initialized on port 8000.</div>
                <div>[WORKSPACE] In-memory session store ready with thread-safe RLock.</div>
                {activeDataset && (
                  <div>
                    [DATASET] <span className="text-zinc-100 font-semibold">`{activeDataset.metadata.name}`</span> mounted with {activeDataset.total_rows.toLocaleString()} rows and {activeDataset.total_cols} columns.
                  </div>
                )}
                {quality && (
                  <div className="text-emerald-400">
                    [QUALITY] Completeness score: {quality.overview.completeness_score.toFixed(1)}% with {quality.overview.duplicate_rows} duplicates detected.
                  </div>
                )}
                {comparison?.champion && (
                  <div className="text-emerald-300">
                    [EVALUATION] Champion model: <span className="text-zinc-100 font-semibold">`{comparison.champion.name}`</span> ({comparison.champion.metric} = {formatScore(comparison.champion.score, comparison.champion.metric, comparison.problem_type)}).
                  </div>
                )}
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
