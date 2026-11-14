"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  FileText,
  Download,
  Code,
  Layers,
  Database,
  Cpu,
  CheckCircle2,
  ExternalLink,
  ArrowRight,
  FileSpreadsheet,
  FileArchive,
  Sparkles,
} from "lucide-react";
import { Ring } from "@/components/loading-ui/ring";
import { api } from "@/lib/api";
import { ModelComparisonResponse } from "@/lib/types";
import { RetroDock } from "@/components/retro-dock";

export default function ReportsPage() {
  const [comparison, setComparison] = useState<ModelComparisonResponse | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      try {
        const comp = await api.getModelComparison();
        setComparison(comp);
        if (comp.available_models.length > 0) {
          setSelectedModel(comp.champion.name || comp.available_models[0]);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-8">
        <div className="p-8 rounded-2xl border border-border bg-card text-center space-y-3 shadow-lg">
          <Ring className="size-7 text-emerald-500 mx-auto" />
          <div className="text-xs font-mono text-muted-foreground">
            Checking compiled evaluation artifacts in session store...
          </div>
        </div>
      </div>
    );
  }

  if (!comparison) {
    return (
      <div className="min-h-screen bg-background text-foreground p-8">
        <div className="max-w-xl mx-auto rounded-2xl border border-border bg-card p-10 text-center space-y-5 shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
            <FileText className="w-6 h-6" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-base font-bold text-foreground">No Evaluation Reports Available</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
              Train baseline algorithms in the ML Studio first to synthesize audit reports, multi-sheet dossiers, and model binaries.
            </p>
          </div>
          <div className="flex justify-center gap-3 pt-2">
            <Link
              href="/studio"
              className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition-all"
            >
              <span>Open ML Studio</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              href="/explorer"
              className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-muted hover:bg-muted/80 text-foreground border border-border text-xs font-semibold transition-all"
            >
              <span>Explore Datasets</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const htmlUrl = api.getHtmlReportUrl();
  const jsonUrl = api.getJsonReportUrl();
  const mdUrl = api.getMarkdownReportUrl();
  const modelUrl = api.getModelDownloadUrl(selectedModel);
  const csvUrl = api.getDatasetCsvUrl();
  const excelUrl = api.getExcelReportUrl();
  const projectStateUrl = api.getProjectStateUrl();

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8 pb-28 sm:pb-32 selection:bg-emerald-500 selection:text-white transition-colors duration-200">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border">
          <div className="space-y-1">
            <div className="flex items-center space-x-2 text-xs font-mono text-emerald-600 dark:text-emerald-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Artifact Export &amp; Reporting Depot</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Evaluation Reports &amp; Model Export
            </h1>
          </div>

          <div className="flex items-center space-x-3">
            <Link
              href="/studio"
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground border border-border text-xs font-semibold transition-all"
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>Train New Run</span>
            </Link>
          </div>
        </div>

        {/* Primary Export Cards (Grid of 4) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Card 1: Multi-Sheet Excel Dossier */}
          <div className="rounded-2xl border border-border bg-card p-6 flex flex-col justify-between space-y-5 hover:border-emerald-500/50 hover:shadow-md transition-all duration-200">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  Multi-Sheet Workbook
                </span>
                <h3 className="font-semibold text-base text-foreground mt-2">Executive Excel Dossier (.xlsx)</h3>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                4-sheet workbook containing Data Dictionary, Quality Health Score, Model Leaderboard, and Sample Records.
              </p>
            </div>
            <a
              href={excelUrl}
              download
              className="w-full inline-flex items-center justify-center space-x-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-sm shadow-emerald-600/30 transition-all active:scale-95"
            >
              <Download className="w-4 h-4" />
              <span>Download Excel (.xlsx)</span>
            </a>
          </div>

          {/* Card 2: Interactive HTML Dossier */}
          <div className="rounded-2xl border border-border bg-card p-6 flex flex-col justify-between space-y-5 hover:border-emerald-500/50 hover:shadow-md transition-all duration-200">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  Stand-alone Webpage
                </span>
                <h3 className="font-semibold text-base text-foreground mt-2">Interactive HTML Dossier</h3>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Self-contained, responsive report featuring metadata, data quality health scores, model scoreboard, and hyperparameter tables.
              </p>
            </div>
            <a
              href={htmlUrl}
              download
              className="w-full inline-flex items-center justify-center space-x-2 py-2.5 rounded-xl bg-muted hover:bg-muted/80 text-foreground border border-border font-semibold text-xs transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Download HTML Dossier</span>
            </a>
          </div>

          {/* Card 3: Project State Snapshot */}
          <div className="rounded-2xl border border-border bg-card p-6 flex flex-col justify-between space-y-5 hover:border-emerald-500/50 hover:shadow-md transition-all duration-200">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-600 dark:text-violet-400 flex items-center justify-center">
                <Code className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20">
                  Workspace Archive
                </span>
                <h3 className="font-semibold text-base text-foreground mt-2">Project State Dossier (.json)</h3>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Complete reproducible session snapshot including cleaning lineage, model configurations, and leaderboard telemetry.
              </p>
            </div>
            <a
              href={projectStateUrl}
              download
              className="w-full inline-flex items-center justify-center space-x-2 py-2.5 rounded-xl bg-muted hover:bg-muted/80 text-foreground border border-border font-semibold text-xs transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Download Project JSON</span>
            </a>
          </div>

          {/* Card 4: GitHub README Markdown */}
          <div className="rounded-2xl border border-border bg-card p-6 flex flex-col justify-between space-y-5 hover:border-emerald-500/50 hover:shadow-md transition-all duration-200">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  Documentation
                </span>
                <h3 className="font-semibold text-base text-foreground mt-2">GitHub README Summary</h3>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Pre-formatted GitHub Flavored Markdown summary ready for pull request descriptions, model cards, or research papers.
              </p>
            </div>
            <a
              href={mdUrl}
              download
              className="w-full inline-flex items-center justify-center space-x-2 py-2.5 rounded-xl bg-muted hover:bg-muted/80 text-foreground border border-border font-semibold text-xs transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Download Markdown</span>
            </a>
          </div>
        </div>

        {/* Model Pipeline Serializer Bay (Joblib) & CSV Export */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Joblib Model Binary */}
          <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-6 space-y-5 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="space-y-0.5">
                <h3 className="font-semibold text-sm text-foreground">
                  Export Serialized Scikit-learn Pipeline (.joblib)
                </h3>
                <p className="text-xs text-muted-foreground">
                  Exports the complete end-to-end Pipeline (imputer, scaler, and fitted estimator) for zero-latency inference.
                </p>
              </div>
              <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 font-medium">Inference-Ready</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
              <div className="md:col-span-2 space-y-1.5">
                <label className="text-xs text-foreground font-medium">Select Model Architecture:</label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full max-w-md bg-background border border-border rounded-xl p-2.5 text-xs text-foreground focus:outline-none focus:border-emerald-500"
                >
                  {comparison.available_models.map((m) => (
                    <option key={m} value={m}>
                      {m} {m === comparison.champion.name ? "★ (Champion)" : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-start md:justify-end">
                <a
                  href={modelUrl}
                  download
                  className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-md shadow-emerald-600/30 transition-all active:scale-95"
                >
                  <Download className="w-4 h-4" />
                  <span>Export {selectedModel} .joblib</span>
                </a>
              </div>
            </div>
          </div>

          {/* Cleaned CSV Dataset Download */}
          <div className="rounded-2xl border border-border bg-card p-6 flex flex-col justify-between space-y-4 shadow-sm">
            <div className="space-y-2">
              <div className="flex items-center space-x-2 text-xs font-mono text-emerald-600 dark:text-emerald-400 font-medium">
                <Database className="w-4 h-4" />
                <span>Active Clean Data</span>
              </div>
              <h3 className="font-semibold text-sm text-foreground">Export Cleaned Dataset</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Download the currently loaded, cleaned, and imputed dataset as a standard CSV file for external notebooks.
              </p>
            </div>
            <a
              href={csvUrl}
              download
              className="w-full inline-flex items-center justify-center space-x-2 py-2.5 rounded-xl bg-muted hover:bg-muted/80 text-foreground border border-border font-semibold text-xs transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Download CSV Dataset</span>
            </a>
          </div>
        </div>
      </div>

      {/* Floating Command Dock */}
      <RetroDock />
    </div>
  );
}
