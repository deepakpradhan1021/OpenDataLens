"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Database,
  ShieldCheck,
  Cpu,
  BarChart2,
  FileCode,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Activity,
  Layers,
  BrainCircuit,
  Sliders,
  ExternalLink,
  Code2,
  GitBranch,
  Play,
  Terminal,
  HelpCircle,
  FileSpreadsheet,
} from "lucide-react";
import { api } from "@/lib/api";
import { DatasetPreviewResponse } from "@/lib/types";

const PRESET_DATASETS = [
  {
    id: "iris",
    name: "Iris Flower Species",
    task: "Classification",
    rows: 150,
    cols: 5,
    tag: "Botany",
    desc: "Classic 3-class morphological benchmark with sepal and petal measurements.",
  },
  {
    id: "wine_recognition",
    name: "Wine Recognition Benchmark",
    task: "Classification",
    rows: 178,
    cols: 14,
    tag: "Chemistry",
    desc: "178 chemical samples across 3 cultivars with 13 continuous measurements.",
  },
  {
    id: "california_housing",
    name: "California Housing Prices",
    task: "Regression",
    rows: 20640,
    cols: 9,
    tag: "Real Estate",
    desc: "Census block housing values with geospatial coordinates and median income.",
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
    id: "titanic_synthetic",
    name: "Titanic Survival (Synthetic Demo)",
    task: "Classification",
    rows: 891,
    cols: 9,
    tag: "Synthetic Demo",
    desc: "Synthetic demo benchmark modeled on passenger demographics for tabular ML testing.",
  },
];

const WORKFLOW_STEPS = [
  {
    step: "01",
    title: "Dataset Discovery",
    desc: "Stream tabular datasets from Hugging Face Hub, load curated Scikit-learn benchmarks, or upload custom CSVs.",
    href: "/explorer",
    icon: Database,
    color: "text-blue-400",
  },
  {
    step: "02",
    title: "Quality Intelligence",
    desc: "Automated completeness audit, IQR numerical outlier detection, target leakage warning, and class imbalance checks.",
    href: "/quality",
    icon: ShieldCheck,
    color: "text-emerald-400",
  },
  {
    step: "03",
    title: "Leak-Free ML Studio",
    desc: "Stratified splitting with preprocessors fitted strictly on training folds to prevent distribution leakage.",
    href: "/studio",
    icon: Cpu,
    color: "text-indigo-400",
  },
  {
    step: "04",
    title: "Leaderboard & Scoreboard",
    desc: "Multi-model tournament ranking with 5-Fold Cross Validation mean ± standard deviation scores.",
    href: "/comparison",
    icon: BarChart2,
    color: "text-amber-400",
  },
  {
    step: "05",
    title: "Explainable AI (XAI)",
    desc: "Permutation feature importance on test splits (accounting for correlated feature redundancy) and native estimator weights.",
    href: "/comparison",
    icon: BrainCircuit,
    color: "text-purple-400",
  },
  {
    step: "06",
    title: "Data Drift Detection",
    desc: "On-demand distribution shift analysis via Population Stability Index (PSI) and Kolmogorov-Smirnov tests.",
    href: "/drift",
    icon: Activity,
    color: "text-rose-400",
  },
  {
    step: "07",
    title: "Audits & Model Export",
    desc: "Synthesize full Markdown/HTML/JSON dossiers and download serializable Scikit-learn .joblib binaries.",
    href: "/reports",
    icon: FileCode,
    color: "text-sky-400",
  },
];

const TECH_STACK = [
  { name: "Next.js 14", role: "App Router & SSR", badge: "Frontend" },
  { name: "TypeScript", role: "Type-Safe Client", badge: "Language" },
  { name: "Tailwind CSS", role: "Modern Design Tokens", badge: "Styling" },
  { name: "FastAPI", role: "Python Microservice", badge: "Backend" },
  { name: "Scikit-Learn", role: "ML Pipelines & Estimators", badge: "Engine" },
  { name: "Pandas & NumPy", role: "Vectorized Computations", badge: "Data" },
  { name: "SciPy", role: "Statistical Tests & PSI", badge: "Math" },
  { name: "Recharts", role: "Interactive Visualizations", badge: "Charts" },
];

