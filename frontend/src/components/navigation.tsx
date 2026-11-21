"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Layers,
  LayoutDashboard,
  Database,
  PieChart,
  ShieldCheck,
  FileCode,
  Cpu,
  BarChart2,
  Activity,
  ChevronDown,
  SlidersHorizontal,
  Menu,
  X,
  Sparkles,
  Trash2,
  FolderArchive,
  Shield,
} from "lucide-react";
import { Ring } from "@/components/loading-ui/ring";
import { api, getWorkspaceId, subscribeColdStart } from "@/lib/api";
import { ThemeToggle } from "./theme-toggle";
import { SaveStatusIndicator } from "./save-status-indicator";
import { WorkspaceModal } from "./workspace-modal";

const PRIMARY_NAV_ITEMS = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Explorer", href: "/explorer", icon: Database },
  { name: "Visualize", href: "/visualize", icon: PieChart },
  { name: "Quality", href: "/quality", icon: ShieldCheck },
  { name: "Reports", href: "/reports", icon: FileCode },
];

const MORE_NAV_ITEMS = [
  { name: "ML Studio", href: "/studio", icon: Cpu, desc: "AutoML & pipelines" },
  { name: "Comparison", href: "/comparison", icon: BarChart2, desc: "Model benchmark" },
  { name: "Data Drift", href: "/drift", icon: Activity, desc: "Drift monitor" },
];

