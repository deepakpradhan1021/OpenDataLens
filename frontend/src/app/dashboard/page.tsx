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
  Layers,
} from "lucide-react";
import { api } from "@/lib/api";
import { EmptyState } from "@/components/empty-state";
import { RetroDock } from "@/components/retro-dock";

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
    <div className="min-h-screen bg-[#09090B] text-zinc-100 p-4 sm:p-6 lg:p-8 selection:bg-blue-600 selection:text-white">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-800">
          <div className="space-y-1">
            <div className="flex items-center space-x-2 text-xs font-mono text-blue-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              <span>Telemetry Hub &amp; Active Session Overview</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Platform Dashboard
            </h1>
          </div>

          <div className="flex items-center space-x-3">
            <Link
              href="/explorer"
              className="inline-flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 text-xs font-semibold transition-all"
            >
              <Database className="w-3.5 h-3.5 text-zinc-400" />
              <span>Switch Dataset</span>
            </Link>
            <Link
              href="/studio"
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm shadow-blue-600/30 transition-all"
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>New Training Run</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="p-16 rounded-2xl border border-zinc-800/80 bg-zinc-900/30 text-center text-xs font-mono text-zinc-400 flex items-center justify-center space-x-2">
            <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
            <span>Querying active in-memory session...</span>
          </div>
        ) : !activeDataset ? (
          /* Empty State */
          <div className="rounded-2xl border border-zinc-800 bg-[#101014] p-12 text-center space-y-6 max-w-xl mx-auto shadow-xl">
            <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto">
              <Database className="w-7 h-7" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-white">No Dataset Currently Mounted</h3>
              <p className="text-xs text-zinc-400 leading-relaxed max-w-sm mx-auto">
                Mount a curated benchmark, search public Hugging Face repositories, or upload a local CSV to populate your workspace.
              </p>
            </div>
            <div className="pt-2">
              <Link
                href="/explorer"
                className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-600/25 transition-all"
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
              <div className="rounded-2xl border border-zinc-800 bg-[#101014] p-5 flex flex-col justify-between space-y-4 hover:border-zinc-700 transition-colors">
                <div className="flex items-center justify-between text-xs text-zinc-400 font-medium">
                  <span>Active Dataset</span>
                  <Database className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <div className="text-xl font-bold text-white truncate">
                    {activeDataset.metadata.name}
                  </div>
                  <div className="text-xs text-zinc-400 pt-0.5">
                    Source: {activeDataset.metadata.source?.toUpperCase() || "CURATED"}
                  </div>
                </div>
                <div className="text-[11px] font-mono text-zinc-500">
                  Memory: {activeDataset.memory_mb.toFixed(2)} MB
                </div>
              </div>

              {/* Card 2 */}
              <div className="rounded-2xl border border-zinc-800 bg-[#101014] p-5 flex flex-col justify-between space-y-4 hover:border-zinc-700 transition-colors">
                <div className="flex items-center justify-between text-xs text-zinc-400 font-medium">
                  <span>Matrix Dimensions</span>
                  <Layers className="w-4 h-4 text-indigo-400" />
                </div>
                <div>
                  <div className="text-xl font-bold text-white">
                    {activeDataset.total_rows.toLocaleString()} × {activeDataset.total_cols}
                  </div>
                  <div className="text-xs text-zinc-400 pt-0.5">
                    {activeDataset.columns.filter((c: any) => c.dtype.includes("int") || c.dtype.includes("float")).length} numeric,{" "}
                    {activeDataset.columns.filter((c: any) => !c.dtype.includes("int") && !c.dtype.includes("float")).length} categorical
                  </div>
                </div>
                <div className="text-[11px] font-mono text-emerald-400">
                  Ready for 80/20 train split
                </div>
              </div>

              {/* Card 3 */}
              <div className="rounded-2xl border border-zinc-800 bg-[#101014] p-5 flex flex-col justify-between space-y-4 hover:border-zinc-700 transition-colors">
                <div className="flex items-center justify-between text-xs text-zinc-400 font-medium">
                  <span>Completeness Health</span>
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <div className="text-xl font-bold text-emerald-400">
                    {quality ? `${quality.overview.completeness_score.toFixed(1)}%` : "Pending"}
                  </div>
                  <div className="text-xs text-zinc-400 pt-0.5">
                    {quality ? `${quality.overview.duplicate_rows} duplicate rows` : "Awaiting audit"}
                  </div>
                </div>
                <Link
                  href="/quality"
                  className="text-[11px] font-medium text-blue-400 hover:text-blue-300 flex items-center space-x-1"
                >
                  <span>View Quality Audit</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>

              {/* Card 4 */}
              <div className="rounded-2xl border border-zinc-800 bg-[#101014] p-5 flex flex-col justify-between space-y-4 hover:border-zinc-700 transition-colors">
                <div className="flex items-center justify-between text-xs text-zinc-400 font-medium">
                  <span>Evaluated Models</span>
                  <Cpu className="w-4 h-4 text-violet-400" />
                </div>
                <div>
                  <div className="text-xl font-bold text-white truncate">
                    {comparison?.champion ? comparison.champion.name : "0 Models"}
                  </div>
                  <div className="text-xs text-zinc-400 pt-0.5">
                    {comparison?.champion
                      ? `Score: ${(comparison.champion.score * 100).toFixed(1)}%`
                      : "Ready to train"}
                  </div>
                </div>
                <Link
                  href="/studio"
                  className="text-[11px] font-medium text-blue-400 hover:text-blue-300 flex items-center space-x-1"
                >
                  <span>Open ML Studio</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>

            {/* Champion Model Banner if exists */}
            {comparison?.champion && (
              <div className="rounded-2xl border border-blue-500/30 bg-gradient-to-r from-blue-900/20 via-indigo-900/20 to-zinc-900/40 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg shadow-blue-950/40">
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg shadow-md shadow-blue-600/40">
                    ★
                  </div>
                  <div className="space-y-0.5">
                    <div className="text-xs font-semibold text-blue-400 uppercase tracking-wider">
                      Champion Model Architecture
                    </div>
                    <div className="text-lg font-bold text-white">
                      {comparison.champion.name}
                    </div>
                    <div className="text-xs text-zinc-400 font-mono">
                      Metric: {comparison.champion.metric} ={" "}
                      <span className="font-bold text-emerald-400">
                        {(comparison.champion.score * 100).toFixed(2)}%
                      </span>{" "}
                      across {comparison.scoreboard?.length || 0} trained algorithms
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Link
                    href="/comparison"
                    className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold border border-zinc-700 transition-colors"
                  >
                    Leaderboard
                  </Link>
                  <Link
                    href="/reports"
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-colors"
                  >
                    Export Artifacts
                  </Link>
                </div>
              </div>
            )}

            {/* Quick Action Station */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Module 1 */}
              <div className="rounded-2xl border border-zinc-800 bg-[#101014] p-6 space-y-4 hover:border-zinc-700 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-semibold text-zinc-400 uppercase">
                    Module 01
                  </span>
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-semibold text-base text-white">Data Quality Profiler</h3>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Audit null percentages, duplicate records, distribution skewness, and high correlation matrices.
                  </p>
                </div>
                <Link
                  href="/quality"
                  className="w-full inline-flex items-center justify-center space-x-2 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 hover:text-white border border-zinc-800 text-xs font-semibold transition-colors"
                >
                  <span>Launch Quality Audit</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {/* Module 2 */}
              <div className="rounded-2xl border border-zinc-800 bg-[#101014] p-6 space-y-4 hover:border-zinc-700 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-semibold text-zinc-400 uppercase">
                    Module 02
                  </span>
                  <Cpu className="w-4 h-4 text-blue-400" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-semibold text-base text-white">ML Training Studio</h3>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Auto-detect target columns, select input features, configure preprocessing, and run parallel training.
                  </p>
                </div>
                <Link
                  href="/studio"
                  className="w-full inline-flex items-center justify-center space-x-2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-colors"
                >
                  <span>Train Models Now</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {/* Module 3 */}
              <div className="rounded-2xl border border-zinc-800 bg-[#101014] p-6 space-y-4 hover:border-zinc-700 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-semibold text-zinc-400 uppercase">
                    Module 03
                  </span>
                  <FileText className="w-4 h-4 text-violet-400" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-semibold text-base text-white">Evaluation Reports</h3>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Download standalone HTML dossiers, JSON telemetry audits, Markdown summaries, and `.joblib` model binaries.
                  </p>
                </div>
                <Link
                  href="/reports"
                  className="w-full inline-flex items-center justify-center space-x-2 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 hover:text-white border border-zinc-800 text-xs font-semibold transition-colors"
                >
                  <span>Download Reports</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {/* Live Event Stream Log */}
            <div className="rounded-2xl border border-zinc-800 bg-[#101014] p-5 space-y-3">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800 text-xs font-mono font-semibold text-zinc-400 uppercase">
                <div className="flex items-center space-x-2">
                  <Terminal className="w-3.5 h-3.5 text-blue-400" />
                  <span>Session Telemetry Log</span>
                </div>
                <span className="text-emerald-400 flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>Active In-Memory Bus</span>
                </span>
              </div>
              <div className="p-3 rounded-xl bg-zinc-950 font-mono text-xs text-zinc-400 space-y-1">
                <div>[SYSTEM] FastAPI Microservice initialized on port 8000.</div>
                <div>[WORKSPACE] In-memory session store ready with thread-safe RLock.</div>
                {activeDataset && (
                  <div>
                    [DATASET] `{activeDataset.metadata.name}` mounted with {activeDataset.total_rows.toLocaleString()} rows and {activeDataset.total_cols} columns.
                  </div>
                )}
                {quality && (
                  <div className="text-emerald-400">
                    [QUALITY] Completeness score: {quality.overview.completeness_score.toFixed(1)}% with {quality.overview.duplicate_rows} duplicates detected.
                  </div>
                )}
                {comparison?.champion && (
                  <div className="text-blue-400">
                    [EVALUATION] Champion model: `{comparison.champion.name}` ({comparison.champion.metric} = {(comparison.champion.score * 100).toFixed(1)}%).
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
