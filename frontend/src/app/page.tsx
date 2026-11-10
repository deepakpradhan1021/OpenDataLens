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
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import { CuratedDatasetItem, DatasetPreviewResponse } from "@/lib/types";
import { RetroHeroTitle, RetroPixelWord } from "@/components/retro-pixel-heading";
import { RetroDock } from "@/components/retro-dock";
import { FilterState } from "@/components/retro-filter-drawer";
import {
  RetroMonitorIcon,
  RetroHeartDocIcon,
  RetroRobotIcon,
  RetroRocketIcon,
  RetroFolderGlobeIcon,
  RetroMacCoinIcon,
  RetroTerminalIcon,
  RetroCashIcon,
  RetroMicroscopeIcon,
  RetroPuzzleHeartIcon,
  RetroDogIcon,
  RetroUsersIcon,
  RetroHFIcon,
} from "@/components/retro-icons";

// Canvas node items mapping to datasets & domains
const CANVAS_NODES = [
  {
    id: "iris",
    label: "BOTANY",
    domain: "HEALTHCARE",
    icon: RetroHeartDocIcon,
    name: "Iris Flower Species",
    task: "Classification",
    rows: 150,
    cols: 5,
    top: "18%",
    left: "58%",
  },
  {
    id: "california_housing",
    label: "REAL ESTATE",
    domain: "REAL ESTATE",
    icon: RetroFolderGlobeIcon,
    name: "California Housing Prices",
    task: "Regression",
    rows: 20640,
    cols: 9,
    top: "76%",
    left: "32%",
  },
  {
    id: "wine_quality",
    label: "FOOD SCI",
    domain: "CONSUMER",
    icon: RetroMonitorIcon,
    name: "Wine Quality Benchmark",
    task: "Classification",
    rows: 1599,
    cols: 12,
    top: "22%",
    left: "44%",
  },
  {
    id: "diabetes",
    label: "HEALTH CARE",
    domain: "HEALTHCARE",
    icon: RetroPuzzleHeartIcon,
    name: "Diabetes Progression",
    task: "Regression",
    rows: 442,
    cols: 11,
    top: "48%",
    left: "38%",
  },
  {
    id: "titanic",
    label: "CONSUMER",
    domain: "CONSUMER",
    icon: RetroUsersIcon,
    name: "Titanic Passenger Survival",
    task: "Classification",
    rows: 891,
    cols: 12,
    top: "42%",
    left: "68%",
  },
  {
    id: "robotics",
    label: "ROBOTICS",
    domain: "ROBOTICS",
    icon: RetroRobotIcon,
    name: "Robotic Kinematics Stream",
    task: "Regression",
    rows: 5000,
    cols: 8,
    top: "72%",
    left: "42%",
  },
  {
    id: "space",
    label: "SPACE",
    domain: "SPACE",
    icon: RetroRocketIcon,
    name: "Exoplanet Transit Data",
    task: "Classification",
    rows: 9564,
    cols: 22,
    top: "12%",
    left: "80%",
  },
  {
    id: "crypto",
    label: "CRYPTO",
    domain: "FINTECH",
    icon: RetroMacCoinIcon,
    name: "Crypto Price Action",
    task: "Regression",
    rows: 14200,
    cols: 7,
    top: "68%",
    left: "82%",
  },
  {
    id: "fintech",
    label: "FINTECH",
    domain: "FINTECH",
    icon: RetroCashIcon,
    name: "Credit Card Fraud Matrix",
    task: "Classification",
    rows: 28480,
    cols: 30,
    top: "42%",
    left: "80%",
  },
  {
    id: "climate",
    label: "CLIMATE TECH",
    domain: "CLIMATE TECH",
    icon: RetroMicroscopeIcon,
    name: "Global Surface Temp Flux",
    task: "Regression",
    rows: 3200,
    cols: 6,
    top: "70%",
    left: "58%",
  },
  {
    id: "enterprise",
    label: "ENTERPRISE",
    domain: "ENTERPRISE",
    icon: RetroTerminalIcon,
    name: "Server Workload Logs",
    task: "Classification",
    rows: 12500,
    cols: 14,
    top: "68%",
    left: "68%",
  },
  {
    id: "pets",
    label: "PETS",
    domain: "CONSUMER",
    icon: RetroDogIcon,
    name: "Veterinary Diagnostics",
    task: "Classification",
    rows: 680,
    cols: 9,
    top: "18%",
    left: "68%",
  },
];

