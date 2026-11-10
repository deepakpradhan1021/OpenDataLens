"use client";

import React, { useState } from "react";
import { Filter, SlidersHorizontal, ChevronDown, ChevronUp, X, Check, RotateCcw } from "lucide-react";

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

const AVAILABLE_TASKS = ["Classification", "Regression", "Tabular", "NLP", "Benchmark"];
const AVAILABLE_DOMAINS = [
  "Healthcare",
  "Fintech",
  "Real Estate",
  "Robotics",
  "Climate Tech",
  "Media",
  "Space",
  "Consumer",
];
const AVAILABLE_SCALERS = [
  "Standard Scaler",
  "Robust Scaler",
  "Min-Max Scaler",
  "One-Hot Encoder",
  "Median Imputer",
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
    const exists = list.some((i) => i.toLowerCase() === item.toLowerCase());
    const updated = exists
      ? list.filter((i) => i.toLowerCase() !== item.toLowerCase())
      : [...list, item];
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-xl max-h-[85vh] flex flex-col rounded-2xl border border-zinc-800 bg-[#0E0E12] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800/80 bg-zinc-900/40">
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
              <Filter className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-white">Filter Workspace Datasets</h3>
              <p className="text-[11px] text-zinc-400">Refine by task type, domain, size and models</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {totalActive > 0 && (
              <button
                onClick={clearAll}
                className="text-xs text-zinc-400 hover:text-white px-2 py-1 rounded-md hover:bg-zinc-800/60 transition-colors flex items-center space-x-1"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* 1. Dataset Sample Rows Range Slider */}
          <div className="p-4 rounded-xl border border-zinc-800/80 bg-zinc-900/30 space-y-3">
            <button
              onClick={() => toggleSection("rows")}
              className="w-full flex items-center justify-between text-left text-xs font-semibold text-zinc-200"
            >
              <span>Sample Rows Range</span>
              {openSections.rows ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
            </button>

            {openSections.rows && (
              <div className="space-y-2 pt-1">
                <div className="flex justify-between text-xs font-mono text-zinc-400">
                  <span>{filters.minRows.toLocaleString()} rows</span>
                  <span className="text-blue-400 font-medium">Up to {filters.maxRows.toLocaleString()} rows</span>
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
                  className="w-full h-1.5 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-blue-500"
                />
              </div>
            )}
          </div>

          {/* 2. Task Categories */}
          <div className="p-4 rounded-xl border border-zinc-800/80 bg-zinc-900/30 space-y-3">
            <button
              onClick={() => toggleSection("tasks")}
              className="w-full flex items-center justify-between text-left text-xs font-semibold text-zinc-200"
            >
              <span>Task Categories</span>
              {openSections.tasks ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
            </button>

            {openSections.tasks && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {AVAILABLE_TASKS.map((task) => {
                  const isActive = filters.task.some((t) => t.toLowerCase() === task.toLowerCase());
                  return (
                    <button
                      key={task}
                      onClick={() => toggleItem("task", task)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 flex items-center space-x-1.5 ${
                        isActive
                          ? "bg-blue-600 text-white shadow-sm shadow-blue-600/30 border border-blue-500"
                          : "bg-zinc-800/60 text-zinc-300 hover:bg-zinc-800 border border-zinc-700/50"
                      }`}
                    >
                      <span>{task}</span>
                      {isActive && <X className="w-3 h-3" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 3. Domains */}
          <div className="p-4 rounded-xl border border-zinc-800/80 bg-zinc-900/30 space-y-3">
            <button
              onClick={() => toggleSection("domains")}
              className="w-full flex items-center justify-between text-left text-xs font-semibold text-zinc-200"
            >
              <span>Domains &amp; Industries</span>
              {openSections.domains ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
            </button>

            {openSections.domains && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {AVAILABLE_DOMAINS.map((domain) => {
                  const isActive = filters.domains.some((d) => d.toLowerCase() === domain.toLowerCase());
                  return (
                    <button
                      key={domain}
                      onClick={() => toggleItem("domains", domain)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 flex items-center space-x-1.5 ${
                        isActive
                          ? "bg-blue-600 text-white shadow-sm shadow-blue-600/30 border border-blue-500"
                          : "bg-zinc-800/60 text-zinc-300 hover:bg-zinc-800 border border-zinc-700/50"
                      }`}
                    >
                      <span>{domain}</span>
                      {isActive && <X className="w-3 h-3" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 4. Preprocessing & Scalers */}
          <div className="p-4 rounded-xl border border-zinc-800/80 bg-zinc-900/30 space-y-3">
            <button
              onClick={() => toggleSection("scalers")}
              className="w-full flex items-center justify-between text-left text-xs font-semibold text-zinc-200"
            >
              <span>Preprocessing Scalers</span>
              {openSections.scalers ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
            </button>

            {openSections.scalers && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {AVAILABLE_SCALERS.map((scaler) => {
                  const isActive = filters.scalers.some((s) => s.toLowerCase() === scaler.toLowerCase());
                  return (
                    <button
                      key={scaler}
                      onClick={() => toggleItem("scalers", scaler)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 flex items-center space-x-1.5 ${
                        isActive
                          ? "bg-blue-600 text-white shadow-sm shadow-blue-600/30 border border-blue-500"
                          : "bg-zinc-800/60 text-zinc-300 hover:bg-zinc-800 border border-zinc-700/50"
                      }`}
                    >
                      <span>{scaler}</span>
                      {isActive && <X className="w-3 h-3" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 5. ML Models */}
          <div className="p-4 rounded-xl border border-zinc-800/80 bg-zinc-900/30 space-y-3">
            <button
              onClick={() => toggleSection("models")}
              className="w-full flex items-center justify-between text-left text-xs font-semibold text-zinc-200"
            >
              <span>Model Architectures</span>
              {openSections.models ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
            </button>

            {openSections.models && (
              <div className="space-y-2 pt-1">
                {AVAILABLE_MODELS.map((m) => {
                  const checked = filters.models.includes(m);
                  return (
                    <label
                      key={m}
                      onClick={() => toggleItem("models", m)}
                      className="flex items-center space-x-2.5 text-xs text-zinc-300 cursor-pointer select-none hover:text-white"
                    >
                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                          checked
                            ? "bg-blue-600 border-blue-500 text-white"
                            : "bg-zinc-800 border-zinc-700"
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

        {/* Footer Actions */}
        <div className="p-4 border-t border-zinc-800/80 bg-zinc-900/40 flex items-center justify-between">
          <button
            onClick={clearAll}
            className="text-xs text-zinc-400 hover:text-white font-medium px-3 py-2 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            Clear all
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-sm shadow-blue-600/30 transition-all"
          >
            Apply Filters ({totalActive})
          </button>
        </div>
      </div>
    </div>
  );
}
