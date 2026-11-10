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
} from "lucide-react";
import { api } from "@/lib/api";
import { ModelComparisonResponse } from "@/lib/types";
import { EmptyState } from "@/components/empty-state";
import { RetroDock } from "@/components/retro-dock";
import { RetroDisketteIcon, RetroMonitorIcon, RetroRocketIcon } from "@/components/retro-icons";

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
      <div className="min-h-screen bg-[#0C0C0E] text-white flex items-center justify-center p-8 bg-retro-grid">
        <div className="retro-window-dark p-8 text-center space-y-3 border border-zinc-800">
          <Loader2 className="w-6 h-6 animate-spin text-[#1864FF] mx-auto" />
          <div className="font-mono text-xs uppercase tracking-wider text-zinc-300">
            LOCATING COMPILED ARTIFACTS & EVALUATION DOSSIERS...
          </div>
        </div>
      </div>
    );
  }

  if (!comparison) {
    return (
      <div className="min-h-screen bg-[#0C0C0E] text-white p-8 bg-retro-grid">
        <div className="max-w-xl mx-auto retro-window-dark p-8 text-center space-y-6 border border-zinc-800">
          <RetroDisketteIcon size={48} className="mx-auto" />
          <div className="space-y-2">
            <h3 className="font-mono text-base font-bold uppercase">NO ARTIFACTS TO EXPORT</h3>
            <p className="font-mono text-xs text-zinc-400">
              Please train models in the ML Studio first to synthesize audit reports and model binaries.
            </p>
          </div>
          <Link href="/studio" className="btn-retro btn-retro-blue text-xs py-2 px-4">
            GO TO ML STUDIO ↗
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
    <div className="min-h-screen bg-[#0C0C0E] text-white p-4 sm:p-6 lg:p-8 bg-retro-grid selection:bg-[#1864FF] selection:text-white">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Workstation Title Header */}
        <div className="retro-window-dark p-4 border border-zinc-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-[#9AE6B4] font-mono text-xs font-bold uppercase tracking-wider">
                <span className="w-2 h-2 bg-[#9AE6B4] inline-block" />
                <span>MODULE_06 // ARTIFACT ARCHIVE & MODEL DISPATCH BAY</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-mono font-bold tracking-tight text-white uppercase">
                EVALUATION REPORTS & EXPORT
              </h1>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/studio"
                className="btn-retro btn-retro-dark text-xs flex items-center gap-1.5"
              >
                <Cpu className="w-3.5 h-3.5" />
                <span>TRAIN NEW RUN</span>
              </Link>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-3 font-mono text-xs text-zinc-400">
            <div>
              CHAMPION ARCHITECTURE: <span className="text-[#9AE6B4] font-bold">{comparison.champion.name}</span>
            </div>
            <div>
              TOTAL ARCHIVED RUNS: {comparison.scoreboard.length}
            </div>
          </div>
        </div>

        {/* 4 Retro Archival Export Bays */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Bay 1: HTML Dossier */}
          <div className="retro-window-dark p-5 border border-zinc-800 flex flex-col justify-between space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <span className="font-mono text-xs font-bold uppercase text-white">01. DOSSIER.HTML</span>
              <RetroMonitorIcon size={24} />
            </div>
            <div className="space-y-2">
              <h3 className="font-bold text-base text-white">Interactive HTML Report</h3>
              <p className="text-zinc-400 text-xs font-mono leading-relaxed">
                Stand-alone, self-contained dossier including metadata, quality scores, tournament scoreboard, and hyperparameter tables.
              </p>
            </div>
            <a
              href={htmlUrl}
              download
              className="btn-retro btn-retro-blue text-xs py-2.5 w-full flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              <span>DOWNLOAD DOSSIER.HTML</span>
            </a>
          </div>

          {/* Bay 2: JSON Telemetry */}
          <div className="retro-window-dark p-5 border border-zinc-800 flex flex-col justify-between space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <span className="font-mono text-xs font-bold uppercase text-white">02. TELEMETRY.JSON</span>
              <Code className="w-5 h-5 text-[#1864FF]" />
            </div>
            <div className="space-y-2">
              <h3 className="font-bold text-base text-white">Machine-Readable JSON</h3>
              <p className="text-zinc-400 text-xs font-mono leading-relaxed">
                Full programmatic audit log for CI/CD pipelines, MLOps tracking, model registries, and automated regression testing.
              </p>
            </div>
            <a
              href={jsonUrl}
              download
              className="btn-retro btn-retro-dark text-xs py-2.5 w-full flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              <span>DOWNLOAD TELEMETRY.JSON</span>
            </a>
          </div>

          {/* Bay 3: Markdown Summary */}
          <div className="retro-window-dark p-5 border border-zinc-800 flex flex-col justify-between space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <span className="font-mono text-xs font-bold uppercase text-white">03. BENCHMARK.MD</span>
              <FileText className="w-5 h-5 text-[#9AE6B4]" />
            </div>
            <div className="space-y-2">
              <h3 className="font-bold text-base text-white">GitHub README Markdown</h3>
              <p className="text-zinc-400 text-xs font-mono leading-relaxed">
                Pre-formatted GitHub Flavored Markdown summary ready to copy-paste into pull requests, model cards, or research papers.
              </p>
            </div>
            <a
              href={mdUrl}
              download
              className="btn-retro btn-retro-dark text-xs py-2.5 w-full flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              <span>DOWNLOAD BENCHMARK.MD</span>
            </a>
          </div>
        </div>

        {/* Model Pipeline Serializer Bay (Joblib) */}
        <div className="retro-window-light border border-black p-6 space-y-4 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] text-black">
          <div className="flex items-center justify-between pb-2 border-b border-black font-mono text-xs font-bold uppercase">
            <div className="flex items-center gap-2">
              <RetroDisketteIcon size={24} />
              <span>SERIALIZED MODEL BINARY DISPATCH (.JOBLIB)</span>
            </div>
            <span className="text-zinc-600">PRODUCTION INFERENCE RUNTIME</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
            <div className="md:col-span-2 space-y-1">
              <div className="font-bold text-sm">Select Candidate Architecture for Export:</div>
              <p className="font-mono text-xs text-zinc-600">
                Exports the entire end-to-end Scikit-learn Pipeline (including imputer, scaler, and fitted estimator) serialized with joblib.
              </p>
              <div className="pt-2">
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="bg-white border border-black p-2 font-mono text-xs text-black font-bold uppercase focus:outline-none w-full max-w-md"
                >
                  {comparison.available_models.map((m) => (
                    <option key={m} value={m}>
                      {m} {m === comparison.champion.name ? "★ (CHAMPION)" : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-start md:justify-end">
              <a
                href={modelUrl}
                download
                className="btn-retro btn-retro-blue text-xs py-3 px-6 shadow-[3px_3px_0px_0px_#002B99]"
              >
                <Download className="w-4 h-4 mr-1" />
                <span>EXPORT {selectedModel.toUpperCase()}.JOBLIB</span>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Retro Dock */}
      <RetroDock />
    </div>
  );
}
