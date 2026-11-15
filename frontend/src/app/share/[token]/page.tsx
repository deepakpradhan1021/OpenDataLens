"use client";

import { useEffect, useState, use, useCallback } from "react";
import Link from "next/link";
import {
  Shield,
  Lock,
  Calendar,
  Layers,
  Database,
  Cpu,
  CheckCircle2,
  Printer,
  Clock,
  AlertTriangle,
  ExternalLink,
  Sparkles,
  ArrowRight
} from "lucide-react";
import { Ring } from "@/components/loading-ui/ring";
import { api } from "@/lib/api";
import { SharedReportResponse } from "@/lib/types";

interface SharePageProps {
  params: Promise<{ token: string }>;
}

export default function SharePage({ params }: SharePageProps) {
  const { token } = use(params);

  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<SharedReportResponse | null>(null);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [isUnlocking, setIsUnlocking] = useState(false);

  const fetchReport = useCallback(async (pwd?: string) => {
    try {
      const res = await api.getSharedReport(token, pwd);
      setReport(res);
      if (res.status === "active") {
        setPasswordError("");
      } else if (res.status === "invalid_password") {
        setPasswordError("Incorrect password. Please try again.");
      }
    } catch (err: any) {
      if (err.response?.status === 401) {
        setPasswordError("Incorrect password. Please try again.");
      } else if (err.response?.status === 410) {
        setReport({ status: "expired" });
      } else if (err.response?.status === 404) {
        setReport({ status: "not_found" });
      } else {
        setReport({ status: "error", message: err.message });
      }
    } finally {
      setLoading(false);
      setIsUnlocking(false);
    }
  }, [token]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    setIsUnlocking(true);
    fetchReport(password);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-foreground flex items-center justify-center p-8">
        <div className="p-8 rounded-2xl border border-border bg-card text-center space-y-3 shadow-lg max-w-sm">
          <Ring className="size-7 text-emerald-500 mx-auto" />
          <div className="text-xs font-mono text-muted-foreground">
            Decrypting and compiling shared analysis snapshot...
          </div>
        </div>
      </div>
    );
  }

  // Case 1: Password Required
  if (report?.status === "password_required" || passwordError) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-foreground flex items-center justify-center p-4">
        <div className="w-full max-w-md p-8 rounded-2xl border border-border bg-card shadow-xl space-y-6">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>

          <div className="text-center space-y-1.5">
            <h2 className="text-lg font-bold text-foreground">{report?.title || "Protected Report"}</h2>
            <p className="text-xs text-muted-foreground">
              This analytical report is password-protected. Please enter the passphrase to view the findings.
            </p>
          </div>

          <form onSubmit={handleUnlock} className="space-y-4">
            <div className="space-y-1.5">
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password..."
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-foreground text-xs focus:outline-none focus:border-emerald-500"
              />
              {passwordError && (
                <p className="text-[11px] text-red-500 font-medium">{passwordError}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isUnlocking}
              className="w-full inline-flex items-center justify-center space-x-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-md shadow-emerald-600/30 transition-all disabled:opacity-50"
            >
              {isUnlocking ? <Ring className="size-3.5 text-white" /> : <Shield className="w-3.5 h-3.5" />}
              <span>Unlock Report</span>
            </button>
          </form>

          <div className="pt-2 text-center border-t border-border/60">
            <span className="text-[10px] text-muted-foreground font-mono">
              Secured by OpenDataLens Access Guard
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Case 2: Expired Link
  if (report?.status === "expired") {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-foreground flex items-center justify-center p-4">
        <div className="w-full max-w-md p-8 rounded-2xl border border-border bg-card shadow-xl text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
            <Clock className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-foreground">Report Link Expired</h2>
            <p className="text-xs text-muted-foreground">
              This shared report had a time-to-live expiration that has elapsed. Please request a new share link from the author.
            </p>
          </div>
          <div className="pt-2">
            <Link
              href="/"
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-500 transition-colors"
            >
              <span>Explore OpenDataLens</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Case 3: Not Found or Error
  if (report?.status === "not_found" || report?.status === "error") {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-foreground flex items-center justify-center p-4">
        <div className="w-full max-w-md p-8 rounded-2xl border border-border bg-card shadow-xl text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-foreground">Report Not Found</h2>
            <p className="text-xs text-muted-foreground">
              The requested report snapshot does not exist or was revoked by the workspace owner.
            </p>
          </div>
          <div className="pt-2">
            <Link
              href="/"
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground border border-border text-xs font-semibold transition-colors"
            >
              <span>Return Home</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const data = report?.report_data;
  if (!data) return null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-foreground p-4 sm:p-6 lg:p-12 transition-colors">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Top Header Card */}
        <div className="p-6 sm:p-8 rounded-2xl bg-gradient-to-r from-emerald-900 via-emerald-800 to-emerald-700 text-white shadow-xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-[10px] font-mono uppercase tracking-wider px-2.5 py-1 rounded-full bg-white/10 text-emerald-200 border border-white/20">
              OpenDataLens Executive Report Snapshot
            </span>
            <button
              onClick={() => window.print()}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold backdrop-blur-sm transition-all"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Save PDF</span>
            </button>
          </div>

          <div className="space-y-1.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              {report.title || data.dataset_name}
            </h1>
            <p className="text-xs text-emerald-100 flex flex-wrap items-center gap-3">
              <span>Dataset: <strong>{data.dataset_name}</strong></span>
              <span>&bull;</span>
              <span>Source: <strong>{data.source}</strong></span>
              <span>&bull;</span>
              <span>Published: {new Date(report.created_at || "").toLocaleDateString()}</span>
            </p>
          </div>
        </div>

        {/* Executive KPI Summary Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl border border-border bg-card text-center space-y-1 shadow-sm">
            <span className="text-[10px] font-mono uppercase text-muted-foreground font-semibold">Dimensions</span>
            <div className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {data.total_rows.toLocaleString()} &times; {data.total_cols}
            </div>
          </div>

          <div className="p-5 rounded-2xl border border-border bg-card text-center space-y-1 shadow-sm">
            <span className="text-[10px] font-mono uppercase text-muted-foreground font-semibold">Completeness</span>
            <div className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {data.quality_overview.completeness_score.toFixed(1)}%
            </div>
          </div>

          <div className="p-5 rounded-2xl border border-border bg-card text-center space-y-1 shadow-sm">
            <span className="text-[10px] font-mono uppercase text-muted-foreground font-semibold">Health Score</span>
            <div className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {data.quality_overview.health_score.toFixed(1)}%
            </div>
          </div>

          <div className="p-5 rounded-2xl border border-border bg-card text-center space-y-1 shadow-sm">
            <span className="text-[10px] font-mono uppercase text-muted-foreground font-semibold">Clean Steps</span>
            <div className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {data.clean_history.length}
            </div>
          </div>
        </div>

        {/* Quality Audit Table */}
        <div className="p-6 rounded-2xl border border-border bg-card space-y-4 shadow-sm">
          <h3 className="text-sm font-bold text-foreground">Data Quality &amp; Structural Overview</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="p-3 rounded-xl bg-muted/40 space-y-1">
              <span className="text-muted-foreground">Duplicate Rows</span>
              <div className="text-base font-bold text-foreground">{data.quality_overview.duplicate_rows}</div>
            </div>
            <div className="p-3 rounded-xl bg-muted/40 space-y-1">
              <span className="text-muted-foreground">Missing Cells</span>
              <div className="text-base font-bold text-foreground">{data.quality_overview.missing_cells}</div>
            </div>
            <div className="p-3 rounded-xl bg-muted/40 space-y-1">
              <span className="text-muted-foreground">Inferred Columns</span>
              <div className="text-base font-bold text-foreground">{data.columns.length} columns</div>
            </div>
          </div>
        </div>

        {/* Data Cleaning Lineage */}
        {data.clean_history.length > 0 && (
          <div className="p-6 rounded-2xl border border-border bg-card space-y-4 shadow-sm">
            <h3 className="text-sm font-bold text-foreground">Data Cleaning Lineage Trail</h3>
            <div className="overflow-x-auto border border-border rounded-xl">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 text-muted-foreground font-medium border-b border-border">
                  <tr>
                    <th className="p-3">#</th>
                    <th className="p-3">Action</th>
                    <th className="p-3">Target Column</th>
                    <th className="p-3">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.clean_history.map((step: any, idx: number) => (
                    <tr key={idx} className="hover:bg-muted/30">
                      <td className="p-3 font-mono">{idx + 1}</td>
                      <td className="p-3 font-semibold text-foreground">{step.action}</td>
                      <td className="p-3 font-mono text-muted-foreground">{step.column || step.columns || "All"}</td>
                      <td className="p-3 text-muted-foreground">{String(step.timestamp || "").slice(0, 19)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Machine Learning Model Scoreboard */}
        {data.ml.leaderboard.length > 0 && (
          <div className="p-6 rounded-2xl border border-border bg-card space-y-4 shadow-sm">
            <h3 className="text-sm font-bold text-foreground">Machine Learning Model Scoreboard</h3>
            <div className="overflow-x-auto border border-border rounded-xl">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 text-muted-foreground font-medium border-b border-border">
                  <tr>
                    <th className="p-3">Model Architecture</th>
                    <th className="p-3">Fit Time</th>
                    <th className="p-3">Metrics</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.ml.leaderboard.map((m: any, idx: number) => (
                    <tr key={idx} className="hover:bg-muted/30">
                      <td className="p-3 font-semibold text-foreground">{m.model_name}</td>
                      <td className="p-3 font-mono text-muted-foreground">{m.fit_time.toFixed(3)}s</td>
                      <td className="p-3 font-mono text-emerald-600 dark:text-emerald-400">
                        {Object.entries(m.metrics)
                          .map(([k, v]) => `${k}: ${typeof v === "number" ? v.toFixed(4) : v}`)
                          .join(" | ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Data Sample Preview */}
        {data.preview_records && data.preview_records.length > 0 && (
          <div className="p-6 rounded-2xl border border-border bg-card space-y-4 shadow-sm">
            <h3 className="text-sm font-bold text-foreground">Sample Records Preview</h3>
            <div className="overflow-x-auto border border-border rounded-xl">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 text-muted-foreground font-medium border-b border-border">
                  <tr>
                    {data.columns.slice(0, 6).map((c: any) => (
                      <th key={c.name} className="p-3">{c.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.preview_records.slice(0, 10).map((row: any, idx: number) => (
                    <tr key={idx} className="hover:bg-muted/30">
                      {data.columns.slice(0, 6).map((c: any) => (
                        <td key={c.name} className="p-3 text-foreground font-mono">
                          {String(row[c.name] ?? "-")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Public Footer */}
        <div className="text-center py-6 border-t border-border space-y-2">
          <p className="text-xs text-muted-foreground">
            Report compiled and distributed with <strong>OpenDataLens</strong> &bull; AI-Powered Dataset Explorer &amp; ML Studio
          </p>
          <Link
            href="/"
            className="inline-flex items-center space-x-1.5 text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-semibold"
          >
            <span>Analyze your own data with OpenDataLens</span>
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}
