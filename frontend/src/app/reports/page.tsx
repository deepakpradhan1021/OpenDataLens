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
  Loader2,
  ArrowRight,
  FileSpreadsheet,
} from "lucide-react";
import { api } from "@/lib/api";
import { ModelComparisonResponse } from "@/lib/types";
import { EmptyState } from "@/components/empty-state";
import { RetroDock } from "@/components/retro-dock";

export default function ReportsPage() {
  const [comparison, setComparison] = useState<ModelComparisonResponse | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      try {
        const comp = await api.getModelComparison("default");
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
      <div className="min-h-screen bg-[#09090B] text-zinc-100 flex items-center justify-center p-8">
        <div className="p-8 rounded-2xl border border-zinc-800 bg-[#101014] text-center space-y-3">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500 mx-auto" />
          <div className="text-xs font-mono text-zinc-400">
            Checking compiled evaluation artifacts in session store...
          </div>
        </div>
      </div>
    );
  }

  if (!comparison) {
    return (
      <div className="min-h-screen bg-[#09090B] text-zinc-100 p-8">
        <div className="max-w-xl mx-auto rounded-2xl border border-zinc-800 bg-[#101014] p-10 text-center space-y-5">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto">
            <FileText className="w-6 h-6" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-base font-bold text-white">No Evaluation Reports Available</h3>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto leading-relaxed">
              Train baseline algorithms in the ML Studio first to synthesize audit reports and model binaries.
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

  const htmlUrl = api.getHtmlReportUrl("default");
  const jsonUrl = api.getJsonReportUrl("default");
  const mdUrl = api.getMarkdownReportUrl("default");
  const modelUrl = api.getModelDownloadUrl(selectedModel, "default");
  const csvUrl = api.getDatasetCsvUrl("default");

  return (
    <div className="min-h-screen bg-[#09090B] text-zinc-100 p-4 sm:p-6 lg:p-8 selection:bg-blue-600 selection:text-white">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-800">
          <div className="space-y-1">
            <div className="flex items-center space-x-2 text-xs font-mono text-blue-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              <span>Artifact Export &amp; Reporting Depot</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Evaluation Reports &amp; Model Export
            </h1>
          </div>

          <div className="flex items-center space-x-3">
            <Link
              href="/studio"
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 text-xs font-semibold transition-all"
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>Train New Run</span>
            </Link>
          </div>
        </div>

        {/* 3 Export Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: HTML Dossier */}
          <div className="rounded-2xl border border-zinc-800 bg-[#101014] p-6 flex flex-col justify-between space-y-5 hover:border-zinc-700 transition-colors">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-base text-white">Interactive HTML Dossier</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Self-contained, responsive report featuring metadata, data quality health scores, model scoreboard, and hyperparameter tables.
              </p>
            </div>
            <a
              href={htmlUrl}
              download
              className="w-full inline-flex items-center justify-center space-x-2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-sm shadow-blue-600/30 transition-all active:scale-95"
            >
              <Download className="w-4 h-4" />
              <span>Download HTML Dossier</span>
            </a>
          </div>

          {/* Card 2: JSON Telemetry */}
          <div className="rounded-2xl border border-zinc-800 bg-[#101014] p-6 flex flex-col justify-between space-y-5 hover:border-zinc-700 transition-colors">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400 flex items-center justify-center">
                <Code className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-base text-white">Machine-Readable JSON</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Programmatic audit log for CI/CD integration, MLOps telemetry, model registries, and automated regression tracking.
              </p>
            </div>
            <a
              href={jsonUrl}
              download
              className="w-full inline-flex items-center justify-center space-x-2 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 hover:text-white border border-zinc-800 font-semibold text-xs transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Download Telemetry JSON</span>
            </a>
          </div>

          {/* Card 3: Markdown Summary */}
          <div className="rounded-2xl border border-zinc-800 bg-[#101014] p-6 flex flex-col justify-between space-y-5 hover:border-zinc-700 transition-colors">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-base text-white">GitHub README Summary</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Pre-formatted GitHub Flavored Markdown summary ready for pull request descriptions, model cards, or research write-ups.
              </p>
            </div>
            <a
              href={mdUrl}
              download
              className="w-full inline-flex items-center justify-center space-x-2 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 hover:text-white border border-zinc-800 font-semibold text-xs transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Download Markdown</span>
            </a>
          </div>
        </div>

        {/* Model Pipeline Serializer Bay (Joblib) */}
        <div className="rounded-2xl border border-zinc-800 bg-[#101014] p-6 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
            <div className="space-y-0.5">
              <h3 className="font-semibold text-sm text-white">
                Export Serialized Scikit-learn Pipeline (.joblib)
              </h3>
              <p className="text-xs text-zinc-400">
                Exports the complete end-to-end Pipeline (imputer, scaler, and fitted estimator) for zero-latency inference.
              </p>
            </div>
            <span className="text-xs font-mono text-emerald-400 font-medium">Inference-Ready</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
            <div className="md:col-span-2 space-y-1.5">
              <label className="text-xs text-zinc-300 font-medium">Select Model Architecture:</label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full max-w-md bg-zinc-900 border border-zinc-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
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
                className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-md shadow-blue-600/30 transition-all active:scale-95"
              >
                <Download className="w-4 h-4" />
                <span>Export {selectedModel} .joblib</span>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Command Dock */}
      <RetroDock />
    </div>
  );
}
