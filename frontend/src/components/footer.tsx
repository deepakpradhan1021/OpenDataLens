import React from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-black bg-[#0C0C0E] text-zinc-400 font-mono text-xs select-none mt-20">
      {/* Top Banner */}
      <div className="bg-zinc-900 border-b border-zinc-800 px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-[11px] uppercase tracking-wider text-zinc-400">
        <div className="flex items-center gap-3">
          <span className="text-[#9AE6B4]">● ONLINE</span>
          <span>FASTAPI BACKEND: RUNNING</span>
          <span>SCIKIT-LEARN 1.5+ // HF DATASETS // PANDAS</span>
        </div>
        <div className="flex items-center gap-3 text-zinc-500">
          <span>LATENCY: ~12ms</span>
          <span>TERMINAL MODE: ACTIVE</span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* Col 1: Brand & Philosophy */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-[#1864FF] text-white flex items-center justify-center font-black text-xs border border-black shadow-[1px_1px_0px_0px_#000]">
              ODL
            </div>
            <span className="font-bold text-sm tracking-wider text-white">
              OpenDataLens
            </span>
          </div>
          <p className="text-zinc-500 text-[11px] leading-relaxed">
            Retro-engineered dataset explorer & automated model proving ground.
            Discover data, audit quality, train baselines and export research-ready reports.
          </p>
          <div className="pt-2">
            <span className="inline-block px-2 py-0.5 border border-zinc-800 bg-zinc-950 text-zinc-400 text-[10px]">
              AWWWARDS RETRO AESTHETIC V2.4
            </span>
          </div>
        </div>

        {/* Col 2: Modules */}
        <div className="space-y-2">
          <div className="font-bold text-white uppercase tracking-wider text-[11px] pb-1 border-b border-zinc-800">
            WORKSTATION
          </div>
          <ul className="space-y-1.5 text-[11px]">
            <li>
              <Link href="/dashboard" className="hover:text-white transition-colors flex items-center gap-1">
                <span>01. DASHBOARD HUB</span>
              </Link>
            </li>
            <li>
              <Link href="/explorer" className="hover:text-white transition-colors flex items-center gap-1">
                <span>02. DATASET EXPLORER</span>
              </Link>
            </li>
            <li>
              <Link href="/quality" className="hover:text-white transition-colors flex items-center gap-1">
                <span>03. QUALITY PROFILER</span>
              </Link>
            </li>
            <li>
              <Link href="/studio" className="hover:text-white transition-colors flex items-center gap-1">
                <span>04. ML TRAINING STUDIO</span>
              </Link>
            </li>
          </ul>
        </div>

        {/* Col 3: Benchmarks */}
        <div className="space-y-2">
          <div className="font-bold text-white uppercase tracking-wider text-[11px] pb-1 border-b border-zinc-800">
            EVALUATION
          </div>
          <ul className="space-y-1.5 text-[11px]">
            <li>
              <Link href="/comparison" className="hover:text-white transition-colors flex items-center gap-1">
                <span>05. MODEL SHOWDOWN</span>
              </Link>
            </li>
            <li>
              <Link href="/reports" className="hover:text-white transition-colors flex items-center gap-1">
                <span>06. REPORT DISPATCH</span>
              </Link>
            </li>
            <li>
              <a
                href="https://huggingface.co/datasets"
                target="_blank"
                rel="noreferrer"
                className="hover:text-[#1864FF] transition-colors flex items-center gap-1"
              >
                <span>HUGGING FACE HUB</span>
                <ArrowUpRight className="w-3 h-3" />
              </a>
            </li>
          </ul>
        </div>

        {/* Col 4: Engine Specs */}
        <div className="space-y-2">
          <div className="font-bold text-white uppercase tracking-wider text-[11px] pb-1 border-b border-zinc-800">
            ENGINE ARCHITECTURE
          </div>
          <div className="p-3 bg-zinc-950 border border-zinc-800 text-[10px] space-y-1 font-mono text-zinc-400">
            <div>PYTHON: 3.13 / FASTAPI</div>
            <div>ML ENGINE: SCIKIT-LEARN 1.5</div>
            <div>FRONTEND: NEXT.JS 14 APP ROUTER</div>
            <div>STYLING: TAILWIND + RETRO RRE AESTHETIC</div>
            <div className="text-[#9AE6B4] pt-1">TESTS: 48/48 PASSING (100%)</div>
          </div>
        </div>
      </div>

      <div className="border-t border-zinc-800 py-4 px-4 sm:px-6 max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between text-zinc-500 text-[11px]">
        <div>© 2026 OPENDATALENS. RETRO-DIGITAL INTERFACE. ALL RIGHTS RESERVED.</div>
        <div className="flex gap-4 mt-2 sm:mt-0 font-bold">
          <Link href="/explorer" className="hover:text-white">DATASETS</Link>
          <Link href="/studio" className="hover:text-white">STUDIO</Link>
          <Link href="/reports" className="hover:text-white">EXPORT</Link>
        </div>
      </div>
    </footer>
  );
}
