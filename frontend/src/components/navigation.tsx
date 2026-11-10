"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Layers,
  Terminal,
  Database,
  ShieldAlert,
  Cpu,
  BarChart2,
  FileCode,
  ArrowUpRight,
  RefreshCw,
} from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { api } from "@/lib/api";

const NAV_ITEMS = [
  { id: "01", name: "DASHBOARD", href: "/dashboard", icon: Terminal },
  { id: "02", name: "EXPLORER", href: "/explorer", icon: Database },
  { id: "03", name: "QUALITY", href: "/quality", icon: ShieldAlert },
  { id: "04", name: "STUDIO", href: "/studio", icon: Cpu },
  { id: "05", name: "COMPARISON", href: "/comparison", icon: BarChart2 },
  { id: "06", name: "REPORTS", href: "/reports", icon: FileCode },
];

export function Navigation() {
  const pathname = usePathname();
  const [activeDatasetName, setActiveDatasetName] = useState<string | null>(null);

  useEffect(() => {
    // Check if active dataset exists in session
    api.getActiveDataset()
      .then((res) => {
        if (res && res.metadata?.name) {
          setActiveDatasetName(`${res.metadata.name.toUpperCase()} (${res.total_rows}R)`);
        }
      })
      .catch(() => {
        // No active dataset loaded yet
      });
  }, [pathname]);

  return (
    <header className="sticky top-0 z-40 w-full bg-[#0C0C0E] border-b border-black text-white select-none">
      {/* Top Window Accent Strip */}
      <div className="bg-[#1864FF] text-white px-4 py-1 flex items-center justify-between text-[11px] font-mono font-bold tracking-wider uppercase border-b border-black">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-white inline-block border border-black shadow-[1px_1px_0px_0px_#000]" />
            <span className="w-2.5 h-2.5 bg-zinc-300 inline-block border border-black shadow-[1px_1px_0px_0px_#000]" />
            <span className="w-2.5 h-2.5 bg-zinc-400 inline-block border border-black shadow-[1px_1px_0px_0px_#000]" />
          </div>
          <span className="hidden sm:inline">SYS_VERSION: 2.4.0 // ML_EXPLORER_PLATFORM</span>
        </div>
        <div className="flex items-center gap-4">
          {activeDatasetName ? (
            <span className="bg-black text-[#9AE6B4] px-2 py-0.5 border border-black">
              ACTIVE_DS: {activeDatasetName}
            </span>
          ) : (
            <span className="text-blue-100 hidden sm:inline">
              [STATUS: READY FOR DATASET SELECTION]
            </span>
          )}
          <span className="hidden md:inline">PORT: 8000 (FASTAPI)</span>
        </div>
      </div>

      {/* Main Workstation Navbar */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 bg-white border border-black text-black font-black font-mono text-sm flex items-center justify-center shadow-[2px_2px_0px_0px_#000] group-hover:bg-[#1864FF] group-hover:text-white transition-colors">
              ODL
            </div>
            <div>
              <span className="font-mono font-black text-sm tracking-wider uppercase text-white flex items-center gap-1.5">
                OpenDataLens
                <span className="text-[10px] bg-[#1864FF] text-white px-1.5 py-0.2 border border-black font-mono font-bold">
                  PRO
                </span>
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-1 px-2.5 py-1.5 font-mono text-xs font-bold uppercase tracking-wider border transition-all ${
                    isActive
                      ? "bg-[#1864FF] text-white border-white shadow-[2px_2px_0px_0px_#FFF]"
                      : "bg-transparent text-zinc-300 border-transparent hover:border-zinc-700 hover:bg-zinc-900"
                  }`}
                >
                  <span className="text-zinc-400 text-[10px]">{item.id}.</span>
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right Station Controls */}
        <div className="flex items-center gap-2.5">
          <Link
            href="/studio"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1864FF] text-white font-mono text-xs font-bold uppercase tracking-wider border border-black shadow-[2px_2px_0px_0px_#000] hover:bg-[#2B73FF] transition-all"
          >
            <span>TRAIN MODEL</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
          <ThemeToggle />
        </div>
      </div>

      {/* Mobile Horizontal Scrollable Tab Bar */}
      <div className="lg:hidden flex overflow-x-auto px-3 py-1.5 border-t border-zinc-800 bg-[#121215] gap-1.5 text-xs font-mono scrollbar-none">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-1 px-2 py-1 shrink-0 font-bold uppercase tracking-wider border ${
                isActive
                  ? "bg-[#1864FF] text-white border-white"
                  : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white"
              }`}
            >
              <span>{item.id}</span>
              <span>{item.name}</span>
            </Link>
          );
        })}
      </div>
    </header>
  );
}
