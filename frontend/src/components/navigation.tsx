"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Layers,
  LayoutDashboard,
  Database,
  ShieldCheck,
  Cpu,
  BarChart2,
  FileCode,
  Activity,
  Menu,
  X,
  Sparkles,
  Trash2,
  RefreshCw,
  Loader2
} from "lucide-react";
import { api, getWorkspaceId, subscribeColdStart } from "@/lib/api";

const NAV_ITEMS = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Explorer", href: "/explorer", icon: Database },
  { name: "Quality", href: "/quality", icon: ShieldCheck },
  { name: "ML Studio", href: "/studio", icon: Cpu },
  { name: "Comparison", href: "/comparison", icon: BarChart2 },
  { name: "Data Drift", href: "/drift", icon: Activity },
  { name: "Reports", href: "/reports", icon: FileCode },
];

export function Navigation() {
  const pathname = usePathname();
  const [activeDatasetName, setActiveDatasetName] = useState<string | null>(null);
  const [apiHealth, setApiHealth] = useState<"connected" | "disconnected" | "checking" | "waking">("checking");
  const [coldStartNotice, setColdStartNotice] = useState<string | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string>("");
  const [clearing, setClearing] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const refreshActiveDataset = useCallback(() => {
    api.getActiveDataset()
      .then((res) => {
        if (res && res.metadata?.name) {
          setActiveDatasetName(`${res.metadata.name} (${res.total_rows.toLocaleString()} rows)`);
        } else {
          setActiveDatasetName(null);
        }
      })
      .catch(() => {
        setActiveDatasetName(null);
      });
  }, []);

  const checkConnection = useCallback(async () => {
    try {
      const res = await api.getHealth();
      if (res && (res.status === "ok" || res.status === "operational")) {
        setApiHealth("connected");
        setColdStartNotice(null);
        refreshActiveDataset();
        return;
      }
    } catch {
      // Backend is not immediately responsive -> start waking poll
      setApiHealth("waking");
      setColdStartNotice("Waking up the backend. This may take up to 50 seconds.");

      const isAwake = await api.verifyHealthWithWakeup(75000, 3000);
      if (isAwake) {
        setApiHealth("connected");
        setColdStartNotice(null);
        refreshActiveDataset();
      } else {
        setApiHealth("disconnected");
        setColdStartNotice(null);
      }
    }
  }, [refreshActiveDataset]);

  useEffect(() => {
    // Check Workspace ID
    setWorkspaceId(getWorkspaceId());

    // Subscribe to global cold-start state
    const unsubscribe = subscribeColdStart((status) => {
      if (status.isWaking) {
        setApiHealth("waking");
        setColdStartNotice(status.message || "Waking up the backend. This may take up to 50 seconds.");
      } else if (status.isOnline) {
        setApiHealth("connected");
        setColdStartNotice(null);
      }
    });

    checkConnection();

    return () => {
      unsubscribe();
    };
  }, [pathname, checkConnection]);

  const handleClearWorkspace = async () => {
    if (!confirm("Are you sure you want to clear this workspace? All active datasets, models, and evaluations will be reset.")) {
      return;
    }
    setClearing(true);
    try {
      await api.clearWorkspace();
      setActiveDatasetName(null);
      setWorkspaceId(getWorkspaceId());
      window.location.reload();
    } catch {
      // Reload anyway to reset local storage
      window.location.reload();
    } finally {
      setClearing(false);
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-zinc-800/80 bg-[#09090B]/85 backdrop-blur-xl transition-all duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-5 xl:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo & Nav */}
        <div className="flex items-center space-x-2 xl:space-x-6">
          <Link href="/" className="flex items-center space-x-2.5 group shrink-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 via-indigo-600 to-violet-600 flex items-center justify-center shadow-sm shadow-blue-500/25 group-hover:scale-105 transition-transform duration-200">
              <Layers className="w-4 h-4 text-white" />
            </div>
            <div className="flex items-center space-x-2">
              <span className="font-semibold text-base tracking-tight text-zinc-100 group-hover:text-white transition-colors">
                OpenDataLens
              </span>
              <span className="text-[10px] uppercase font-mono font-medium px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 tracking-wider">
                BETA
              </span>
            </div>
          </Link>

          {/* Desktop Nav Items */}
          <nav className="hidden lg:flex items-center space-x-0.5 xl:space-x-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center space-x-1 px-2 xl:px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-all duration-150 ${
                    isActive
                      ? "bg-zinc-800/90 text-white shadow-sm border border-zinc-700/60 font-semibold"
                      : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/40"
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-blue-400" : "text-zinc-500"}`} />
                  <span className="whitespace-nowrap">{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right Station Controls */}
        <div className="hidden lg:flex items-center space-x-1.5 xl:space-x-2.5 shrink-0">
          {/* Real Health Badge */}
          <button
            onClick={() => {
              if (apiHealth === "disconnected") {
                setApiHealth("waking");
                checkConnection();
              }
            }}
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono border whitespace-nowrap shrink-0 transition-colors ${
              apiHealth === "connected"
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 cursor-default"
                : apiHealth === "waking"
                ? "bg-amber-500/10 border-amber-500/20 text-amber-300 cursor-wait"
                : apiHealth === "checking"
                ? "bg-amber-500/10 border-amber-500/20 text-amber-400 cursor-wait"
                : "bg-rose-500/10 border-rose-500/20 text-rose-400 hover:bg-rose-500/20 cursor-pointer"
            }`}
            title={
              apiHealth === "connected"
                ? "Backend API is online and operational"
                : apiHealth === "waking"
                ? "Waking up the backend. This may take up to 50 seconds."
                : apiHealth === "checking"
                ? "Checking API health..."
                : "API Offline. Click to retry wake-up connection."
            }
          >
            {apiHealth === "waking" ? (
              <Loader2 className="w-2.5 h-2.5 text-amber-400 animate-spin" />
            ) : (
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  apiHealth === "connected"
                    ? "bg-emerald-400 animate-pulse"
                    : apiHealth === "checking"
                    ? "bg-amber-400 animate-ping"
                    : "bg-rose-400"
                }`}
              />
            )}
            <span className="whitespace-nowrap">
              {apiHealth === "connected"
                ? "API Online"
                : apiHealth === "waking"
                ? "Waking Backend..."
                : apiHealth === "checking"
                ? "Checking..."
                : "API Offline (Retry)"}
            </span>
          </button>

          {/* Active Dataset Pill */}
          {activeDatasetName && (
            <Link
              href="/explorer"
              className="hidden 2xl:flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-mono whitespace-nowrap shrink-0 transition-colors hover:bg-blue-500/15"
              title="Click to view active dataset"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              <span className="max-w-[130px] truncate">{activeDatasetName}</span>
            </Link>
          )}

          {/* Clear Workspace Button */}
          <button
            onClick={handleClearWorkspace}
            disabled={clearing}
            className="flex items-center space-x-1 px-2.5 py-1 rounded-lg border border-zinc-800 hover:border-zinc-700 bg-zinc-900/60 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 text-xs font-medium whitespace-nowrap shrink-0 transition-colors"
            title="Clear current workspace and start fresh"
          >
            <Trash2 className="w-3 h-3 text-zinc-500" />
            <span>Reset</span>
          </button>

          <Link
            href="/studio"
            className="hidden xl:inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-sm shadow-blue-600/30 whitespace-nowrap shrink-0 transition-all duration-150 active:scale-95"
          >
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span className="whitespace-nowrap">Launch Studio</span>
          </Link>
        </div>

        {/* Mobile Menu Button */}
        <div className="flex lg:hidden items-center space-x-2">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg bg-zinc-800/60 border border-zinc-700 text-zinc-300 hover:text-white"
            aria-label="Toggle Menu"
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-zinc-800 bg-[#09090B] px-4 py-3 space-y-2 animate-in slide-in-from-top-2 duration-150">
          <div className="flex items-center justify-between pb-1 text-xs">
            <div className="flex items-center space-x-1.5">
              {apiHealth === "waking" ? (
                <Loader2 className="w-2.5 h-2.5 text-amber-400 animate-spin" />
              ) : (
                <span
                  className={`w-2 h-2 rounded-full ${
                    apiHealth === "connected"
                      ? "bg-emerald-400"
                      : apiHealth === "checking"
                      ? "bg-amber-400 animate-ping"
                      : "bg-rose-400"
                  }`}
                />
              )}
              <span className="text-zinc-400 font-mono">
                {apiHealth === "connected"
                  ? "API Operational"
                  : apiHealth === "waking"
                  ? "Waking Backend (~50s)..."
                  : apiHealth === "checking"
                  ? "Checking Health..."
                  : "API Disconnected"}
              </span>
              {apiHealth === "disconnected" && (
                <button
                  onClick={() => checkConnection()}
                  className="text-[10px] text-blue-400 underline ml-1"
                >
                  Retry
                </button>
              )}
            </div>
            <button
              onClick={handleClearWorkspace}
              className="text-xs text-zinc-400 hover:text-rose-400 flex items-center space-x-1"
            >
              <Trash2 className="w-3 h-3" />
              <span>Clear Workspace</span>
            </button>
          </div>

          {activeDatasetName && (
            <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs font-mono text-emerald-400 flex items-center space-x-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="truncate">Active: {activeDatasetName}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-1.5 pt-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center space-x-2 p-2.5 rounded-lg text-xs font-medium transition-colors ${
                    isActive
                      ? "bg-blue-600/15 text-blue-400 border border-blue-500/20 font-semibold"
                      : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </div>

          <div className="pt-2">
            <Link
              href="/studio"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full flex items-center justify-center space-x-1.5 p-2 rounded-lg bg-blue-600 text-white font-semibold text-xs shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Launch ML Studio</span>
            </Link>
          </div>
        </div>
      )}

      {/* Render Free-Tier Cold Start Banner */}
      {coldStartNotice && (
        <div className="bg-amber-500/10 border-t border-b border-amber-500/20 px-4 py-1.5 text-[11px] sm:text-xs font-mono text-amber-300 flex items-center justify-center space-x-2 animate-in fade-in duration-200">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400 shrink-0" />
          <span className="font-medium">{coldStartNotice}</span>
          <span className="text-zinc-500 hidden md:inline">• Render free-tier instances spin down after inactivity</span>
        </div>
      )}
    </header>
  );
}
