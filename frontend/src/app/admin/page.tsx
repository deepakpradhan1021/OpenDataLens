"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import {
  Activity,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Server,
  Cpu,
  HardDrive,
  RefreshCw,
  Clock,
  Layers,
  Zap,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Unlock,
  Trash2,
  ArrowRight,
  TrendingUp,
  BarChart2,
  Flame,
  FileText,
  KeyRound,
  Eye,
  EyeOff,
} from "lucide-react";
import { api, categorizeApiError } from "@/lib/api";

interface TelemetrySnapshot {
  timestamp: string;
  uptime_seconds: number;
  system: {
    memory_rss_mb: number;
    memory_status: "healthy" | "warning" | "critical";
    memory_warning_threshold_mb: number;
    memory_critical_threshold_mb: number;
    cpu_percent: number;
    platform: string;
    active_jobs: number;
  };
  requests: {
    total: number;
    status_distribution: {
      "2xx": number;
      "3xx": number;
      "4xx": number;
      "5xx": number;
    };
    throughput_per_minute: number;
  };
  latency: {
    count: number;
    min_ms: number;
    avg_ms: number;
    p50_ms: number;
    p95_ms: number;
    p99_ms: number;
    max_ms: number;
  };
  slow_endpoints: Array<{
    route: string;
    count: number;
    avg_latency_ms: number;
    max_latency_ms: number;
    errors: number;
  }>;
  events: Record<string, number>;
  limits: {
    max_upload_size_mb: number;
    session_ttl_hours: number;
    render_ram_limit_mb: number;
  };
}

