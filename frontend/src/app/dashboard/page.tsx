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
  Loader2,
} from "lucide-react";
import { api } from "@/lib/api";
import { EmptyState } from "@/components/empty-state";
import { RetroDock } from "@/components/retro-dock";
import {
  RetroMonitorIcon,
  RetroHeartDocIcon,
  RetroRobotIcon,
  RetroRocketIcon,
} from "@/components/retro-icons";

export default function DashboardPage() {
  const [activeDataset, setActiveDataset] = useState<any>(null);
  const [quality, setQuality] = useState<any>(null);
  const [comparison, setComparison] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        const ds = await api.getActiveDataset("default").catch(() => null);
        setActiveDataset(ds);

        if (ds) {
          const q = await api.getQualityAnalysis("default").catch(() => null);
          setQuality(q);
          const comp = await api.getModelComparison("default").catch(() => null);
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
    <div className="min-h-screen bg-[#0C0C0E] text-white p-4 sm:p-6 lg:p-8 bg-retro-grid selection:bg-[#1864FF] selection:text-white">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Workstation Title Header */}
        <div className="retro-window-dark p-4 border border-zinc-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-[#1864FF] font-mono text-xs font-bold uppercase tracking-wider">
                <span className="w-2 h-2 bg-[#1864FF] inline-block" />
                <span>MODULE_01 // TELEMETRY & WORKSPACE CONTROLLER</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-mono font-bold tracking-tight text-white uppercase">
                SYSTEM DASHBOARD
              </h1>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/explorer"
                className="btn-retro btn-retro-dark text-xs flex items-center gap-1.5"
              >
                <Database className="w-3.5 h-3.5" />
                <span>SWITCH DATASET</span>
              </Link>
              <Link
                href="/studio"
                className="btn-retro btn-retro-blue text-xs flex items-center gap-1.5"
              >
                <Cpu className="w-3.5 h-3.5" />
                <span>NEW TRAINING RUN</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Subheader Status */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-3 font-mono text-xs text-zinc-400">
            <div className="flex items-center gap-3">
              <span className="text-[#9AE6B4]">● ENGINE: READY</span>
              <span>IN-MEMORY BUS: SYNCED</span>
            </div>
            <div>
              {activeDataset ? (
                <span className="text-[#1864FF] font-bold">
                  ACTIVE_OBJECT: {activeDataset.metadata?.name || activeDataset.metadata?.id}
                </span>
              ) : (
                <span className="text-amber-400 font-bold">[NO ACTIVE DATASET LOADED]</span>
              )}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="retro-window-dark p-12 text-center font-mono text-xs text-zinc-400 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-[#1864FF]" />
            <span>INTERROGATING FASTAPI ENGINE WORKSPACE...</span>
          </div>
        ) : !activeDataset ? (
          /* Empty State styled as vintage computer prompt */
          <div className="retro-window-dark p-12 text-center space-y-6 border border-zinc-800">
            <div className="flex justify-center">
              <RetroMonitorIcon size={64} />
            </div>
            <div className="space-y-2">
              <h3 className="font-mono text-lg font-bold text-white uppercase">
                WORKSPACE MEMORY IS EMPTY
              </h3>
              <p className="font-mono text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
                No dataset is currently mounted into session memory. Ingest a benchmark from the Curated Catalog, stream from Hugging Face Hub, or insert a local CSV file.
              </p>
            </div>
            <div className="pt-2">
              <Link
                href="/explorer"
                className="btn-retro btn-retro-blue text-xs py-3 px-6"
              >
                <span>OPEN DATASET EXPLORER</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* 4 Hardware Register KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1 */}
              <div className="retro-window-dark p-4 border border-zinc-800 flex flex-col justify-between space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-zinc-800 text-[10px] font-mono text-zinc-400 uppercase font-bold">
                  <span>REG_01: ACTIVE_DATASET</span>
                  <RetroMonitorIcon size={20} />
                </div>
                <div>
                  <div className="text-xl font-bold font-mono text-white truncate">
                    {activeDataset.metadata.name}
                  </div>
                  <div className="text-xs font-mono text-zinc-400 pt-0.5">
                    SOURCE: {activeDataset.metadata.source?.toUpperCase() || "CURATED"}
                  </div>
                </div>
                <div className="text-[10px] font-mono text-[#1864FF] font-bold">
                  MEMORY: {activeDataset.memory_mb.toFixed(2)} MB
                </div>
              </div>

              {/* Card 2 */}
              <div className="retro-window-dark p-4 border border-zinc-800 flex flex-col justify-between space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-zinc-800 text-[10px] font-mono text-zinc-400 uppercase font-bold">
                  <span>REG_02: MATRIX_DIMENSIONS</span>
                  <Database className="w-4 h-4 text-zinc-400" />
                </div>
                <div>
                  <div className="text-xl font-bold font-mono text-white">
                    {activeDataset.total_rows.toLocaleString()} × {activeDataset.total_cols}
                  </div>
                  <div className="text-xs font-mono text-zinc-400 pt-0.5">
                    {activeDataset.columns.filter((c: any) => c.dtype.includes("int") || c.dtype.includes("float")).length} NUMERIC,{" "}
                    {activeDataset.columns.filter((c: any) => !c.dtype.includes("int") && !c.dtype.includes("float")).length} CATEGORICAL
                  </div>
                </div>
                <div className="text-[10px] font-mono text-[#9AE6B4] font-bold">
                  SPLIT READY: 80 / 20
                </div>
              </div>

              {/* Card 3 */}
              <div className="retro-window-dark p-4 border border-zinc-800 flex flex-col justify-between space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-zinc-800 text-[10px] font-mono text-zinc-400 uppercase font-bold">
                  <span>REG_03: QUALITY_INDEX</span>
                  <ShieldCheck className="w-4 h-4 text-[#9AE6B4]" />
                </div>
                <div>
                  <div className="text-xl font-bold font-mono text-[#9AE6B4]">
                    {quality ? `${quality.overview.completeness_score.toFixed(1)}%` : "PENDING"}
                  </div>
                  <div className="text-xs font-mono text-zinc-400 pt-0.5">
                    {quality ? `${quality.overview.duplicate_rows} DUPLICATES DETECTED` : "AWAITING AUDIT"}
                  </div>
                </div>
                <Link
                  href="/quality"
                  className="text-[10px] font-mono text-[#1864FF] hover:underline font-bold"
                >
                  VIEW QUALITY BREAKDOWN →
                </Link>
              </div>

              {/* Card 4 */}
              <div className="retro-window-dark p-4 border border-zinc-800 flex flex-col justify-between space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-zinc-800 text-[10px] font-mono text-zinc-400 uppercase font-bold">
                  <span>REG_04: BENCHMARK_STATUS</span>
                  <Cpu className="w-4 h-4 text-[#FBBF24]" />
                </div>
                <div>
                  <div className="text-xl font-bold font-mono text-white">
                    {comparison?.champion ? comparison.champion.name : "0 MODELS"}
                  </div>
                  <div className="text-xs font-mono text-zinc-400 pt-0.5">
                    {comparison?.champion
                      ? `SCORE: ${(comparison.champion.score * 100).toFixed(1)}%`
                      : "READY TO TRAIN"}
                  </div>
                </div>
                <Link
                  href="/studio"
                  className="text-[10px] font-mono text-[#1864FF] hover:underline font-bold"
                >
                  OPEN ML STUDIO →
                </Link>
              </div>
            </div>

            {/* Champion Model Banner if exists */}
            {comparison?.champion && (
              <div className="retro-window-light border border-black p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#1864FF] text-white flex items-center justify-center font-bold text-sm border border-black shadow-[2px_2px_0px_0px_#000]">
                    ★
                  </div>
                  <div>
                    <div className="font-mono text-xs font-bold text-black uppercase">
                      CHAMPION MODEL BENCHMARK: {comparison.champion.name}
                    </div>
                    <div className="text-xs text-zinc-600 font-mono">
                      PRIMARY METRIC: {comparison.champion.metric} ={" "}
                      <span className="font-bold text-[#1864FF]">
                        {(comparison.champion.score * 100).toFixed(2)}%
                      </span>{" "}
                      ACROSS {comparison.scoreboard?.length || 0} TRAINED ARCHITECTURES
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Link
                    href="/comparison"
                    className="btn-retro btn-retro-blue text-xs py-1.5 px-3"
                  >
                    <span>LEADERBOARD</span>
                    <span>↗</span>
                  </Link>
                  <Link
                    href="/reports"
                    className="btn-retro text-xs py-1.5 px-3"
                  >
                    <span>EXPORT AUDIT</span>
                    <span>↗</span>
                  </Link>
                </div>
              </div>
            )}

            {/* Workstation Quick Action Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Module 1 */}
              <div className="retro-window-dark p-5 border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                  <span className="font-mono text-xs font-bold text-white">01. QUALITY PROFILER</span>
                  <RetroHeartDocIcon size={24} />
                </div>
                <p className="text-zinc-400 text-xs font-mono leading-relaxed">
                  Inspect missing values matrix, correlation heatmaps, feature distributions, and automated cleaning recommendations.
                </p>
                <div className="pt-2">
                  <Link
                    href="/quality"
                    className="btn-retro btn-retro-dark text-xs w-full py-2 flex items-center justify-center gap-2"
                  >
                    <span>LAUNCH QUALITY AUDIT</span>
                    <span>↗</span>
                  </Link>
                </div>
              </div>

              {/* Module 2 */}
              <div className="retro-window-dark p-5 border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                  <span className="font-mono text-xs font-bold text-white">02. ML TRAINING STUDIO</span>
                  <RetroRobotIcon size={24} />
                </div>
                <p className="text-zinc-400 text-xs font-mono leading-relaxed">
                  Automatically identify target columns, select preprocessing pipelines, and train baseline Scikit-learn algorithms.
                </p>
                <div className="pt-2">
                  <Link
                    href="/studio"
                    className="btn-retro btn-retro-blue text-xs w-full py-2 flex items-center justify-center gap-2"
                  >
                    <span>TRAIN MODELS NOW</span>
                    <span>↗</span>
                  </Link>
                </div>
              </div>

              {/* Module 3 */}
              <div className="retro-window-dark p-5 border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                  <span className="font-mono text-xs font-bold text-white">03. REPORT DISPATCH</span>
                  <RetroRocketIcon size={24} />
                </div>
                <p className="text-zinc-400 text-xs font-mono leading-relaxed">
                  Generate downloadable research reports in HTML, JSON, and Markdown format, or export trained model `.joblib` binaries.
                </p>
                <div className="pt-2">
                  <Link
                    href="/reports"
                    className="btn-retro btn-retro-dark text-xs w-full py-2 flex items-center justify-center gap-2"
                  >
                    <span>DOWNLOAD REPORTS</span>
                    <span>↗</span>
                  </Link>
                </div>
              </div>
            </div>

            {/* ASCII Event Stream / Activity Log */}
            <div className="retro-window-dark p-4 border border-zinc-800 space-y-2">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-800 font-mono text-xs font-bold text-zinc-400 uppercase">
                <div className="flex items-center gap-2">
                  <Terminal className="w-3.5 h-3.5 text-[#1864FF]" />
                  <span>SYSTEM_ACTIVITY_STREAM.LOG</span>
                </div>
                <span>STREAM: LIVE</span>
              </div>
              <div className="p-3 bg-zinc-950 font-mono text-[11px] text-zinc-400 space-y-1">
                <div>[2026-11-10 17:55:01] FastAPIEngine mounted session &apos;default&apos; on thread 0x7fa2.</div>
                <div>[2026-11-10 17:55:02] Dataset `{activeDataset.metadata.name}` validated with {activeDataset.total_rows} records.</div>
                {quality && (
                  <div>[2026-11-10 17:55:04] Quality audit completed: {quality.overview.completeness_score.toFixed(1)}% completeness score.</div>
                )}
                {comparison?.best_model && (
                  <div className="text-[#9AE6B4]">
                    [2026-11-10 17:55:08] Best model `{comparison.best_model.name}` achieved {(comparison.best_model.score * 100).toFixed(1)}% score.
                  </div>
                )}
                <div className="text-zinc-600">-- END OF CURRENT BUFFER --</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Floating Retro Dock Toolbar */}
      <RetroDock />
    </div>
  );
}
