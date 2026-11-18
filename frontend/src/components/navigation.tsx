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
  Loader2,
  PieChart,
  FolderArchive,
  Shield,
} from "lucide-react";
import { Ring } from "@/components/loading-ui/ring";
import { api, getWorkspaceId, subscribeColdStart } from "@/lib/api";
import { ThemeToggle } from "./theme-toggle";
import { SaveStatusIndicator } from "./save-status-indicator";
import { WorkspaceModal } from "./workspace-modal";

const NAV_ITEMS = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Explorer", href: "/explorer", icon: Database },
  { name: "Quality", href: "/quality", icon: ShieldCheck },
  { name: "Visualize", href: "/visualize", icon: PieChart },
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
  const [workspaceModalOpen, setWorkspaceModalOpen] = useState(false);

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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-5 xl:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo & Nav */}
        <div className="flex items-center space-x-2 xl:space-x-6">
          <Link href="/" className="flex items-center space-x-2.5 group shrink-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 via-teal-600 to-emerald-700 flex items-center justify-center shadow-sm shadow-emerald-500/20 group-hover:scale-105 transition-transform duration-200">
              <Layers className="w-4 h-4 text-white" />
            </div>
            <div className="flex items-center space-x-2">
              <span className="font-semibold text-base tracking-tight text-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                OpenDataLens
              </span>
              <span className="text-[10px] uppercase font-mono font-semibold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 tracking-wider">
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
                      ? "bg-emerald-500/10 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 shadow-sm border border-emerald-500/30 font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`} />
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
              <Ring className="w-3 h-3 text-amber-400" />
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

          {/* Save Status Indicator */}
          <SaveStatusIndicator onOpenWorkspaces={() => setWorkspaceModalOpen(true)} />

          {/* Workspaces Manager Button */}
          <button
            onClick={() => setWorkspaceModalOpen(true)}
            className="hidden xl:flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border border-border hover:border-border/80 bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-medium whitespace-nowrap shrink-0 transition-colors"
            title="Manage persistent browser workspaces"
          >
            <FolderArchive className="w-3.5 h-3.5 text-muted-foreground" />
            <span>Workspaces</span>
          </button>

          {/* Active Dataset Pill */}
          {activeDatasetName && (
            <Link
              href="/explorer"
              className="hidden 2xl:flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-mono whitespace-nowrap shrink-0 transition-colors hover:bg-emerald-500/20"
              title="Click to view active dataset"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="max-w-[130px] truncate">{activeDatasetName}</span>
            </Link>
          )}

          {/* Theme Toggle */}
          <ThemeToggle />

          {/* Admin Telemetry Portal Link */}
          <Link
            href="/admin"
            className={`p-2 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-medium transition-colors ${
              pathname === "/admin" ? "bg-muted text-emerald-500 border-emerald-500/30" : ""
            }`}
            title="Admin Telemetry Portal"
          >
            <Shield className="w-3.5 h-3.5" />
          </Link>

          {/* Clear Workspace Button */}
          <button
            onClick={handleClearWorkspace}
            disabled={clearing}
            className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg border border-border hover:border-border/80 bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-medium whitespace-nowrap shrink-0 transition-colors"
            title="Clear current workspace and start fresh"
          >
            <Trash2 className="w-3 h-3 text-muted-foreground" />
            <span>Reset</span>
          </button>

          <Link
            href="/studio"
            className="hidden xl:inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm shadow-emerald-600/30 whitespace-nowrap shrink-0 transition-all duration-150 active:scale-95"
          >
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span className="whitespace-nowrap">Launch Studio</span>
          </Link>
        </div>

        {/* Mobile Menu Button */}
        <div className="flex lg:hidden items-center space-x-2">
          <ThemeToggle />
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg bg-muted border border-border text-foreground hover:bg-muted/80 transition-colors"
            aria-label="Toggle Menu"
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-border bg-background/95 backdrop-blur-xl px-4 py-3 space-y-2 animate-in slide-in-from-top-2 duration-150 shadow-lg">
          <div className="flex items-center justify-between pb-1 text-xs">
            <div className="flex items-center space-x-1.5">
              {apiHealth === "waking" ? (
                <Ring className="w-3 h-3 text-amber-500" />
              ) : (
                <span
                  className={`w-2 h-2 rounded-full ${
                    apiHealth === "connected"
                      ? "bg-emerald-500"
                      : apiHealth === "checking"
                      ? "bg-amber-500 animate-ping"
                      : "bg-rose-500"
                  }`}
                />
              )}
              <span className="text-muted-foreground font-mono">
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
                  className="text-[10px] text-emerald-600 dark:text-emerald-400 underline ml-1 font-medium"
                >
                  Retry
                </button>
              )}
            </div>
            <button
              onClick={handleClearWorkspace}
              className="text-xs text-muted-foreground hover:text-rose-500 flex items-center space-x-1 transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              <span>Clear Workspace</span>
            </button>
          </div>

          {activeDatasetName && (
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs font-mono text-emerald-700 dark:text-emerald-300 flex items-center space-x-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
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

          <div className="pt-2 space-y-2">
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                setWorkspaceModalOpen(true);
              }}
              className="w-full flex items-center justify-center space-x-1.5 p-2 rounded-lg border border-border bg-muted/40 text-muted-foreground hover:text-foreground text-xs font-medium transition-colors"
            >
              <FolderArchive className="w-3.5 h-3.5 text-muted-foreground" />
              <span>Manage Saved Workspaces</span>
            </button>

            <Link
              href="/studio"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full flex items-center justify-center space-x-1.5 p-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-sm shadow-emerald-600/30 transition-colors"
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
        <div className="bg-amber-500/10 border-t border-b border-amber-500/20 px-4 py-1.5 text-[11px] sm:text-xs font-mono text-amber-300 flex items-center justify-center space-x-2 animate-in fade-in duration-200">
          <Ring className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="font-medium">{coldStartNotice}</span>
          <span className="text-zinc-500 hidden md:inline">• Render free-tier instances spin down after inactivity</span>
        </div>
      )}
    </header>
  );
}
