"use client";

import React, { useState } from "react";
import { Filter, SlidersHorizontal, ChevronDown, ChevronUp, X, Check } from "lucide-react";

export interface FilterState {
  task: string[];
  domains: string[];
  scalers: string[];
  models: string[];
  minRows: number;
  maxRows: number;
  fastBaselinesOnly: boolean;
}

interface RetroFilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  viewMode: "grid" | "list";
  onToggleView: () => void;
}

const AVAILABLE_TASKS = ["CLASSIFICATION", "REGRESSION", "TABULAR", "NLP", "BENCHMARK"];
const AVAILABLE_DOMAINS = [
  "HEALTHCARE",
  "FINTECH",
  "REAL ESTATE",
  "ROBOTICS",
  "CLIMATE TECH",
  "MEDIA",
  "SPACE",
  "CONSUMER",
];
const AVAILABLE_SCALERS = [
  "STANDARD SCALER",
  "ROBUST SCALER",
  "MIN-MAX",
  "ONE-HOT ENCODER",
  "MEDIAN IMPUTER",
];
const AVAILABLE_MODELS = [
  "Random Forest",
  "Logistic / Ridge",
  "Gradient Boosting",
  "K-Nearest Neighbors",
  "Support Vector Machine",
];

export function RetroFilterDrawer({
  isOpen,
  onClose,
  filters,
  onFilterChange,
  viewMode,
  onToggleView,
}: RetroFilterDrawerProps) {
  const [openSections, setOpenSections] = useState({
    rows: true,
    tasks: true,
    domains: true,
    scalers: true,
    models: true,
  });

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const toggleItem = (listName: "task" | "domains" | "scalers" | "models", item: string) => {
    const list = filters[listName];
    const exists = list.includes(item);
    const updated = exists ? list.filter((i) => i !== item) : [...list, item];
    onFilterChange({ ...filters, [listName]: updated });
  };

  const clearAll = () => {
    onFilterChange({
      task: [],
      domains: [],
      scalers: [],
      models: [],
      minRows: 0,
      maxRows: 50000,
      fastBaselinesOnly: false,
    });
  };

  const totalActive =
    filters.task.length +
    filters.domains.length +
    filters.scalers.length +
    filters.models.length +
    (filters.fastBaselinesOnly ? 1 : 0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-start p-2 sm:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-lg max-h-[90vh] flex flex-col retro-window-light rounded-none border border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
        {/* Window Chrome Header */}
        <div className="flex items-center justify-between border-b border-black bg-white select-none">
          <div className="flex items-center">
            {/* Active Tab */}
            <div className="flex items-center gap-1.5 px-3 py-2 bg-[#1864FF] text-white font-mono text-xs font-bold uppercase tracking-wider">
              <Filter className="w-3.5 h-3.5 fill-white" />
              <span>FILTER RESULTS</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </div>

            {/* Toggle View Tab */}
            <button
              onClick={onToggleView}
              className="px-3 py-2 border-r border-black font-mono text-xs font-bold uppercase tracking-wider hover:bg-zinc-100 flex items-center gap-1 text-black"
            >
              <span>TOGGLE VIEW ({viewMode.toUpperCase()})</span>
            </button>

            {/* Quick Fast Switch */}
            <button
              onClick={() =>
                onFilterChange({
                  ...filters,
                  fastBaselinesOnly: !filters.fastBaselinesOnly,
                })
              }
              className="hidden sm:flex items-center gap-1.5 px-3 py-2 font-mono text-xs font-bold uppercase tracking-wider hover:bg-zinc-100 text-black"
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

          {/* Close button */}
          <button
            onClick={onClose}
            className="p-2 border-l border-black hover:bg-red-500 hover:text-white transition-colors"
          >
            <X className="w-4 h-4 text-black" />
          </button>
        </div>

        {/* Scrollable Accordion Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#EDEEF0] text-black">
          {/* 1. Dataset Rows / Size Slider (Years slider in reference) */}
          <div className="border border-black bg-white p-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            <button
              onClick={() => toggleSection("rows")}
              className="w-full flex items-center justify-between text-left font-mono text-xs font-bold uppercase tracking-wider pb-2 border-b border-zinc-200"
            >
              <span>DATASET SAMPLE ROWS</span>
              {openSections.rows ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {openSections.rows && (
              <div className="pt-3 space-y-2">
                <div className="flex justify-between font-mono text-[11px] text-zinc-600 font-bold">
                  <span>{filters.minRows.toLocaleString()} ROWS</span>
                  <span className="text-[#1864FF]">{filters.maxRows.toLocaleString()} MAX ROWS</span>
                </div>
                <input
                  type="range"
                  min="100"
                  max="50000"
                  step="500"
                  value={filters.maxRows}
                  onChange={(e) =>
                    onFilterChange({ ...filters, maxRows: Number(e.target.value) })
                  }
                  className="w-full h-2 bg-zinc-200 rounded-none appearance-none cursor-pointer accent-[#1864FF]"
                />
              </div>
            )}
          </div>

          {/* 2. Task Categories (Industries in reference) */}
          <div className="border border-black bg-white p-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            <button
              onClick={() => toggleSection("tasks")}
              className="w-full flex items-center justify-between text-left font-mono text-xs font-bold uppercase tracking-wider pb-2 border-b border-zinc-200"
            >
              <div className="flex items-center gap-1.5">
                <span>TASK CATEGORIES</span>
                <span className="w-2 h-2 bg-[#1864FF] inline-block" />
              </div>
              {openSections.tasks ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {openSections.tasks && (
              <div className="pt-3 flex flex-wrap gap-1.5">
                {AVAILABLE_TASKS.map((task) => {
                  const isActive = filters.task.includes(task);
                  return (
                    <button
                      key={task}
                      onClick={() => toggleItem("task", task)}
                      className={`retro-pill ${isActive ? "active" : ""}`}
                    >
                      <span>{task}</span>
                      {isActive && <X className="w-3 h-3 ml-0.5" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 3. Domains / Industries */}
          <div className="border border-black bg-white p-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            <button
              onClick={() => toggleSection("domains")}
              className="w-full flex items-center justify-between text-left font-mono text-xs font-bold uppercase tracking-wider pb-2 border-b border-zinc-200"
            >
              <div className="flex items-center gap-1.5">
                <span>DATA DOMAINS</span>
                <span className="w-2 h-2 bg-[#1864FF] inline-block" />
              </div>
              {openSections.domains ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {openSections.domains && (
              <div className="pt-3 flex flex-wrap gap-1.5">
                {AVAILABLE_DOMAINS.map((domain) => {
                  const isActive = filters.domains.includes(domain);
                  return (
                    <button
                      key={domain}
                      onClick={() => toggleItem("domains", domain)}
                      className={`retro-pill ${isActive ? "active" : ""}`}
                    >
                      <span>{domain}</span>
                      {isActive && <X className="w-3 h-3 ml-0.5" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 4. Preprocessing & Scalers (Team Members in reference) */}
          <div className="border border-black bg-white p-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            <button
              onClick={() => toggleSection("scalers")}
              className="w-full flex items-center justify-between text-left font-mono text-xs font-bold uppercase tracking-wider pb-2 border-b border-zinc-200"
            >
              <div className="flex items-center gap-1.5">
                <span>PREPROCESSING & SCALERS</span>
                <span className="w-2 h-2 bg-[#1864FF] inline-block" />
              </div>
              {openSections.scalers ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {openSections.scalers && (
              <div className="pt-3 flex flex-wrap gap-1.5">
                {AVAILABLE_SCALERS.map((scaler) => {
                  const isActive = filters.scalers.includes(scaler);
                  return (
                    <button
                      key={scaler}
                      onClick={() => toggleItem("scalers", scaler)}
                      className={`retro-pill ${isActive ? "active" : ""}`}
                    >
                      <span>{scaler}</span>
                      {isActive && <X className="w-3 h-3 ml-0.5" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 5. ML Models */}
          <div className="border border-black bg-white p-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            <button
              onClick={() => toggleSection("models")}
              className="w-full flex items-center justify-between text-left font-mono text-xs font-bold uppercase tracking-wider pb-2 border-b border-zinc-200"
            >
              <span>MODEL ARCHITECTURES</span>
              {openSections.models ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {openSections.models && (
              <div className="pt-3 space-y-2">
                {AVAILABLE_MODELS.map((m) => {
                  const checked = filters.models.includes(m);
                  return (
                    <label
                      key={m}
                      onClick={() => toggleItem("models", m)}
                      className="flex items-center gap-2 text-xs font-mono font-bold cursor-pointer select-none hover:text-[#1864FF]"
                    >
                      <div
                        className={`w-4 h-4 border border-black flex items-center justify-center ${
                          checked ? "bg-[#1864FF] text-white" : "bg-white"
                        }`}
                      >
                        {checked && <Check className="w-3 h-3" />}
                      </div>
                      <span>{m}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Bottom Action Footer */}
        <div className="flex border-t border-black bg-white font-mono text-xs font-bold uppercase tracking-wider">
          <button
            onClick={clearAll}
            className="w-1/2 py-3 text-center border-r border-black hover:bg-zinc-100 text-zinc-700 flex items-center justify-center gap-1.5"
          >
            <span>CLEAR FILTERS</span>
            <X className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onClose}
            className="w-1/2 py-3 text-center bg-[#1864FF] text-white hover:bg-[#0B4FD9] flex items-center justify-center gap-1.5"
          >
            <span>APPLY FILTERS ({totalActive})</span>
          </button>
        </div>
      </div>
    </div>
  );
}
