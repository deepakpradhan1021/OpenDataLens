"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Database,
  Cpu,
  ShieldCheck,
  BarChart3,
  CheckCircle2,
  Sparkles,
  ExternalLink,
  Layers,
  ArrowUpRight,
  Loader2,
  FileCode,
  Github,
  Play,
  Terminal,
} from "lucide-react";
import { api } from "@/lib/api";
import { DatasetPreviewResponse } from "@/lib/types";
import { RetroDock } from "@/components/retro-dock";
import { FilterState } from "@/components/retro-filter-drawer";

const PRESET_DATASETS = [
  {
    id: "iris",
    name: "Iris Flower Species",
    task: "Classification",
    rows: 150,
    cols: 5,
    tag: "Botany",
    desc: "Classic 3-class morphological benchmark for multi-class classification.",
  },
  {
    id: "california_housing",
    name: "California Housing",
    task: "Regression",
    rows: 20640,
    cols: 9,
    tag: "Real Estate",
    desc: "Census block housing values with geospatial coordinates and median income.",
  },
  {
    id: "wine_quality",
    name: "Wine Quality Benchmark",
    task: "Classification",
    rows: 1599,
    cols: 12,
    tag: "Food Chemistry",
    desc: "Physicochemical attributes scoring wine quality from acidity to alcohol.",
  },
  {
    id: "diabetes",
    name: "Diabetes Progression",
    task: "Regression",
    rows: 442,
    cols: 11,
    tag: "Healthcare",
    desc: "Ten baseline clinical features tracking disease progression in patients.",
  },
  {
    id: "titanic",
    name: "Titanic Passenger Survival",
    task: "Classification",
    rows: 891,
    cols: 12,
    tag: "Demographics",
    desc: "Survival prediction demonstrating categorical imputation and passenger demographics.",
  },
];