export default function AdminTelemetryPage() {
  const [adminKey, setAdminKey] = useState<string>("");
  const [keyInput, setKeyInput] = useState<string>("");
  const [showKeyText, setShowKeyText] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [telemetry, setTelemetry] = useState<TelemetrySnapshot | null>(null);
  const [refreshLoading, setRefreshLoading] = useState(false);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(5000); // 5s default
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const [resetNotice, setResetNotice] = useState<string | null>(null);

  const timerRef = useRef<any>(null);

  const verifyKey = useCallback(async (key: string) => {
    if (!key.trim()) return;
    setAuthLoading(true);
    setAuthError(null);
    try {
      await api.verifyAdminKey(key.trim());
      setIsAuthenticated(true);
      setAdminKey(key.trim());
      if (typeof window !== "undefined") {
        sessionStorage.setItem("odl_admin_key", key.trim());
      }
      await fetchTelemetryData(key.trim());
    } catch (err: any) {
      setIsAuthenticated(false);
      const detail = err.response?.data?.detail;
      const status = err.response?.status;
      if (status === 503) {
        setAuthError("Admin telemetry is disabled on this server. OPENDATALENS_ADMIN_KEY is not configured in backend environment.");
      } else if (status === 429) {
        setAuthError(detail || "Too many failed login attempts. IP temporarily locked out.");
      } else {
        setAuthError("Invalid admin authentication key. Access denied.");
      }
    } finally {
      setAuthLoading(false);
    }
  }, [fetchTelemetryData]);

  // Check sessionStorage for cached admin key
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = sessionStorage.getItem("odl_admin_key");
      if (stored) {
        setAdminKey(stored);
        setKeyInput(stored);
        verifyKey(stored);
      }
    }
  }, [verifyKey]);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    verifyKey(keyInput);
  };

  const handleSignOut = () => {
    setIsAuthenticated(false);
    setAdminKey("");
    setKeyInput("");
    setTelemetry(null);
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("odl_admin_key");
    }
  };

  const fetchTelemetryData = useCallback(async (key?: string) => {
    const activeKey = key || adminKey;
    if (!activeKey) return;
    setRefreshLoading(true);
    try {
      const data = await api.getAdminTelemetry(activeKey);
      setTelemetry(data);
      setLastRefreshedAt(new Date());
      setAuthError(null);
    } catch (err: any) {
      if (err.response?.status === 401 || err.response?.status === 429) {
        setIsAuthenticated(false);
        setAuthError(err.response?.data?.detail || "Authentication expired.");
      }
    } finally {
      setRefreshLoading(false);
    }
  }, [adminKey]);

  // Auto-refresh polling
  useEffect(() => {
    if (!isAuthenticated || autoRefreshInterval <= 0) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      fetchTelemetryData();
    }, autoRefreshInterval);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isAuthenticated, autoRefreshInterval, fetchTelemetryData]);

  const handleResetMetrics = async () => {
    if (!adminKey) return;
    if (!confirm("Are you sure you want to reset all latency buffers and endpoint counters?")) {
      return;
    }
    try {
      await api.resetAdminMetrics(adminKey);
      setResetNotice("Telemetry ring buffer and counters successfully cleared.");
      await fetchTelemetryData();
      setTimeout(() => setResetNotice(null), 4000);
    } catch (e: any) {
      alert(`Reset failed: ${e.response?.data?.detail || e.message}`);
    }
  };

  const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    return `${m}m ${s}s`;
  };

  // ---------------------------------------------------------------------------
  // Login / Gate Screen
  // ---------------------------------------------------------------------------
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
        <div className="w-full max-w-md p-8 bg-card border border-border rounded-2xl shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex p-3 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 mb-2">
              <Shield className="w-8 h-8" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Admin Telemetry Portal
            </h1>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Real-time resource inspection, latency percentiles, and Render 512 MB RAM telemetry for OpenDataLens.
            </p>
          </div>

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                <span>Admin Secret Key</span>
                <span className="text-[10px] text-muted-foreground font-mono">OPENDATALENS_ADMIN_KEY</span>
              </label>
              <div className="relative">
                <input
                  type={showKeyText ? "text" : "password"}
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  placeholder="Enter backend admin key..."
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/50 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowKeyText(!showKeyText)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showKeyText ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {authError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="leading-snug">{authError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={authLoading || !keyInput.trim()}
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold shadow-md transition-all flex items-center justify-center gap-2"
            >
              {authLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  <span>Unlock Telemetry Dashboard</span>
                </>
              )}
            </button>
          </form>

          <div className="pt-4 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
            <Link href="/" className="hover:text-foreground transition-colors flex items-center gap-1">
              <span>&larr; Return to Workspace</span>
            </Link>
            <span className="font-mono">Zero Cloud DB • In-Memory</span>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Authenticated Telemetry Dashboard
  // ---------------------------------------------------------------------------
  const mem = telemetry?.system;
  const reqs = telemetry?.requests;
  const lat = telemetry?.latency;
  const memPct = mem ? Math.min(100, Math.round((mem.memory_rss_mb / 512) * 100)) : 0;

  const isWarning = mem?.memory_status === "warning";
  const isCritical = mem?.memory_status === "critical";

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      {/* Top Header */}
      <div className="sticky top-0 z-30 border-b border-border bg-card/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-foreground">Production Telemetry</h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                  <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  LIVE
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Process RSS Memory, Latency Percentiles & Route Telemetry
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Auto refresh interval dropdown */}
            <div className="flex items-center gap-1.5 bg-muted/40 border border-border rounded-xl px-2.5 py-1 text-xs">
              <Clock className="w-3.5 h-3.5 text-muted-foreground" />
              <select
                value={autoRefreshInterval}
                onChange={(e) => setAutoRefreshInterval(Number(e.target.value))}
                className="bg-transparent text-xs font-mono focus:outline-none cursor-pointer"
              >
                <option value={2000}>Refresh: 2s</option>
                <option value={5000}>Refresh: 5s</option>
                <option value={10000}>Refresh: 10s</option>
                <option value={30000}>Refresh: 30s</option>
                <option value={0}>Refresh: Paused</option>
              </select>
            </div>

            {/* Manual refresh button */}
            <button
              onClick={() => fetchTelemetryData()}
              disabled={refreshLoading}
              className="p-2 rounded-xl border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-medium transition-all"
              title="Refresh telemetry"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshLoading ? "animate-spin" : ""}`} />
            </button>

            {/* Reset metrics */}
            <button
              onClick={handleResetMetrics}
              className="px-3 py-1.5 rounded-xl border border-border hover:bg-rose-500/10 hover:border-rose-500/30 hover:text-rose-600 dark:hover:text-rose-400 text-xs font-medium text-muted-foreground transition-all flex items-center gap-1.5"
              title="Clear ring buffers"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>

            {/* Sign Out */}
            <button
              onClick={handleSignOut}
              className="px-3 py-1.5 rounded-xl bg-muted/50 hover:bg-muted text-foreground text-xs font-medium transition-all flex items-center gap-1.5"
            >
              <Lock className="w-3.5 h-3.5 text-muted-foreground" />
              <span>Lock</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Reset Notice Banner */}
        {resetNotice && (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{resetNotice}</span>
          </div>
        )}

        {/* 1. Core System Health Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card A: Render 512 MB RSS Memory */}
          <div
            className={`p-5 rounded-2xl border bg-card space-y-3 shadow-sm ${
              isCritical
                ? "border-rose-500/40 bg-rose-500/5"
                : isWarning
                ? "border-amber-500/40 bg-amber-500/5"
                : "border-border"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Process RSS Memory</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase ${
                  isCritical
                    ? "bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30"
                    : isWarning
                    ? "bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                    : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                }`}
              >
                {mem?.memory_status || "healthy"}
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono tracking-tight text-foreground">
                {mem?.memory_rss_mb ?? "--"}
              </span>
              <span className="text-xs text-muted-foreground font-mono">/ 512 MB</span>
            </div>
            {/* Memory Bar */}
            <div className="w-full bg-muted/60 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isCritical ? "bg-rose-500" : isWarning ? "bg-amber-500" : "bg-emerald-500"
                }`}
                style={{ width: `${memPct}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
              <span>Warn: 350 MB</span>
              <span>Crit: 450 MB</span>
            </div>
          </div>

          {/* Card B: CPU & Active Jobs */}
          <div className="p-5 rounded-2xl border border-border bg-card space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Process CPU & Jobs</span>
              <Cpu className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="flex items-baseline gap-3">
              <span className="text-2xl font-bold font-mono tracking-tight text-foreground">
                {mem?.cpu_percent ?? 0}%
              </span>
              <span className="text-xs text-muted-foreground">CPU Core Load</span>
            </div>
            <div className="pt-2 border-t border-border flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Active ML Training:</span>
              <span className="font-mono font-semibold text-foreground">
                {mem?.active_jobs ?? 0} jobs
              </span>
            </div>
          </div>

          {/* Card C: Total Throughput & Status Breakdown */}
          <div className="p-5 rounded-2xl border border-border bg-card space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Total API Requests</span>
              <TrendingUp className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono tracking-tight text-foreground">
                {reqs?.total?.toLocaleString() ?? 0}
              </span>
              <span className="text-xs text-muted-foreground font-mono">
                ({reqs?.throughput_per_minute ?? 0}/min)
              </span>
            </div>
            <div className="grid grid-cols-4 gap-1 text-center font-mono text-[10px]">
              <div className="p-1 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                {reqs?.status_distribution["2xx"] ?? 0} 2xx
              </div>
              <div className="p-1 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400">
                {reqs?.status_distribution["3xx"] ?? 0} 3xx
              </div>
              <div className="p-1 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400">
                {reqs?.status_distribution["4xx"] ?? 0} 4xx
              </div>
              <div className="p-1 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400">
                {reqs?.status_distribution["5xx"] ?? 0} 5xx
              </div>
            </div>
          </div>

          {/* Card D: System Uptime & Platform */}
          <div className="p-5 rounded-2xl border border-border bg-card space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Service Uptime</span>
              <Server className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-bold font-mono tracking-tight text-foreground">
              {telemetry ? formatUptime(telemetry.uptime_seconds) : "--"}
            </div>
            <div className="pt-2 border-t border-border flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Platform Engine:</span>
              <span className="font-mono text-foreground">{mem?.platform || "Linux / Render"}</span>
            </div>
          </div>
        </div>

        {/* 2. Latency Percentiles & Failure Events */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Latency Percentiles (2 Cols) */}
          <div className="lg:col-span-2 p-6 rounded-2xl border border-border bg-card space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-foreground">API Latency Percentiles</h2>
                <p className="text-xs text-muted-foreground">
                  Computed from the last {lat?.count ?? 0} requests in circular ring buffer
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-xl bg-muted text-[11px] font-mono text-muted-foreground">
                Ring Buffer: {lat?.count ?? 0}/500
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
              <div className="p-3.5 rounded-xl bg-muted/30 border border-border text-center space-y-1">
                <div className="text-[10px] text-muted-foreground uppercase font-mono">Min</div>
                <div className="text-lg font-bold font-mono text-foreground">{lat?.min_ms ?? 0} ms</div>
              </div>
              <div className="p-3.5 rounded-xl bg-muted/30 border border-border text-center space-y-1">
                <div className="text-[10px] text-muted-foreground uppercase font-mono">Average</div>
                <div className="text-lg font-bold font-mono text-foreground">{lat?.avg_ms ?? 0} ms</div>
              </div>
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-1">
                <div className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase font-mono font-bold">p50</div>
                <div className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400">{lat?.p50_ms ?? 0} ms</div>
              </div>
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center space-y-1">
                <div className="text-[10px] text-amber-600 dark:text-amber-400 uppercase font-mono font-bold">p95</div>
                <div className="text-lg font-bold font-mono text-amber-600 dark:text-amber-400">{lat?.p95_ms ?? 0} ms</div>
              </div>
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-center space-y-1">
                <div className="text-[10px] text-rose-600 dark:text-rose-400 uppercase font-mono font-bold">p99</div>
                <div className="text-lg font-bold font-mono text-rose-600 dark:text-rose-400">{lat?.p99_ms ?? 0} ms</div>
              </div>
              <div className="p-3.5 rounded-xl bg-muted/30 border border-border text-center space-y-1">
                <div className="text-[10px] text-muted-foreground uppercase font-mono">Max</div>
                <div className="text-lg font-bold font-mono text-foreground">{lat?.max_ms ?? 0} ms</div>
              </div>
            </div>
          </div>

          {/* Operational Failure Counters (1 Col) */}
          <div className="p-6 rounded-2xl border border-border bg-card space-y-4 shadow-sm">
            <div>
              <h2 className="text-sm font-bold text-foreground">Operational Failures</h2>
              <p className="text-xs text-muted-foreground">Failure counts since server initialization</p>
            </div>

            <div className="space-y-2 text-xs">
              {Object.entries(telemetry?.events || {}).map(([key, count]) => (
                <div
                  key={key}
                  className="flex items-center justify-between p-2 rounded-xl bg-muted/20 border border-border"
                >
                  <span className="font-mono text-muted-foreground capitalize">
                    {key.replace(/_/g, " ")}
                  </span>
                  <span
                    className={`font-mono font-bold px-2 py-0.5 rounded-full text-[10px] ${
                      count > 0
                        ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                        : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    }`}
                  >
                    {count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 3. Slow Endpoints Table */}
        <div className="p-6 rounded-2xl border border-border bg-card space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-foreground">Slow Endpoint Breakdown</h2>
              <p className="text-xs text-muted-foreground">
                Endpoints sorted by average latency (normalized route templates)
              </p>
            </div>
            <span className="text-xs text-muted-foreground font-mono">
              Last updated: {lastRefreshedAt ? lastRefreshedAt.toLocaleTimeString() : "--"}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border text-muted-foreground font-mono">
                  <th className="py-2.5 px-3">Route Template</th>
                  <th className="py-2.5 px-3 text-right">Invocations</th>
                  <th className="py-2.5 px-3 text-right">Avg Latency</th>
                  <th className="py-2.5 px-3 text-right">Max Latency</th>
                  <th className="py-2.5 px-3 text-right">Errors (4xx/5xx)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(!telemetry?.slow_endpoints || telemetry.slow_endpoints.length === 0) ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-muted-foreground">
                      No endpoint activity recorded yet in current cycle.
                    </td>
                  </tr>
                ) : (
                  telemetry.slow_endpoints.map((ep, i) => (
                    <tr key={i} className="hover:bg-muted/30 font-mono transition-colors">
                      <td className="py-2.5 px-3 font-semibold text-foreground">{ep.route}</td>
                      <td className="py-2.5 px-3 text-right text-muted-foreground">{ep.count}</td>
                      <td className="py-2.5 px-3 text-right text-foreground font-semibold">
                        {ep.avg_latency_ms} ms
                      </td>
                      <td className="py-2.5 px-3 text-right text-muted-foreground">{ep.max_latency_ms} ms</td>
                      <td className="py-2.5 px-3 text-right">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            ep.errors > 0
                              ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                              : "text-muted-foreground"
                          }`}
                        >
                          {ep.errors}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 4. Production Security & Limits Footer */}
        <div className="p-4 rounded-xl border border-border bg-muted/10 text-xs text-muted-foreground flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Zero dataset rows or session tokens logged. Constant-time admin key validation enforced.</span>
          </div>
          <div className="flex items-center gap-4 font-mono text-[11px]">
            <span>RAM Limit: 512 MB</span>
            <span>Upload Max: 25 MB</span>
            <span>Session TTL: 24h</span>
          </div>
        </div>
      </div>
    </div>
  );
}
