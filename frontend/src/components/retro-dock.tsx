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
      <div className="fixed bottom-5 left-1/2 transform -translate-x-1/2 z-40 select-none">
        {/* Floating Command Dock (Linear / Vercel Pill) */}
        <div className="flex items-center p-1.5 rounded-full border border-zinc-700/60 bg-zinc-900/90 backdrop-blur-xl shadow-2xl shadow-black/80 space-x-1">
          {/* 1. Filter Button */}
          <button
            onClick={() => setIsDrawerOpen(true)}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${
              isDrawerOpen || totalActive > 0
                ? "bg-blue-600 text-white shadow-sm shadow-blue-600/30 font-semibold"
                : "text-zinc-300 hover:text-white hover:bg-zinc-800/80"
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Filters</span>
            {totalActive > 0 && (
              <span className="w-4 h-4 rounded-full bg-white text-blue-600 text-[10px] font-bold flex items-center justify-center">
                {totalActive}
              </span>
            )}
          </button>

          <div className="w-[1px] h-4 bg-zinc-700/60" />

          {/* 2. View Mode Toggle */}
          <button
            onClick={onToggleView}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-zinc-300 hover:text-white hover:bg-zinc-800/80 transition-colors"
          >
            {viewMode === "grid" ? (
              <>
                <LayoutGrid className="w-3.5 h-3.5 text-blue-400" />
                <span className="hidden sm:inline">Grid</span>
              </>
            ) : (
              <>
                <List className="w-3.5 h-3.5 text-blue-400" />
                <span className="hidden sm:inline">List</span>
              </>
            )}
          </button>

          <div className="w-[1px] h-4 bg-zinc-700/60" />

          {/* 3. Fast Baselines Only Toggle */}
          <button
            onClick={() =>
              onFilterChange({
                ...filters,
                fastBaselinesOnly: !filters.fastBaselinesOnly,
              })
            }
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              filters.fastBaselinesOnly
                ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                : "text-zinc-400 hover:text-white hover:bg-zinc-800/80"
            }`}
          >
            <div
              className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center transition-colors ${
                filters.fastBaselinesOnly
                  ? "bg-emerald-500 border-emerald-400 text-black"
                  : "border-zinc-600"
              }`}
            >
              {filters.fastBaselinesOnly && <Check className="w-2.5 h-2.5 stroke-[3]" />}
            </div>
            <span className="hidden sm:inline">Fast Baselines</span>
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
