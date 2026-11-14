"use client";

import React, { useState, useEffect } from "react";
import {
  Sparkles,
  Database,
  ShieldCheck,
  BarChart2,
  Cpu,
  ArrowRight,
  ArrowLeft,
  X,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";

const TOUR_STEPS = [
  {
    title: "Welcome to OpenDataLens",
    badge: "Multi-Format Ingestion",
    description:
      "Enterprise data intelligence platform supporting CSV, TSV, Excel (.xlsx/.xls), JSON, PDF tables, and SQL dumps up to 25MB, or instant curated benchmarks.",
    icon: Database,
    route: "/explorer",
    actionText: "Go to Explorer",
  },
  {
    title: "Interactive Data Cleaning & Undo/Redo",
    badge: "Zero-Risk Data Prep",
    description:
      "Transform messy columns with intelligent missing value imputation, deduplication, type casting, and outlier clipping. Revert or redo changes instantly with our memory-bounded checkpoint engine.",
    icon: ShieldCheck,
    route: "/quality",
    actionText: "Go to Quality Studio",
  },
  {
    title: "Interactive Multi-Chart Studio",
    badge: "Visual Analytics",
    description:
      "Generate dynamic Bar, Line, Area, Scatter, and Donut charts with custom aggregations (Sum, Mean, Count) and smart recommendations based on feature schemas.",
    icon: BarChart2,
    route: "/visualize",
    actionText: "Go to Visualizer",
  },
  {
    title: "Automated ML & Explainable AI",
    badge: "Strict Zero Data Leakage",
    description:
      "Train standard and ensemble models in parallel with strict preprocessor isolation on training folds. Inspect permutation feature importances, confusion matrices, and export production-ready .joblib binaries and multi-sheet Excel reports.",
    icon: Cpu,
    route: "/studio",
    actionText: "Go to ML Studio",
  },
];

export function OnboardingTour() {
  const [isVisible, setIsVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    try {
      const seen = localStorage.getItem("opendatalens_tour_seen");
      if (!seen) {
        setIsVisible(true);
      }
    } catch {
      // Ignore localStorage errors in private browsing
    }
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    try {
      localStorage.setItem("opendatalens_tour_seen", "true");
    } catch {}
  };

  if (!isVisible) return null;

  const step = TOUR_STEPS[currentStep];
  const Icon = step.icon;
  const isLast = currentStep === TOUR_STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-2xl space-y-6 relative">
        {/* Close Button */}
        <button
          type="button"
          onClick={handleClose}
          className="absolute top-5 right-5 p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Step Indicator & Badge */}
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-semibold">
            {step.badge}
          </span>
          <div className="flex space-x-1.5">
            {TOUR_STEPS.map((_, i) => (
              <span
                key={i}
                className={`w-2 h-2 rounded-full transition-all ${
                  i === currentStep
                    ? "bg-emerald-500 w-5"
                    : "bg-muted-foreground/30"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Icon & Title */}
        <div className="space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <Icon className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-foreground tracking-tight">
            {step.title}
          </h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {step.description}
          </p>
        </div>

        {/* Action Controls */}
        <div className="pt-4 border-t border-border flex items-center justify-between">
          <button
            type="button"
            onClick={handleClose}
            className="text-xs text-muted-foreground hover:text-foreground font-medium"
          >
            Skip Tour
          </button>

          <div className="flex items-center space-x-2">
            {currentStep > 0 && (
              <button
                type="button"
                onClick={() => setCurrentStep((prev) => prev - 1)}
                className="px-3 py-2 rounded-xl border border-border bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold flex items-center space-x-1 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
            )}

            {isLast ? (
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center space-x-1.5 shadow-md shadow-emerald-600/30 transition-all"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Get Started</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setCurrentStep((prev) => prev + 1)}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center space-x-1.5 shadow-md shadow-emerald-600/30 transition-all"
              >
                <span>Next</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