export default function LandingPage() {
  const router = useRouter();
  const [selectedNode, setSelectedNode] = useState<typeof CANVAS_NODES[0] | null>(null);
  const [loadingDataset, setLoadingDataset] = useState(false);
  const [loadedDataset, setLoadedDataset] = useState<DatasetPreviewResponse | null>(null);
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

  // Load dataset into active backend session on click
  const handleNodeClick = async (node: typeof CANVAS_NODES[0]) => {
    setSelectedNode(node);
    setLoadingDataset(true);
    try {
      // If it's one of curated IDs in backend: iris, california_housing, wine_quality, diabetes, titanic
      const datasetId = ["iris", "california_housing", "wine_quality", "diabetes", "titanic"].includes(node.id)
        ? node.id
        : "iris";
      const preview = await api.loadCuratedDataset(datasetId);
      setLoadedDataset(preview);
    } catch (err) {
      console.error("Failed to load dataset preview", err);
    } finally {
      setLoadingDataset(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-[#0C0C0E] text-white overflow-hidden bg-retro-grid selection:bg-[#1864FF] selection:text-white">
      {/* 1. HERO SECTION & DESKTOP CANVAS (Matches Reference Image 1) */}
      <section className="relative min-h-[92vh] max-w-7xl mx-auto px-4 sm:px-6 pt-12 pb-24 flex flex-col justify-between">
        {/* Editorial Text Block (Left Side) */}
        <div className="z-10 max-w-xl space-y-6 pt-6">
          <div className="space-y-1">
            <h1 className="text-5xl sm:text-7xl font-bold tracking-tight text-white leading-none">
              Explore Our
            </h1>
            <div className="pt-2">
              <RetroPixelWord
                text="DATASETS"
                pixelSize={7}
                gap={1.5}
                color="#FFFFFF"
                className="mt-1"
              />
            </div>
          </div>

          <p className="text-zinc-400 text-sm sm:text-base leading-relaxed font-normal pt-2">
            OpenDataLens is a retro-engineered dataset intelligence workstation and
            automated ML proving ground. We back researchers and developers executing against
            incredible data to build category-defining models.
          </p>

          <div>
            <Link
              href="/explorer"
              className="inline-flex items-center gap-2 font-mono text-xs font-bold text-[#1864FF] hover:text-[#4B88FF] tracking-wider uppercase transition-colors"
            >
              <span>CLICK TO EXPLORE OUR BENCHMARK CATALOG</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Scattered Retro Desktop Canvas (Right/Center of Canvas) */}
        <div className="absolute inset-0 pointer-events-none sm:pointer-events-auto">
          {CANVAS_NODES.map((node) => {
            const Icon = node.icon;
            const isSelected = selectedNode?.id === node.id;
            return (
              <div
                key={node.id}
                onClick={() => handleNodeClick(node)}
                style={{ top: node.top, left: node.left }}
                className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer group select-none transition-transform hover:scale-110 active:scale-95 z-20 pointer-events-auto"
              >
                {/* 32x32 Retro Icon */}
                <div className="flex flex-col items-center">
                  <div
                    className={`p-1 transition-all ${
                      isSelected
                        ? "ring-2 ring-[#1864FF] shadow-[0_0_12px_rgba(24,100,255,0.8)]"
                        : "group-hover:drop-shadow-[0_4px_6px_rgba(0,0,0,0.8)]"
                    }`}
                  >
                    <Icon size={38} />
                  </div>

                  {/* Retro Tag Pill Under Icon (Matches Reference) */}
                  <div
                    className={`mt-1.5 retro-pill shadow-[2px_2px_0px_0px_rgba(0,0,0,0.9)] ${
                      isSelected ? "active" : ""
                    }`}
                  >
                    <span>{node.label}</span>
                    <span className="text-[10px]">↗</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Active Node Quick Inspector (Pops up when user clicks an icon) */}
        {selectedNode && (
          <div className="fixed bottom-20 right-4 sm:right-8 z-40 w-full max-w-sm retro-window-light border border-black p-4 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] animate-in fade-in slide-in-from-bottom-4 duration-200">
            <div className="flex items-center justify-between pb-2 border-b border-black">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-[#1864FF] inline-block" />
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-black">
                  INSPECTOR: {selectedNode.label}
                </span>
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                className="p-1 hover:bg-zinc-200 text-black"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="py-3 text-black space-y-2">
              <div className="font-bold text-sm">{selectedNode.name}</div>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="p-1.5 bg-zinc-100 border border-zinc-300">
                  <div className="text-zinc-500 text-[10px]">TASK</div>
                  <div className="font-bold text-[#1864FF]">{selectedNode.task}</div>
                </div>
                <div className="p-1.5 bg-zinc-100 border border-zinc-300">
                  <div className="text-zinc-500 text-[10px]">ROWS / COLS</div>
                  <div className="font-bold">{selectedNode.rows} × {selectedNode.cols}</div>
                </div>
              </div>

              {loadingDataset ? (
                <div className="flex items-center justify-center gap-2 py-3 text-xs font-mono text-zinc-600">
                  <Loader2 className="w-4 h-4 animate-spin text-[#1864FF]" />
                  <span>LOADING INTO BACKEND SESSION...</span>
                </div>
              ) : (
                <div className="pt-2 flex gap-2">
                  <button
                    onClick={() => router.push("/quality")}
                    className="flex-1 py-1.5 px-2 bg-black text-white font-mono text-[11px] font-bold uppercase border border-black hover:bg-zinc-800 text-center"
                  >
                    RUN QUALITY
                  </button>
                  <button
                    onClick={() => router.push("/studio")}
                    className="flex-1 py-1.5 px-2 bg-[#1864FF] text-white font-mono text-[11px] font-bold uppercase border border-black hover:bg-[#0B4FD9] text-center"
                  >
                    TRAIN ML ↗
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Center CTA Button (Image 2) */}
        <div className="z-10 pt-16 flex justify-start sm:justify-center">
          <Link
            href="/explorer"
            className="btn-retro btn-retro-blue text-sm py-3 px-6 shadow-[4px_4px_0px_0px_#002B99]"
          >
            <span>VIEW ALL DATASETS</span>
            <ArrowRight className="w-4 h-4 ml-1" />
          </Link>
        </div>
      </section>

      {/* 2. SECOND SECTION: "WE'RE IN IT WITH THE BEST" (Matches Image 2) */}
      <section className="relative border-t border-zinc-800 bg-[#09090B] py-24 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto space-y-12">
          {/* Wireframe Pixel Headline */}
          <div className="text-center space-y-2 select-none">
            <h2 className="text-3xl sm:text-5xl md:text-6xl font-bold tracking-tight text-white uppercase">
              WE&apos;RE IN IT WITH
            </h2>
            <div className="pt-2 flex justify-center">
              <RetroPixelWord
                text="THE BEST"
                pixelSize={8}
                gap={1.5}
                color="#FFFFFF"
                wireframe={true}
              />
            </div>
            <p className="text-zinc-400 text-sm max-w-xl mx-auto pt-4 font-mono uppercase tracking-wider">
              IN EARLY-STAGE EXPLORATION & AUTOMATED ML BENCHMARKING ACROSS SCIKIT-LEARN & HUGGING FACE
            </p>
          </div>

          {/* 4 Retro Workstation Windows */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pt-6">
            {/* Box 1 */}
            <div className="retro-window-dark p-4 flex flex-col justify-between space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                <span className="font-mono text-[11px] font-bold text-zinc-400">01. REPO_EXPLORER</span>
                <span className="w-2 h-2 bg-[#1864FF] inline-block" />
              </div>
              <div className="space-y-2">
                <RetroMonitorIcon size={32} />
                <h3 className="font-bold text-base text-white">Dataset Discovery</h3>
                <p className="text-zinc-400 text-xs leading-relaxed">
                  Connect to Hugging Face Hub with live search, load curated baselines, or upload custom CSV matrices with auto-delimiter sniffing.
                </p>
              </div>
              <Link
                href="/explorer"
                className="font-mono text-xs font-bold text-[#1864FF] hover:underline flex items-center gap-1"
              >
                <span>OPEN EXPLORER</span>
                <span>↗</span>
              </Link>
            </div>

            {/* Box 2 */}
            <div className="retro-window-dark p-4 flex flex-col justify-between space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                <span className="font-mono text-[11px] font-bold text-zinc-400">02. DIAGNOSTICS</span>
                <span className="w-2 h-2 bg-[#9AE6B4] inline-block" />
              </div>
              <div className="space-y-2">
                <RetroHeartDocIcon size={32} />
                <h3 className="font-bold text-base text-white">Quality Profiler</h3>
                <p className="text-zinc-400 text-xs leading-relaxed">
                  Detect null ratios, duplicate rows, data leakage threats, and high-cardinality flags with automated statistical health scoring.
                </p>
              </div>
              <Link
                href="/quality"
                className="font-mono text-xs font-bold text-[#1864FF] hover:underline flex items-center gap-1"
              >
                <span>AUDIT QUALITY</span>
                <span>↗</span>
              </Link>
            </div>

            {/* Box 3 */}
            <div className="retro-window-dark p-4 flex flex-col justify-between space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                <span className="font-mono text-[11px] font-bold text-zinc-400">03. COMPILER</span>
                <span className="w-2 h-2 bg-[#FBBF24] inline-block" />
              </div>
              <div className="space-y-2">
                <RetroRobotIcon size={32} />
                <h3 className="font-bold text-base text-white">ML Training Studio</h3>
                <p className="text-zinc-400 text-xs leading-relaxed">
                  Train Random Forests, Gradient Boosters, Ridge & Logistic Regressions simultaneously on a background worker thread.
                </p>
              </div>
              <Link
                href="/studio"
                className="font-mono text-xs font-bold text-[#1864FF] hover:underline flex items-center gap-1"
              >
                <span>LAUNCH STUDIO</span>
                <span>↗</span>
              </Link>
            </div>

            {/* Box 4 */}
            <div className="retro-window-dark p-4 flex flex-col justify-between space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                <span className="font-mono text-[11px] font-bold text-zinc-400">04. SCOREBOARD</span>
                <span className="w-2 h-2 bg-[#EF4444] inline-block" />
              </div>
              <div className="space-y-2">
                <RetroRocketIcon size={32} />
                <h3 className="font-bold text-base text-white">Model Showdown</h3>
                <p className="text-zinc-400 text-xs leading-relaxed">
                  Compare Accuracy, F1, MAE, R² metrics side by side, inspect confusion heatmaps, and export production `.joblib` model binaries.
                </p>
              </div>
              <Link
                href="/comparison"
                className="font-mono text-xs font-bold text-[#1864FF] hover:underline flex items-center gap-1"
              >
                <span>VIEW SHOWDOWN</span>
                <span>↗</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Floating Retro Dock Toolbar */}
      <RetroDock
        filters={filters}
        onFilterChange={setFilters}
        viewMode={viewMode}
        onToggleView={() => setViewMode((v) => (v === "grid" ? "list" : "grid"))}
      />
    </div>
  );
}