export default function LandingPage() {
  const router = useRouter();
  const [selectedDatasetId, setSelectedDatasetId] = useState("iris");
  const [loading, setLoading] = useState(false);
  const [loadedDataset, setLoadedDataset] = useState<DatasetPreviewResponse | null>(null);
  const [loadSuccess, setLoadSuccess] = useState(false);

  const [filters, setFilters] = useState<FilterState>({
    task: [],
    domains: [],
    scalers: [],
    models: [],
    minRows: 0,
    maxRows: 50000,
    fastBaselinesOnly: false,
  });
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const currentPreset = PRESET_DATASETS.find((d) => d.id === selectedDatasetId) || PRESET_DATASETS[0];

  const handleQuickLoad = async (datasetId: string) => {
    setSelectedDatasetId(datasetId);
    setLoading(true);
    setLoadSuccess(false);
    try {
      const data = await api.loadCuratedDataset(datasetId, "default");
      setLoadedDataset(data);
      setLoadSuccess(true);
    } catch (e) {
      console.error("Failed to load preset dataset", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-[#09090B] text-zinc-100 overflow-hidden bg-grid-pattern selection:bg-blue-600 selection:text-white">
      {/* Background Radial Glows */}
      <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-full max-w-7xl h-[500px] overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-[-100px] left-1/2 transform -translate-x-1/2 w-[700px] h-[350px] bg-gradient-to-tr from-blue-600/15 via-indigo-600/10 to-violet-600/10 blur-[120px] rounded-full" />
      </div>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16 text-center space-y-8">
        {/* Top Feature Pill */}
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full border border-zinc-800 bg-zinc-900/60 backdrop-blur-md text-xs text-zinc-300 shadow-sm hover:border-zinc-700 transition-colors">
          <span className="flex h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
          <span className="font-medium text-zinc-200">OpenDataLens Platform</span>
          <span className="text-zinc-600">•</span>
          <span className="text-blue-400 font-medium">Leak-Free Automated ML</span>
        </div>

        {/* Hero Title */}
        <div className="max-w-4xl mx-auto space-y-4">
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-bold tracking-tight text-white leading-[1.1]">
            Explore Remote Datasets. <br />
            <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-violet-400 bg-clip-text text-transparent">
              Audit Quality. Train &amp; Compare Models.
            </span>
          </h1>
          <p className="text-base sm:text-lg text-zinc-400 max-w-2xl mx-auto leading-relaxed font-normal">
            A developer-first machine learning workbench. Search public Hugging Face repositories, detect data health anomalies, train baseline Scikit-learn pipelines with zero data leakage, and export reproducible model binaries.
          </p>
        </div>

        {/* Primary CTA Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Link
            href="/explorer"
            className="inline-flex items-center space-x-2 px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm shadow-lg shadow-blue-600/25 transition-all duration-150 active:scale-95"
          >
            <span>Explore Datasets</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/studio"
            className="inline-flex items-center space-x-2 px-5 py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 hover:text-white border border-zinc-800 font-semibold text-sm transition-all duration-150"
          >
            <Sparkles className="w-4 h-4 text-blue-400" />
            <span>Launch ML Studio</span>
          </Link>
          <a
            href="https://github.com/deepakpradhan1021/OpenDataLens"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center space-x-2 px-4 py-3 rounded-xl bg-transparent hover:bg-zinc-800/40 text-zinc-400 hover:text-white border border-transparent hover:border-zinc-800 text-sm transition-colors"
          >
            <Github className="w-4 h-4" />
            <span>Star on GitHub</span>
          </a>
        </div>

        {/* Interactive In-Memory Dataset Mounting Terminal */}
        <div className="pt-8 max-w-4xl mx-auto text-left">
          <div className="rounded-2xl border border-zinc-800/90 bg-[#101014] shadow-2xl overflow-hidden">
            {/* Terminal Window Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/80 bg-zinc-950/60 text-xs font-mono">
              <div className="flex items-center space-x-2">
                <span className="w-3 h-3 rounded-full bg-red-500/80 inline-block" />
                <span className="w-3 h-3 rounded-full bg-yellow-500/80 inline-block" />
                <span className="w-3 h-3 rounded-full bg-green-500/80 inline-block" />
                <span className="text-zinc-500 ml-2">opendatalens-live-workspace</span>
              </div>
              <div className="flex items-center space-x-3 text-zinc-400">
                <span className="flex items-center space-x-1 text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>FastAPI Connected</span>
                </span>
              </div>
            </div>

            {/* Dataset Quick Tabs */}
            <div className="p-4 sm:p-6 space-y-6">
              <div>
                <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2.5">
                  Select Benchmark to Mount Into Active Memory:
                </div>
                <div className="flex flex-wrap gap-2">
                  {PRESET_DATASETS.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => handleQuickLoad(d.id)}
                      className={`px-3.5 py-2 rounded-lg text-xs font-medium transition-all ${
                        selectedDatasetId === d.id
                          ? "bg-blue-600 text-white shadow-md shadow-blue-600/30 border border-blue-500 font-semibold"
                          : "bg-zinc-900 text-zinc-300 hover:bg-zinc-800 border border-zinc-800"
                      }`}
                    >
                      <span>{d.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Mounted Dataset Inspector Card */}
              <div className="p-4 rounded-xl border border-zinc-800/80 bg-zinc-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-sm text-white">{currentPreset.name}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      {currentPreset.task}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">
                      {currentPreset.tag}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400">{currentPreset.desc}</p>
                  <div className="text-[11px] font-mono text-zinc-500 pt-1">
                    Dimensions: {currentPreset.rows.toLocaleString()} rows × {currentPreset.cols} columns
                  </div>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  <button
                    onClick={() => handleQuickLoad(selectedDatasetId)}
                    disabled={loading}
                    className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold border border-zinc-700 transition-colors flex items-center space-x-1.5"
                  >
                    {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" /> : <Play className="w-3.5 h-3.5 fill-white" />}
                    <span>{loadSuccess ? "Remount" : "Mount Dataset"}</span>
                  </button>
                  <Link
                    href="/studio"
                    className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-colors flex items-center space-x-1.5"
                  >
                    <span>Train ML</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>

              {loadSuccess && loadedDataset && (
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono flex items-center justify-between animate-in fade-in duration-200">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Mounted `{loadedDataset.metadata?.name}` into active memory session.</span>
                  </div>
                  <Link href="/quality" className="text-white hover:underline text-xs font-medium">
                    View Quality Audit →
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Bento Grid Feature Showcase */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 border-t border-zinc-800/80">
        <div className="text-center max-w-2xl mx-auto mb-14 space-y-3">
          <h2 className="text-3xl font-bold tracking-tight text-white">
            Engineered for Modern ML Workflows
          </h2>
          <p className="text-sm text-zinc-400">
            A cohesive suite of four core engines replacing ad-hoc scripts with end-to-end reproducibility.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Card 1: Explorer */}
          <div className="rounded-2xl border border-zinc-800 bg-[#101014] p-6 flex flex-col justify-between space-y-4 hover:border-zinc-700 transition-colors group">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Database className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-base text-white">1. Dataset Explorer</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Connect directly to Hugging Face Hub, load curated classification &amp; regression benchmarks, or upload local CSVs with auto-delimiter sniffing.
              </p>
            </div>
            <Link
              href="/explorer"
              className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center space-x-1 pt-2"
            >
              <span>Explore Datasets</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Card 2: Quality */}
          <div className="rounded-2xl border border-zinc-800 bg-[#101014] p-6 flex flex-col justify-between space-y-4 hover:border-zinc-700 transition-colors group">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-base text-white">2. Quality Profiler</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Calculate completeness scores, detect duplicate rows, visualize missingness ratios, compute Pearson correlation heatmaps, and surface diagnostic warnings.
              </p>
            </div>
            <Link
              href="/quality"
              className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center space-x-1 pt-2"
            >
              <span>Audit Quality</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Card 3: Studio */}
          <div className="rounded-2xl border border-zinc-800 bg-[#101014] p-6 flex flex-col justify-between space-y-4 hover:border-zinc-700 transition-colors group">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Cpu className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-base text-white">3. ML Studio</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Configure classification or regression pipelines, choose feature subsets and scalers, and train multiple Scikit-learn models on asynchronous background workers.
              </p>
            </div>
            <Link
              href="/studio"
              className="text-xs font-semibold text-violet-400 hover:text-violet-300 flex items-center space-x-1 pt-2"
            >
              <span>Launch Studio</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Card 4: Comparison */}
          <div className="rounded-2xl border border-zinc-800 bg-[#101014] p-6 flex flex-col justify-between space-y-4 hover:border-zinc-700 transition-colors group">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                <BarChart3 className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-base text-white">4. Model Showdown</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Compare models across Accuracy, F1, RMSE, and R², inspect confusion matrix heatmaps, and export production-ready `.joblib` model pipelines.
              </p>
            </div>
            <Link
              href="/comparison"
              className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center space-x-1 pt-2"
            >
              <span>Compare Models</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Floating Command Dock */}
      <RetroDock
        filters={filters}
        onFilterChange={setFilters}
        viewMode={viewMode}
        onToggleView={() => setViewMode((v) => (v === "grid" ? "list" : "grid"))}
      />
    </div>
  );
}
