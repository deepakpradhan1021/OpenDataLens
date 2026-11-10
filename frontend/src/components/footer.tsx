import React from "react";
import Link from "next/link";
import { ArrowUpRight, Github, Layers, ShieldCheck, Cpu, Database } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-zinc-800/80 bg-[#09090B] text-zinc-400 text-xs select-none mt-20">
      {/* Top Status Bar */}
      <div className="border-b border-zinc-800/60 bg-zinc-900/30 px-4 sm:px-6 lg:px-8 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center space-x-3">
            <span className="flex items-center space-x-1.5 text-emerald-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>FastAPI Engine Operational</span>
            </span>
            <span className="text-zinc-600 hidden sm:inline">•</span>
            <span className="text-zinc-400 hidden sm:inline">Port 8000 (Local Microservice)</span>
            <span className="text-zinc-600 hidden md:inline">•</span>
            <span className="text-zinc-500 hidden md:inline">Scikit-learn 1.5+ • HF Datasets • Pandas</span>
          </div>

          <div className="flex items-center space-x-4 text-zinc-400">
            <a
              href="https://github.com/deepakpradhan1021/OpenDataLens"
              target="_blank"
              rel="noreferrer"
              className="hover:text-white transition-colors flex items-center space-x-1"
            >
              <Github className="w-3.5 h-3.5" />
              <span>GitHub Repo</span>
              <ArrowUpRight className="w-3 h-3 text-zinc-500" />
            </a>
          </div>
        </div>
      </div>

      {/* Main Footer Links */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* Col 1: Brand & Overview */}
        <div className="space-y-3 md:col-span-1">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white">
              <Layers className="w-4 h-4" />
            </div>
            <span className="font-semibold text-sm tracking-tight text-white">
              OpenDataLens
            </span>
          </div>
          <p className="text-zinc-400 text-xs leading-relaxed">
            AI-powered dataset explorer and automated model evaluation platform. Streamline discovery, data quality profiling, pipeline fitting, and benchmark reporting.
          </p>
        </div>

        {/* Col 2: Exploration & Auditing */}
        <div className="space-y-2.5">
          <div className="font-semibold text-zinc-200 text-xs tracking-wider uppercase">
            Data Platform
          </div>
          <ul className="space-y-2 text-xs">
            <li>
              <Link href="/explorer" className="hover:text-white transition-colors">
                Dataset Discovery
              </Link>
            </li>
            <li>
              <Link href="/quality" className="hover:text-white transition-colors">
                Data Quality Profiler
              </Link>
            </li>
            <li>
              <Link href="/dashboard" className="hover:text-white transition-colors">
                Telemetry Dashboard
              </Link>
            </li>
            <li>
              <a
                href="https://huggingface.co/datasets"
                target="_blank"
                rel="noreferrer"
                className="hover:text-white transition-colors inline-flex items-center space-x-1"
              >
                <span>Hugging Face Datasets</span>
                <ArrowUpRight className="w-3 h-3 text-zinc-500" />
              </a>
            </li>
          </ul>
        </div>

        {/* Col 3: Machine Learning & Benchmarking */}
        <div className="space-y-2.5">
          <div className="font-semibold text-zinc-200 text-xs tracking-wider uppercase">
            ML Workflows
          </div>
          <ul className="space-y-2 text-xs">
            <li>
              <Link href="/studio" className="hover:text-white transition-colors">
                ML Training Studio
              </Link>
            </li>
            <li>
              <Link href="/comparison" className="hover:text-white transition-colors">
                Model Comparison
              </Link>
            </li>
            <li>
              <Link href="/reports" className="hover:text-white transition-colors">
                Evaluation Reports
              </Link>
            </li>
            <li>
              <span className="text-zinc-500 text-[11px]">
                Leak-Free Scikit-Learn Pipelines
              </span>
            </li>
          </ul>
        </div>

        {/* Col 4: Open Source Specifications */}
        <div className="space-y-2.5">
          <div className="font-semibold text-zinc-200 text-xs tracking-wider uppercase">
            Specifications
          </div>
          <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800 text-[11px] font-mono space-y-1 text-zinc-400">
            <div>Framework: Next.js 14 App Router</div>
            <div>Backend: Python FastAPI</div>
            <div>Engine: Scikit-learn &amp; Pandas</div>
            <div>License: MIT Open Source</div>
          </div>
        </div>
      </div>

      {/* Copyright Bar */}
      <div className="border-t border-zinc-800/60 py-6 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between text-zinc-400 text-xs">
        <div>© 2026 OpenDataLens. Built for engineers, data scientists, and ML practitioners.</div>
        <div className="flex items-center space-x-4 mt-3 sm:mt-0">
          <Link href="/explorer" className="hover:text-white transition-colors">Datasets</Link>
          <Link href="/studio" className="hover:text-white transition-colors">Studio</Link>
          <Link href="/reports" className="hover:text-white transition-colors">Exports</Link>
        </div>
      </div>
    </footer>
  );
}
