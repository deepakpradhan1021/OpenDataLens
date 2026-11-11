"use client";

import React, { useState } from "react";
import { Filter, LayoutGrid, List, Check, X, Sparkles, SlidersHorizontal } from "lucide-react";
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
  const [showTooltip, setShowTooltip] = useState(false);

  const totalActive =
    filters.task.length +
    filters.domains.length +
    filters.scalers.length +
    filters.models.length +
    (filters.fastBaselinesOnly ? 1 : 0);

  return (
    <>
      <div className="fixed bottom-4 sm:bottom-6 left-1/2 transform -translate-x-1/2 z-40 select-none max-w-[calc(100vw-1.5rem)] sm:max-w-max">
        {/* Floating Command Dock (Linear / Vercel Pill) */}
        <div className="flex items-center p-1 sm:p-1.5 rounded-full border border-zinc-700/70 bg-[#121217]/95 backdrop-blur-2xl shadow-[0_12px_40px_rgba(0,0,0,0.7)] space-x-1">
          {/* 1. Filter Button */}
          <button
            onClick={() => setIsDrawerOpen(true)}
            className={`flex items-center space-x-1.5 sm:space-x-2 px-3 sm:px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-150 ${
              isDrawerOpen || totalActive > 0
                ? "bg-blue-600 text-white shadow-sm shadow-blue-600/30 font-semibold"
                : "text-zinc-300 hover:text-white hover:bg-zinc-800/80"
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
            <span className="whitespace-nowrap">Filters</span>
            {totalActive > 0 && (
              <span className="w-4 h-4 rounded-full bg-white text-blue-600 text-[10px] font-mono font-bold flex items-center justify-center shrink-0">
                {totalActive}
              </span>
            )}
          </button>

          <div className="w-[1px] h-4 bg-zinc-700/60 shrink-0" />

          {/* 2. View Mode Toggle */}
          <button
            onClick={onToggleView}
            className="flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-medium text-zinc-300 hover:text-white hover:bg-zinc-800/80 transition-colors duration-150"
            title="Toggle between grid and list view"
          >
            {viewMode === "grid" ? (
              <>
                <LayoutGrid className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span className="hidden sm:inline whitespace-nowrap">Grid</span>
              </>
            ) : (
              <>
                <List className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span className="hidden sm:inline whitespace-nowrap">List</span>
              </>
            )}
          </button>

          <div className="w-[1px] h-4 bg-zinc-700/60 shrink-0" />

          {/* 3. Fast Baselines Only Toggle */}
          <button
            onClick={() =>
              onFilterChange({
                ...filters,
                fastBaselinesOnly: !filters.fastBaselinesOnly,
              })
            }
            className={`flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-150 ${
              filters.fastBaselinesOnly
                ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-medium"
                : "text-zinc-400 hover:text-white hover:bg-zinc-800/80"
            }`}
            title="Filter fast baseline models only"
          >
            <div
              className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center shrink-0 transition-colors ${
                filters.fastBaselinesOnly
                  ? "bg-emerald-500 border-emerald-400 text-black"
                  : "border-zinc-600"
              }`}
            >
              {filters.fastBaselinesOnly && <Check className="w-2.5 h-2.5 stroke-[3]" />}
            </div>
            <span className="hidden sm:inline whitespace-nowrap">Fast Baselines</span>
          </button>
        </div>
      </div>

      {/* Filter Modal Drawer */}
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