export default function HomePage() {
  const [selectedDatasetId, setSelectedDatasetId] = useState("iris");
  const [loadedDataset, setLoadedDataset] = useState<DatasetPreviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadSuccess, setLoadSuccess] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const currentPreset = PRESET_DATASETS.find((d) => d.id === selectedDatasetId) || PRESET_DATASETS[0];

  const handleQuickLoad = async (datasetId: string) => {
    setSelectedDatasetId(datasetId);
    setLoading(true);
    setLoadSuccess(false);
    setLoadError(null);
    try {
      const data = await api.loadCuratedDataset(datasetId);
      setLoadedDataset(data);
      setLoadSuccess(true);
    } catch (e: any) {
      console.error("Failed to load preset dataset", e);
      setLoadError(e.response?.data?.detail || e.message || "Failed to mount demo dataset. Ensure backend service is reachable.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-[#09090B] text-zinc-100 overflow-hidden selection:bg-blue-600 selection:text-white">
      {/* Background Radial Glow */}
      <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-full max-w-7xl h-[500px] overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-[-100px] left-1/2 transform -translate-x-1/2 w-[700px] h-[350px] bg-gradient-to-tr from-blue-600/15 via-indigo-600/10 to-violet-600/10 blur-[120px] rounded-full" />
      </div>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16 text-center space-y-8">
        {/* Top Feature Pill */}
        <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full border border-zinc-800 bg-zinc-900/60 backdrop-blur-md text-xs text-zinc-300 shadow-sm hover:border-zinc-700 transition-colors">
          <span className="flex h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
          <span className="font-medium text-zinc-200">OpenDataLens Platform</span>
          <span className="text-zinc-600">•</span>
          <span className="text-blue-400 font-medium">Leak-Free Automated Machine Learning</span>
        </div>

        {/* Hero Title */}
        <div className="max-w-4xl mx-auto space-y-4">
          <h1 className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-white leading-[1.08]">
            Explore Remote Datasets. <br />
            <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-violet-400 bg-clip-text text-transparent">
              Audit Quality. Train &amp; Compare Models.
            </span>
          </h1>
          <p className="text-sm sm:text-base md:text-lg text-zinc-400 max-w-2xl mx-auto leading-relaxed font-normal">
            A developer-first machine learning workbench. Search public Hugging Face repositories, detect data health anomalies, train baseline Scikit-learn pipelines with zero data leakage, and export reproducible model binaries.
          </p>
        </div>

        {/* Hero CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link
            href="/dashboard"
            className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-6 py-2.5 sm:py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm shadow-md shadow-blue-600/30 transition-all duration-150 active:scale-95"
          >
            <span>Open Workspace</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/explorer"
            className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-6 py-2.5 sm:py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-200 font-medium text-sm transition-all duration-150 active:scale-95"
          >
            <Database className="w-4 h-4 text-zinc-400" />
            <span>Browse Datasets</span>
          </Link>
          <a
            href="https://github.com/deepakpradhan1021/OpenDataLens"
            target="_blank"
            rel="noreferrer"
            className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-5 py-2.5 sm:py-3 rounded-xl bg-zinc-900/60 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 text-sm font-medium transition-colors"
          >
            <GitBranch className="w-4 h-4 text-zinc-400" />
            <span>GitHub Repository</span>
          </a>
        </div>
      </section>

      {/* INTERACTIVE TRY DEMO SANDBOX */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="rounded-3xl border border-zinc-800 bg-[#101014] p-6 sm:p-8 shadow-xl space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
            <div>
              <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 mb-2">
                <Play className="w-3 h-3" />
                <span>Try Demo Sandbox</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white">
                Instant Interactive Dataset Mounting
              </h2>
              <p className="text-xs sm:text-sm text-zinc-400 mt-1">
                Load a curated benchmark dataset into your browser workspace in one click.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {PRESET_DATASETS.map((d) => (
                <button
                  key={d.id}
                  onClick={() => handleQuickLoad(d.id)}
                  disabled={loading}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    selectedDatasetId === d.id
                      ? "bg-blue-600 text-white shadow-sm shadow-blue-600/30"
                      : "bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-700"
                  }`}
                >
                  {d.name}
                </button>
              ))}
            </div>
          </div>

          {/* Preset Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-1">
              <div className="text-[11px] text-zinc-400 font-medium uppercase tracking-wider">Dataset Profile</div>
              <div className="text-base font-semibold text-white tracking-tight">{currentPreset.name}</div>
              <div className="text-xs text-zinc-400 leading-relaxed font-normal">{currentPreset.desc}</div>
            </div>

            <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-1">
              <div className="text-[11px] text-zinc-400 font-medium uppercase tracking-wider">Dimensions</div>
              <div className="text-base font-semibold text-white font-mono tracking-tight">
                {currentPreset.rows.toLocaleString()} rows × {currentPreset.cols} cols
              </div>
              <div className="text-xs text-zinc-400 font-normal">Task: <span className="text-zinc-300 font-medium">{currentPreset.task}</span></div>
            </div>

            <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 flex flex-col justify-between">
              <div className="text-[11px] text-zinc-400 font-medium uppercase tracking-wider">Workspace Status</div>
              {loadSuccess ? (
                <div className="flex items-center space-x-2 text-emerald-400 text-xs font-medium">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Mounted into session memory</span>
                </div>
              ) : (
                <div className="text-xs text-zinc-500 font-normal">Ready to mount</div>
              )}
              <Link
                href="/quality"
                className="inline-flex items-center space-x-1.5 text-xs font-medium text-blue-400 hover:text-blue-300 mt-2 transition-colors"
              >
                <span>Run Quality Audit</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Preset Load Error Banner */}
          {loadError && (
            <div className="p-3.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs flex items-center justify-between">
              <span className="font-medium">{loadError}</span>
              <button
                onClick={() => handleQuickLoad(selectedDatasetId)}
                className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-xs font-semibold transition-colors"
              >
                Retry Mounting
              </button>
            </div>
          )}
        </div>
      </section>

      {/* 7-STEP REPRODUCIBLE ML WORKFLOW */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-12">
        <div className="text-center space-y-3 max-w-3xl mx-auto">
          <div className="text-xs font-mono font-semibold uppercase text-blue-400 tracking-wider">
            Architecture &amp; Lifecycle
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
            End-to-End Machine Learning Workflow
          </h2>
          <p className="text-sm text-zinc-400">
            A standardized, disciplined lifecycle from ingestion to drift monitoring with strict zero data leakage.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {WORKFLOW_STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <Link
                key={step.step}
                href={step.href}
                className="group p-5 rounded-2xl border border-zinc-800/80 bg-zinc-900/30 hover:bg-zinc-900/70 hover:border-zinc-700 transition-all space-y-3 flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-zinc-500 group-hover:text-zinc-300">
                      {step.step}
                    </span>
                    <Icon className={`w-5 h-5 ${step.color}`} />
                  </div>
                  <h3 className="text-base font-bold text-white group-hover:text-blue-400 transition-colors">
                    {step.title}
                  </h3>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    {step.desc}
                  </p>
                </div>
                <div className="flex items-center space-x-1.5 text-xs text-blue-400 font-semibold pt-2">
                  <span>Explore Stage</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* TECHNOLOGY STACK */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 border-t border-zinc-800/80 space-y-8">
        <div className="text-center space-y-2">
          <h3 className="text-xl font-bold text-white">Engineered with Production-Grade Tools</h3>
          <p className="text-xs text-zinc-400">Full-stack modular architecture powered by modern web and data engineering primitives</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {TECH_STACK.map((tech) => (
            <div key={tech.name} className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-1 text-left">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-zinc-200">{tech.name}</span>
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                  {tech.badge}
                </span>
              </div>
              <div className="text-[11px] text-zinc-500">{tech.role}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800/80 py-8 px-4 text-center text-xs text-zinc-500 space-y-2">
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5">
          <Link href="/dashboard" className="hover:text-zinc-300">Dashboard</Link>
          <span className="text-zinc-700 hidden sm:inline">•</span>
          <Link href="/explorer" className="hover:text-zinc-300">Explorer</Link>
          <span className="text-zinc-700 hidden sm:inline">•</span>
          <Link href="/quality" className="hover:text-zinc-300">Quality</Link>
          <span className="text-zinc-700 hidden sm:inline">•</span>
          <Link href="/studio" className="hover:text-zinc-300">ML Studio</Link>
          <span className="text-zinc-700 hidden sm:inline">•</span>
          <Link href="/drift" className="hover:text-zinc-300">Data Drift</Link>
          <span className="text-zinc-700 hidden sm:inline">•</span>
          <Link href="/reports" className="hover:text-zinc-300">Reports</Link>
        </div>
        <div className="text-[11px] text-zinc-600">OpenDataLens Platform • Interactive Portfolio &amp; Demonstration under MIT License</div>
      </footer>
    </div>
  );
}