export function Navigation() {
  const pathname = usePathname();
  const [activeDatasetName, setActiveDatasetName] = useState<string | null>(null);
  const [apiHealth, setApiHealth] = useState<"connected" | "disconnected" | "checking" | "waking">("checking");
  const [coldStartNotice, setColdStartNotice] = useState<string | null>(null);
  const [, setWorkspaceId] = useState<string>("");
  const [clearing, setClearing] = useState(false);
  const [moreDropdownOpen, setMoreDropdownOpen] = useState(false);
  const [optionsDropdownOpen, setOptionsDropdownOpen] = useState(false);
  const [datasetDropdownOpen, setDatasetDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [workspaceModalOpen, setWorkspaceModalOpen] = useState(false);

  const moreRef = useRef<HTMLDivElement>(null);
  const optionsRef = useRef<HTMLDivElement>(null);
  const datasetRef = useRef<HTMLDivElement>(null);

  const isMoreActive = MORE_NAV_ITEMS.some((item) => pathname === item.href);

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
    // Check and initialize server-verified Workspace ID
    setWorkspaceId(getWorkspaceId());
    api.initializeSession().then((token) => {
      if (token) setWorkspaceId(token);
    });

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

  // Close all menus on pathname route change
  useEffect(() => {
    setMoreDropdownOpen(false);
    setOptionsDropdownOpen(false);
    setDatasetDropdownOpen(false);
    setMobileMenuOpen(false);
  }, [pathname]);

  // Close dropdowns on outside click or Escape key
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (moreRef.current && !moreRef.current.contains(target)) {
        setMoreDropdownOpen(false);
      }
      if (optionsRef.current && !optionsRef.current.contains(target)) {
        setOptionsDropdownOpen(false);
      }
      if (datasetRef.current && !datasetRef.current.contains(target)) {
        setDatasetDropdownOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMoreDropdownOpen(false);
        setOptionsDropdownOpen(false);
        setDatasetDropdownOpen(false);
        setMobileMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

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
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/85 backdrop-blur-xl transition-all duration-200">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-4 lg:px-6 xl:px-8 h-16 flex items-center justify-between gap-1.5 md:gap-2">
        {/* Left Section: Brand Logo & Beta */}
        <div className="flex items-center gap-2 group shrink-0">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 via-teal-600 to-emerald-700 flex items-center justify-center shadow-sm shadow-emerald-500/20 group-hover:scale-105 transition-transform duration-200 shrink-0">
              <Layers className="w-4 h-4 text-white" />
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="font-semibold text-sm sm:text-base tracking-tight text-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors whitespace-nowrap">
                OpenDataLens
              </span>
              <span className="text-[10px] uppercase font-mono font-semibold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 tracking-wider">
                BETA
              </span>
            </div>
          </Link>
        </div>

        {/* Center Section: Primary Navigation & More Dropdown (Tablet & Desktop) */}
        <nav className="hidden md:flex items-center gap-0.5 lg:gap-1 xl:gap-1.5">
          {PRIMARY_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-1 lg:gap-1.5 px-1.5 py-1.5 lg:px-2.5 rounded-lg text-[11px] lg:text-xs font-medium whitespace-nowrap transition-all duration-150 ${
                  isActive
                    ? "bg-emerald-500/10 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 shadow-sm border border-emerald-500/30 font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60 border border-transparent"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`} />
                <span>{item.name}</span>
              </Link>
            );
          })}

          {/* More Dropdown */}
          <div className="relative" ref={moreRef}>
            <button
              type="button"
              onClick={() => setMoreDropdownOpen((prev) => !prev)}
              aria-expanded={moreDropdownOpen}
              aria-haspopup="true"
              className={`flex items-center gap-1 px-1.5 py-1.5 lg:px-2.5 rounded-lg text-[11px] lg:text-xs font-medium whitespace-nowrap transition-all duration-150 ${
                isMoreActive
                  ? "bg-emerald-500/10 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 shadow-sm border border-emerald-500/30 font-semibold"
                  : moreDropdownOpen
                  ? "bg-muted text-foreground border border-border"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60 border border-transparent"
              }`}
            >
              <span>More</span>
              <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform duration-150 ${moreDropdownOpen ? "rotate-180" : ""}`} />
            </button>

            {moreDropdownOpen && (
              <div className="absolute top-full left-0 mt-1.5 w-56 rounded-xl border border-border bg-popover/95 backdrop-blur-xl p-1.5 shadow-xl animate-in fade-in zoom-in-95 duration-150 z-50">
                {MORE_NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMoreDropdownOpen(false)}
                      className={`flex items-start gap-2.5 px-3 py-2 rounded-lg text-xs transition-colors ${
                        isActive
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/70"
                      }`}
                    >
                      <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${isActive ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`} />
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">{item.name}</span>
                        <span className="text-[10px] text-muted-foreground">{item.desc}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </nav>

        {/* Right Section: Utility Actions (Tablet & Desktop) */}
        <div className="hidden md:flex items-center gap-1.5 lg:gap-2 shrink-0">
          {/* Active Dataset Dropdown or Subtle Pill */}
          {activeDatasetName ? (
            <div className="relative" ref={datasetRef}>
              <button
                type="button"
                onClick={() => setDatasetDropdownOpen((prev) => !prev)}
                aria-expanded={datasetDropdownOpen}
                aria-haspopup="true"
                className="flex items-center gap-1.5 px-2 lg:px-2.5 py-1 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-mono whitespace-nowrap shrink-0 transition-colors focus:outline-none"
                title="Active dataset details and quick navigation"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <span className="max-w-[80px] lg:max-w-[130px] xl:max-w-[160px] truncate">{activeDatasetName}</span>
                <ChevronDown className={`w-3 h-3 text-emerald-600 dark:text-emerald-400 transition-transform duration-150 ${datasetDropdownOpen ? "rotate-180" : ""}`} />
              </button>

              {datasetDropdownOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-64 rounded-xl border border-border bg-popover/95 backdrop-blur-xl p-3 shadow-xl animate-in fade-in zoom-in-95 duration-150 z-50">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/60">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Active Dataset</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">Mounted</span>
                  </div>
                  <p className="text-xs font-medium text-foreground break-words mb-2.5">{activeDatasetName}</p>
                  <div className="space-y-1">
                    <Link
                      href="/explorer"
                      onClick={() => setDatasetDropdownOpen(false)}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors"
                    >
                      <Database className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>View in Explorer</span>
                    </Link>
                    <Link
                      href="/quality"
                      onClick={() => setDatasetDropdownOpen(false)}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>Quality Audit</span>
                    </Link>
                    <Link
                      href="/visualize"
                      onClick={() => setDatasetDropdownOpen(false)}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors"
                    >
                      <PieChart className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>Visual Analytics</span>
                    </Link>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/explorer"
              className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/40 hover:bg-muted border border-border/60 text-muted-foreground hover:text-foreground text-xs font-mono whitespace-nowrap transition-colors"
              title="No dataset mounted. Click to discover and mount a dataset."
            >
              <Database className="w-3 h-3 text-muted-foreground" />
              <span>No dataset active</span>
            </Link>
          )}

          {/* Theme Toggle */}
          <ThemeToggle />

          {/* More Options Menu */}
          <div className="relative" ref={optionsRef}>
            <button
              type="button"
              onClick={() => setOptionsDropdownOpen((prev) => !prev)}
              aria-expanded={optionsDropdownOpen}
              aria-haspopup="true"
              aria-label="Options and system status"
              className={`p-2 rounded-lg border transition-colors ${
                optionsDropdownOpen
                  ? "bg-muted text-foreground border-border"
                  : "border-border hover:border-border/80 bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground"
              }`}
              title="Options, system health & workspace tools"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>

            {optionsDropdownOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-72 rounded-xl border border-border bg-popover/95 backdrop-blur-xl p-3 shadow-xl animate-in fade-in zoom-in-95 duration-150 z-50 space-y-3">
                {/* 1. System Health & Persistence */}
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                    System & Storage
                  </div>
                  <div className="flex flex-col gap-2 p-2 rounded-lg bg-muted/40 border border-border/50 text-xs">
                    {/* API Health */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        {apiHealth === "waking" ? (
                          <Ring className="w-3 h-3 text-amber-500" />
                        ) : (
                          <span
                            className={`w-2 h-2 rounded-full ${
                              apiHealth === "connected"
                                ? "bg-emerald-500 animate-pulse"
                                : apiHealth === "checking"
                                ? "bg-amber-500 animate-ping"
                                : "bg-rose-500"
                            }`}
                          />
                        )}
                        <span className="font-mono text-muted-foreground text-[11px]">
                          {apiHealth === "connected"
                            ? "API Online"
                            : apiHealth === "waking"
                            ? "Waking Backend..."
                            : apiHealth === "checking"
                            ? "Checking Health..."
                            : "API Offline"}
                        </span>
                      </div>
                      {apiHealth === "disconnected" && (
                        <button
                          type="button"
                          onClick={() => {
                            setApiHealth("waking");
                            checkConnection();
                          }}
                          className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium underline hover:text-emerald-500"
                        >
                          Retry
                        </button>
                      )}
                    </div>

                    {/* Saved Locally Status */}
                    <div className="flex items-center justify-between pt-1 border-t border-border/40">
                      <SaveStatusIndicator
                        onOpenWorkspaces={() => {
                          setOptionsDropdownOpen(false);
                          setWorkspaceModalOpen(true);
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Workspace Management */}
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Workspace Tools
                  </div>
                  <div className="space-y-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setOptionsDropdownOpen(false);
                        setWorkspaceModalOpen(true);
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors text-left"
                    >
                      <FolderArchive className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">Manage Workspaces</span>
                        <span className="text-[10px] text-muted-foreground">Persist, export, or restore</span>
                      </div>
                    </button>

                    <Link
                      href="/admin"
                      onClick={() => setOptionsDropdownOpen(false)}
                      className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors text-left ${
                        pathname === "/admin"
                          ? "bg-muted text-emerald-500 font-medium"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/70"
                      }`}
                    >
                      <Shield className="w-3.5 h-3.5 shrink-0" />
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">Admin Portal</span>
                        <span className="text-[10px] text-muted-foreground">Telemetry & security audit</span>
                      </div>
                    </Link>

                    <button
                      type="button"
                      onClick={() => {
                        setOptionsDropdownOpen(false);
                        handleClearWorkspace();
                      }}
                      disabled={clearing}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors text-left"
                    >
                      <Trash2 className="w-3.5 h-3.5 shrink-0" />
                      <div className="flex flex-col">
                        <span className="font-medium">Reset Workspace</span>
                        <span className="text-[10px] text-muted-foreground">Clear current workspace state</span>
                      </div>
                    </button>
                  </div>
                </div>

                {/* 3. Launch ML Studio CTA */}
                <div className="pt-1 border-t border-border/60">
                  <Link
                    href="/studio"
                    onClick={() => setOptionsDropdownOpen(false)}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow-sm shadow-emerald-600/30 transition-all active:scale-[0.98]"
                  >
                    <Sparkles className="w-3.5 h-3.5 shrink-0" />
                    <span>Launch ML Studio</span>
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Header Controls (< 768px) */}
        <div className="flex md:hidden items-center gap-1.5">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="p-2 rounded-lg bg-muted border border-border text-foreground hover:bg-muted/80 transition-colors"
            aria-label="Toggle Menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer (< 768px) */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-border bg-background/95 backdrop-blur-xl px-4 py-3.5 space-y-3.5 max-h-[calc(100vh-4rem)] overflow-y-auto animate-in slide-in-from-top-2 duration-150 shadow-xl">
          {/* Active Dataset Pill (Mobile) */}
          {activeDatasetName && (
            <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs font-mono text-emerald-700 dark:text-emerald-300 flex items-center justify-between">
              <div className="flex items-center gap-1.5 truncate">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <span className="truncate">{activeDatasetName}</span>
              </div>
              <Link
                href="/explorer"
                onClick={() => setMobileMenuOpen(false)}
                className="text-[10px] font-sans underline hover:text-emerald-600 shrink-0 ml-2 font-medium"
              >
                View
              </Link>
            </div>
          )}

          {/* 1. Primary Navigation */}
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              Primary Navigation
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {PRIMARY_NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-2 p-2.5 rounded-lg text-xs font-medium transition-colors ${
                      isActive
                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-semibold"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`} />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* 2. Advanced Tools */}
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              Advanced ML Tools
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
              {MORE_NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-2 p-2.5 rounded-lg text-xs font-medium transition-colors ${
                      isActive
                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-semibold"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`} />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* 3. System & Workspace Management */}
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              System & Workspace
            </div>
            <div className="p-2.5 rounded-lg bg-muted/40 border border-border/50 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {apiHealth === "waking" ? (
                    <Ring className="w-3 h-3 text-amber-500" />
                  ) : (
                    <span
                      className={`w-2 h-2 rounded-full ${
                        apiHealth === "connected"
                          ? "bg-emerald-500 animate-pulse"
                          : apiHealth === "checking"
                          ? "bg-amber-500 animate-ping"
                          : "bg-rose-500"
                      }`}
                    />
                  )}
                  <span className="font-mono text-muted-foreground text-[11px]">
                    {apiHealth === "connected"
                      ? "API Operational"
                      : apiHealth === "waking"
                      ? "Waking Backend..."
                      : apiHealth === "checking"
                      ? "Checking Health..."
                      : "API Disconnected"}
                  </span>
                </div>
                {apiHealth === "disconnected" && (
                  <button
                    type="button"
                    onClick={() => {
                      setApiHealth("waking");
                      checkConnection();
                    }}
                    className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium underline"
                  >
                    Retry
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-border/40">
                <SaveStatusIndicator
                  onOpenWorkspaces={() => {
                    setMobileMenuOpen(false);
                    setWorkspaceModalOpen(true);
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setWorkspaceModalOpen(true);
                }}
                className="flex items-center justify-center gap-1.5 p-2 rounded-lg border border-border bg-muted/40 text-muted-foreground hover:text-foreground text-xs font-medium transition-colors"
              >
                <FolderArchive className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Workspaces</span>
              </button>

              <Link
                href="/admin"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center justify-center gap-1.5 p-2 rounded-lg border border-border text-xs font-medium transition-colors ${
                  pathname === "/admin"
                    ? "bg-muted text-emerald-500 border-emerald-500/30 font-semibold"
                    : "bg-muted/40 text-muted-foreground hover:text-foreground"
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Admin</span>
              </Link>
            </div>

            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                handleClearWorkspace();
              }}
              disabled={clearing}
              className="w-full mt-2 flex items-center justify-center gap-1.5 p-2 rounded-lg border border-border/80 bg-muted/20 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 text-xs font-medium transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              <span>Reset Workspace</span>
            </button>
          </div>

          {/* 4. Full-width Launch ML Studio CTA */}
          <div className="pt-1">
            <Link
              href="/studio"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full flex items-center justify-center gap-1.5 p-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-sm shadow-emerald-600/30 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Launch ML Studio</span>
            </Link>
          </div>
        </div>
      )}

      {/* Workspace Management Modal */}
      <WorkspaceModal
        isOpen={workspaceModalOpen}
        onClose={() => setWorkspaceModalOpen(false)}
        onWorkspaceRestored={refreshActiveDataset}
      />

      {/* Render Free-Tier Cold Start Banner */}
      {coldStartNotice && (
        <div className="bg-amber-500/10 border-t border-b border-amber-500/20 px-3 sm:px-4 py-1 text-[11px] font-mono text-amber-300 flex flex-wrap items-center justify-center gap-1.5 text-center animate-in fade-in duration-200">
          <Ring className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="font-medium">{coldStartNotice}</span>
          <span className="text-zinc-500 hidden lg:inline">• Render free-tier instances spin down after inactivity</span>
        </div>
      )}
    </header>
  );
}
