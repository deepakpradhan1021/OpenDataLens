"use client";

import React, { useState } from "react";
import { Filter, LayoutGrid, List, Check, X, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { FilterState, RetroFilterDrawer } from "./retro-filter-drawer";

interface RetroDockProps {
  filters?: FilterState;
  onFilterChange?: (filters: FilterState) => void;
  viewMode?: "grid" | "list";
  onToggleView?: () => void;
  activeCount?: number;
}

export function RetroDock({
  filters = {
    task: [],
    domains: [],
    scalers: [],
    models: [],
    minRows: 0,
    maxRows: 50000,
    fastBaselinesOnly: false,
  },
  onFilterChange = () => {},
  viewMode = "grid",
  onToggleView = () => {},
  activeCount = 0,
}: RetroDockProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [showTooltip, setShowTooltip] = useState(true);

  const totalActive =
    filters.task.length +
    filters.domains.length +
    filters.scalers.length +
    filters.models.length +
    (filters.fastBaselinesOnly ? 1 : 0);

  return (
    <>
      <div className="fixed bottom-4 left-4 z-40 flex flex-col items-start select-none">
        {/* Electric Blue Speech Bubble Tooltip (Matches Image 3) */}
        {showTooltip && (
          <div className="retro-tooltip-blue p-3 max-w-xs mb-3.5 animate-in slide-in-from-bottom-2 duration-200">
            <div className="flex items-center justify-between gap-4 pb-1">
              <span className="font-bold text-sm text-white tracking-tight">
                Filter your search
              </span>
              <button
                onClick={() => setShowTooltip(false)}
                className="hover:opacity-75 text-white"
                aria-label="Close tooltip"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="font-mono text-[10px] uppercase tracking-wider text-blue-100 font-semibold leading-relaxed">
              DIVE DEEPER INTO OUR DATASETS, PREPROCESSING PIPELINES & MODEL BENCHMARKS
            </p>
          </div>
        )}

        {/* Floating Dock Toolbar (Matches Image 2 & 3) */}
        <div className="flex items-center bg-white text-black border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          {/* 1. Filter Results Button */}
          <button
            onClick={() => {
              setIsDrawerOpen(true);
              setShowTooltip(false);
            }}
            className={`flex items-center gap-1.5 px-3.5 py-2 font-mono text-xs font-bold uppercase tracking-wider border-r border-black transition-colors ${
              isDrawerOpen || totalActive > 0
                ? "bg-[#1864FF] text-white"
                : "bg-white text-black hover:bg-zinc-100"
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>FILTER RESULTS</span>
            {totalActive > 0 && (
              <span className="w-4 h-4 bg-white text-[#1864FF] text-[10px] font-black rounded-none flex items-center justify-center ml-0.5">
                {totalActive}
              </span>
            )}
            <span className="text-[11px] font-mono">∧</span>
          </button>

          {/* 2. Toggle View (Grid / List) */}
          <button
            onClick={onToggleView}
            className="flex items-center gap-1.5 px-3 py-2 font-mono text-xs font-bold uppercase tracking-wider border-r border-black hover:bg-zinc-100 text-black transition-colors"
          >
            {viewMode === "grid" ? (
              <LayoutGrid className="w-3.5 h-3.5" />
            ) : (
              <List className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">TOGGLE VIEW</span>
          </button>

          {/* 3. Fast Baselines / Switch */}
          <button
            onClick={() =>
              onFilterChange({
                ...filters,
                fastBaselinesOnly: !filters.fastBaselinesOnly,
              })
            }
            className="flex items-center gap-1.5 px-3 py-2 font-mono text-xs font-bold uppercase tracking-wider hover:bg-zinc-100 text-black transition-colors"
          >
            <div
              className={`w-3.5 h-3.5 border border-black flex items-center justify-center ${
                filters.fastBaselinesOnly ? "bg-[#1864FF] text-white" : "bg-white"
              }`}
            >
              {filters.fastBaselinesOnly && <Check className="w-2.5 h-2.5" />}
            </div>
            <span>FAST ONLY</span>
          </button>
        </div>
      </div>

      {/* Retro Mint Green Visit Resource Badge (Bottom Right, matching reference) */}
      <div className="fixed bottom-4 right-4 z-30 hidden sm:flex items-center gap-1.5">
        <div className="w-8 h-8 bg-zinc-900 border border-zinc-700 text-white font-mono font-bold text-xs flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
          W.
        </div>
        <Link
          href="/studio"
          className="flex items-center gap-1.5 px-3 py-2 bg-[#9AE6B4] text-[#064E3B] font-mono text-xs font-bold uppercase tracking-wider border border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-[#86EFAC] transition-all"
        >
          <span>Launch Studio</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Filter Modal / Drawer */}
      <RetroFilterDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        filters={filters}
        onFilterChange={onFilterChange}
        viewMode={viewMode}
        onToggleView={onToggleView}
      />
    </>
  );
}
