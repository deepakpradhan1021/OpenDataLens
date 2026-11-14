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
import { api, categorizeApiError } from "@/lib/api";
import { DatasetPreviewResponse } from "@/lib/types";
import { Ring } from "@/components/loading-ui/ring";

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
      const cat = categorizeApiError(e);
      if (cat.type === "cold_start") {
        setLoadError("Waking up the backend. This may take up to 50 seconds on Render's free tier. Please click Retry Mounting once awake.");
      } else if (cat.type === "timeout") {
        setLoadError("Connection timed out after 75s. The backend may still be starting up. Please click Retry Mounting.");
      } else {
        setLoadError(cat.message || "Failed to mount demo dataset. Ensure backend service is reachable.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-background text-foreground overflow-hidden">
      {/* Background Radial Glow */}
      <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-full max-w-7xl h-[500px] overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-[-100px] left-1/2 transform -translate-x-1/2 w-[700px] h-[350px] bg-gradient-to-tr from-emerald-500/15 via-teal-500/10 to-emerald-600/10 blur-[120px] rounded-full" />
      </div>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16 text-center space-y-8">
        {/* Top Feature Pill */}
        <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full border border-border bg-card/70 backdrop-blur-md text-xs text-foreground shadow-sm hover:border-emerald-500/40 transition-colors">
          <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-semibold text-foreground">OpenDataLens Platform</span>
          <span className="text-border">•</span>
          <span className="text-emerald-600 dark:text-emerald-400 font-medium">Leak-Free Automated Machine Learning</span>
        </div>

        {/* Hero Title */}
        <div className="max-w-4xl mx-auto space-y-4">
          <h1 className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-foreground leading-[1.08]">
            Explore Remote Datasets. <br />
            <span className="bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-500 dark:from-emerald-400 dark:via-teal-300 dark:to-emerald-200 bg-clip-text text-transparent">
              Audit Quality. Train &amp; Compare Models.
            </span>
          </h1>
          <p className="text-sm sm:text-base md:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed font-normal">
            A developer-first machine learning workbench. Search public Hugging Face repositories, detect data health anomalies, train baseline Scikit-learn pipelines with zero data leakage, and export reproducible model binaries.
          </p>
        </div>

        {/* Hero CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link
            href="/dashboard"
            className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-6 py-2.5 sm:py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm shadow-md shadow-emerald-600/25 transition-all duration-150 active:scale-95"
          >
            <span>Open Workspace</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/explorer"
            className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-6 py-2.5 sm:py-3 rounded-xl bg-card hover:bg-muted border border-border text-foreground font-medium text-sm transition-all duration-150 active:scale-95 shadow-sm"
          >
            <Database className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Browse Datasets</span>
          </Link>
          <a
            href="https://github.com/deepakpradhan1021/OpenDataLens"
            target="_blank"
            rel="noreferrer"
            className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-5 py-2.5 sm:py-3 rounded-xl bg-muted/60 hover:bg-muted border border-border text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
          >
            <GitBranch className="w-4 h-4 text-muted-foreground" />
            <span>GitHub Repository</span>
          </a>
        </div>
      </section>

      {/* INTERACTIVE TRY DEMO SANDBOX */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-xl space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/80 pb-6">
            <div>
              <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 mb-2">
                <Play className="w-3 h-3" />
                <span>Try Demo Sandbox</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-foreground">
                Instant Interactive Dataset Mounting
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                Load a curated benchmark dataset into your browser workspace in one click.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {PRESET_DATASETS.map((d) => (
                <button
                  key={d.id}
                  onClick={() => handleQuickLoad(d.id)}
                  disabled={loading}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all inline-flex items-center gap-1.5 ${
                    selectedDatasetId === d.id
                      ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/30"
                      : "bg-muted text-muted-foreground hover:text-foreground border border-border hover:border-emerald-500/30"
                  }`}
                >
                  {selectedDatasetId === d.id && loading && (
                    <Ring className="size-3 text-white" />
                  )}
                  <span>{d.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Preset Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border border-border bg-muted/30 space-y-1">
              <div className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Dataset Profile</div>
              <div className="text-base font-semibold text-foreground tracking-tight">{currentPreset.name}</div>
              <div className="text-xs text-muted-foreground leading-relaxed font-normal">{currentPreset.desc}</div>
            </div>

            <div className="p-4 rounded-xl border border-border bg-muted/30 space-y-1">
              <div className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Dimensions</div>
              <div className="text-base font-semibold text-foreground font-mono tracking-tight">
                {currentPreset.rows.toLocaleString()} rows × {currentPreset.cols} cols
              </div>
              <div className="text-xs text-muted-foreground font-normal">Task: <span className="text-foreground font-medium">{currentPreset.task}</span></div>
            </div>

            <div className="p-4 rounded-xl border border-border bg-muted/30 flex flex-col justify-between">
              <div className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Workspace Status</div>
              {loading ? (
                <div className="flex items-center space-x-2 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
                  <Ring className="size-3.5 text-emerald-500 shrink-0" />
                  <span>Mounting into session memory...</span>
                </div>
              ) : loadSuccess ? (
                <div className="flex items-center space-x-2 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Mounted into session memory</span>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground font-normal">Ready to mount</div>
              )}
              <Link
                href="/quality"
                className="inline-flex items-center space-x-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline mt-2 transition-colors"
              >
                <span>Run Quality Audit</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Preset Load Error Banner */}
          {loadError && (
            <div className="p-3.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-300 text-xs flex items-center justify-between">
              <span className="font-medium">{loadError}</span>
              <button
                onClick={() => handleQuickLoad(selectedDatasetId)}
                className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-700 dark:text-rose-200 text-xs font-semibold transition-colors"
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
          <div className="text-xs font-mono font-semibold uppercase text-emerald-600 dark:text-emerald-400 tracking-wider">
            Architecture &amp; Lifecycle
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
            End-to-End Machine Learning Workflow
          </h2>
          <p className="text-sm text-muted-foreground">
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
                className="group p-5 rounded-2xl border border-border bg-card/60 hover:bg-card hover:border-emerald-500/40 hover:shadow-md transition-all space-y-3 flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-muted-foreground group-hover:text-foreground">
                      {step.step}
                    </span>
                    <Icon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <h3 className="text-base font-bold text-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                    {step.title}
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {step.desc}
                  </p>
                </div>
                <div className="flex items-center space-x-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold pt-2">
                  <span>Explore Stage</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* TECHNOLOGY STACK */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 border-t border-border space-y-8">
        <div className="text-center space-y-2">
          <h3 className="text-xl font-bold text-foreground">Engineered with Production-Grade Tools</h3>
          <p className="text-xs text-muted-foreground">Full-stack modular architecture powered by modern web and data engineering primitives</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {TECH_STACK.map((tech) => (
            <div key={tech.name} className="p-3.5 rounded-xl border border-border bg-card/50 space-y-1 text-left">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-foreground">{tech.name}</span>
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                  {tech.badge}
                </span>
              </div>
              <div className="text-[11px] text-muted-foreground">{tech.role}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
