"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import axios from "axios";
import {
  Database,
  Search,
  Upload,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Table as TableIcon,
  ArrowRight,
  ExternalLink,
  Layers,
  Sparkles,
  LayoutGrid,
  List,
  Cpu,
  ShieldCheck,
  FileSpreadsheet,
  FileText,
  FileCode,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { Ring } from "@/components/loading-ui/ring";
import { api, categorizeApiError } from "@/lib/api";
import { CuratedDatasetItem, HFDatasetCard, DatasetPreviewResponse } from "@/lib/types";
import { RetroDock } from "@/components/retro-dock";
import { FilterState } from "@/components/retro-filter-drawer";
import { workspaceSync } from "@/lib/workspace-sync";
import { loadActiveWorkspace } from "@/lib/workspace-restore";

export default function ExplorerPage() {
  const [activeTab, setActiveTab] = useState<"curated" | "hf" | "csv">("curated");
  const [curatedList, setCuratedList] = useState<CuratedDatasetItem[]>([]);
  const [hfQuery, setHfQuery] = useState("tabular");
  const [hfResults, setHfResults] = useState<HFDatasetCard[]>([]);
  const [activeDataset, setActiveDataset] = useState<DatasetPreviewResponse | null>(null);
  const [isOfflineMode, setIsOfflineMode] = useState<boolean>(false);

  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Multi-format Upload & Drag-and-Drop state
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Filters & View Mode
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [filters, setFilters] = useState<FilterState>({
    task: [],
    domains: [],
    scalers: [],
    models: [],
    minRows: 0,
    maxRows: 50000,
    fastBaselinesOnly: false,
  });

  useEffect(() => {
    api.getCuratedDatasets().then(setCuratedList).catch(console.error);
    api.getActiveDataset()
      .then((data) => {
        setActiveDataset(data);
        setIsOfflineMode(false);
        if (data) {
          workspaceSync.queueAutoSave({
            dataset: {
              workspace_id: data.session_id,
              metadata: data.metadata,
              columns: data.columns,
              records: data.records,
              total_rows: data.total_rows,
              total_cols: data.total_cols,
              memory_mb: data.memory_mb,
              updated_at: new Date().toISOString(),
            },
          });
        }
      })
      .catch(async () => {
        // Backend sleeping or offline: safely restore active workspace from browser IndexedDB
        const restored = await loadActiveWorkspace();
        if (restored.dataset) {
          setActiveDataset({
            session_id: restored.dataset.workspace_id,
            metadata: {
              id: restored.dataset.workspace_id,
              name: "Restored Dataset",
              ...(restored.dataset.metadata || {}),
            },
            columns: restored.dataset.columns,
            records: restored.dataset.records,
            total_rows: restored.dataset.total_rows,
            total_cols: restored.dataset.total_cols,
            memory_mb: restored.dataset.memory_mb,
          });
          setIsOfflineMode(true);
        }
      });
  }, []);

  const handleLoadCurated = async (id: string) => {
    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const data = await api.loadCuratedDataset(id);
      setActiveDataset(data);
      setIsOfflineMode(false);
      workspaceSync.queueAutoSave({
        dataset: {
          workspace_id: data.session_id,
          metadata: data.metadata,
          columns: data.columns,
          records: data.records,
          total_rows: data.total_rows,
          total_cols: data.total_cols,
          memory_mb: data.memory_mb,
          updated_at: new Date().toISOString(),
        },
      });

      // Fetch and persist full raw CSV in IndexedDB in background
      api.downloadDatasetCsvText(data.session_id).then((fullCsv) => {
        workspaceSync.queueAutoSave({
          dataset: {
            workspace_id: data.session_id,
            metadata: data.metadata,
            columns: data.columns,
            records: data.records,
            total_rows: data.total_rows,
            total_cols: data.total_cols,
            memory_mb: data.memory_mb,
            raw_csv: fullCsv,
            updated_at: new Date().toISOString(),
          },
        });
      }).catch((e) => console.warn("Background raw CSV persistence skipped:", e));

      setSuccessMsg(`Benchmark '${data.metadata.name}' loaded successfully (${data.total_rows.toLocaleString()} rows, ${data.total_cols} cols).`);
    } catch (err: any) {
      const cat = categorizeApiError(err);
      if (cat.type === "cold_start") {
        setError("Waking up the backend. This may take up to 50 seconds on Render's free tier. Please click Mount again in a moment.");
      } else if (cat.type === "timeout") {
        setError("Connection timed out after 75s. The backend may still be starting up. Please click Mount again.");
      } else {
        setError(cat.message || "Failed to load curated dataset.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSearchHF = async (customQuery?: string | React.FormEvent) => {
    if (customQuery && typeof customQuery === "object" && "preventDefault" in customQuery) {
      customQuery.preventDefault();
    }
    const q = typeof customQuery === "string" ? customQuery : hfQuery;
    if (typeof customQuery === "string") {
      setHfQuery(customQuery);
    }
    setSearching(true);
    setError(null);
    try {
      const data = await api.searchHFDatasets(q, 9);
      setHfResults(data);
    } catch (err: any) {
      const cat = categorizeApiError(err);
      if (cat.type === "cold_start") {
        setError("Waking up the backend. This may take up to 50 seconds. Please try searching again once the backend is awake.");
      } else {
        setError(cat.message || "Failed to search Hugging Face.");
      }
    } finally {
      setSearching(false);
    }
  };

  const handleLoadHF = async (datasetName: string) => {
    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const data = await api.loadHFDataset(datasetName, "train", 2000);
      setActiveDataset(data);
      setIsOfflineMode(false);
      workspaceSync.queueAutoSave({
        dataset: {
          workspace_id: data.session_id,
          metadata: data.metadata,
          columns: data.columns,
          records: data.records,
          total_rows: data.total_rows,
          total_cols: data.total_cols,
          memory_mb: data.memory_mb,
          updated_at: new Date().toISOString(),
        },
      });

      // Fetch and persist full raw CSV in background
      api.downloadDatasetCsvText(data.session_id).then((fullCsv) => {
        workspaceSync.queueAutoSave({
          dataset: {
            workspace_id: data.session_id,
            metadata: data.metadata,
            columns: data.columns,
            records: data.records,
            total_rows: data.total_rows,
            total_cols: data.total_cols,
            memory_mb: data.memory_mb,
            raw_csv: fullCsv,
            updated_at: new Date().toISOString(),
          },
        });
      }).catch((e) => console.warn("Background raw CSV persistence skipped:", e));

      setSuccessMsg(`Streamed '${datasetName}' via HF Dataset API (${data.total_rows.toLocaleString()} rows).`);
    } catch (err: any) {
      const cat = categorizeApiError(err);
      if (cat.type === "cold_start") {
        setError("Waking up the backend. This may take up to 50 seconds. Please try mounting again shortly.");
      } else {
        setError(cat.message || "Failed to load Hugging Face dataset.");
      }
    } finally {
      setLoading(false);
    }
  };

  const processUpload = async (file: File) => {
    if (loading) return;

    // Client-side validations
    if (file.size === 0) {
      setError(`The selected file '${file.name}' is empty (0 bytes). Please select a valid dataset.`);
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      setError(
        `File size exceeds 25 MB limit (${(file.size / (1024 * 1024)).toFixed(1)} MB). Please upload a dataset under 25 MB.`
      );
      return;
    }

    const ext = "." + (file.name.split(".").pop()?.toLowerCase() || "");
    const allowed = [".csv", ".tsv", ".txt", ".xlsx", ".xls", ".json", ".jsonl", ".pdf", ".sql"];
    if (!allowed.includes(ext)) {
      setError(
        `Unsupported format '${ext}'. Supported extensions: CSV (.csv, .tsv), Excel (.xlsx, .xls), JSON (.json, .jsonl), PDF (.pdf), and SQL (.sql).`
      );
      return;
    }

    setSelectedFile(file);
    setLoading(true);
    setUploadProgress(15);
    setUploadStage("Validating file signature...");
    setError(null);
    setSuccessMsg(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Read raw text if it is a text-based tabular file (.csv, .tsv, .txt)
    let rawCsvText: string | undefined;
    if (ext === ".csv" || ext === ".tsv" || ext === ".txt") {
      try {
        rawCsvText = await file.text();
      } catch (readErr) {
        console.warn("Could not read raw CSV text directly from File:", readErr);
      }
    }

    try {
      setUploadStage("Streaming to secure in-memory buffer...");
      const data = await api.uploadFile(
        file,
        undefined,
        (percent) => {
          setUploadProgress(Math.max(20, Math.min(85, percent)));
          if (percent > 75) {
            setUploadStage("Sniffing schema, delimiters & types...");
          }
        },
        controller.signal
      );

      setUploadProgress(100);
      setUploadStage("Audit complete!");
      setActiveDataset(data);
      setIsOfflineMode(false);
      workspaceSync.queueAutoSave({
        dataset: {
          workspace_id: data.session_id,
          metadata: data.metadata,
          columns: data.columns,
          records: data.records,
          total_rows: data.total_rows,
          total_cols: data.total_cols,
          memory_mb: data.memory_mb,
          raw_csv: rawCsvText,
          updated_at: new Date().toISOString(),
        },
      });

      // If non-CSV file (e.g. Excel, JSON, PDF), fetch converted CSV from backend to persist full dataset
      if (!rawCsvText) {
        api.downloadDatasetCsvText(data.session_id).then((fullCsv) => {
          workspaceSync.queueAutoSave({
            dataset: {
              workspace_id: data.session_id,
              metadata: data.metadata,
              columns: data.columns,
              records: data.records,
              total_rows: data.total_rows,
              total_cols: data.total_cols,
              memory_mb: data.memory_mb,
              raw_csv: fullCsv,
              updated_at: new Date().toISOString(),
            },
          });
        }).catch((e) => console.warn("Background raw CSV fetch skipped:", e));
      }

      const displayExt = ext.replace(".", "").toUpperCase();
      setSuccessMsg(
        `Parsed ${displayExt} '${file.name}' successfully (${data.total_rows.toLocaleString()} rows, ${data.total_cols} cols).`
      );
    } catch (err: any) {
      if (axios.isCancel(err) || err.name === "CanceledError" || err.code === "ERR_CANCELED") {
        setError("File upload was cancelled by user.");
      } else {
        const cat = categorizeApiError(err);
        if (cat.type === "cold_start") {
          setError("Waking up the backend. This may take up to 50 seconds on Render's free tier. Please upload your file again in a moment.");
        } else if (cat.type === "timeout") {
          setError("Upload timed out after 75s. The backend may still be starting up. Please try again.");
        } else {
          setError(cat.message || "Failed to upload file.");
        }
      }
    } finally {
      setLoading(false);
      setSelectedFile(null);
      setUploadProgress(0);
      abortControllerRef.current = null;
    }
  };

  const handleCancelUpload = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setLoading(false);
    setSelectedFile(null);
    setUploadProgress(0);
    setError("Upload cancelled by user.");
  };

  const handleUploadFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processUpload(file);
      e.target.value = "";
    }
  };

  const handleUploadCSV = handleUploadFile;

  // Filter curated list
  const filteredCurated = curatedList.filter((item) => {
    if (filters.task.length > 0 && !filters.task.some((t) => item.task.toLowerCase().includes(t.toLowerCase()))) {
      return false;
    }
    if (item.rows > filters.maxRows) {
      return false;
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8 pb-28 sm:pb-32">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border">
          <div className="space-y-1">
            <div className="flex items-center space-x-2 text-xs font-mono text-emerald-600 dark:text-emerald-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Dataset Explorer &amp; Data Lake Ingestion</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Dataset Discovery
            </h1>
          </div>

          {/* Controls */}
          <div className="flex items-center space-x-2">
            <div className="p-1 rounded-xl bg-card border border-border flex items-center space-x-1 shadow-sm">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-1.5 rounded-lg text-xs font-medium transition-colors ${
                  viewMode === "grid" ? "bg-muted text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
                title="Grid view"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-1.5 rounded-lg text-xs font-medium transition-colors ${
                  viewMode === "list" ? "bg-muted text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
                title="List view"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Source Navigation Tabs */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveTab("curated")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === "curated"
                ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/30"
                : "bg-card hover:bg-muted text-muted-foreground hover:text-foreground border border-border"
            }`}
          >
            Curated Benchmarks ({curatedList.length})
          </button>
          <button
            onClick={() => {
              setActiveTab("hf");
              if (hfResults.length === 0) handleSearchHF();
            }}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === "hf"
                ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/30"
                : "bg-card hover:bg-muted text-muted-foreground hover:text-foreground border border-border"
            }`}
          >
            Hugging Face Hub
          </button>
          <button
            onClick={() => setActiveTab("csv")}
            data-testid="tab-upload"
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === "csv"
                ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/30"
                : "bg-card hover:bg-muted text-muted-foreground hover:text-foreground border border-border"
            }`}
          >
            Upload File (CSV, Excel, JSON, PDF, SQL)
          </button>
        </div>

        {/* Notification Banners */}
        {isOfflineMode && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-200 text-xs flex items-center justify-between animate-in fade-in">
            <div className="flex items-center space-x-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
              <span>
                <strong>Offline / Local Mode:</strong> Dataset restored from browser IndexedDB storage. Backend is currently offline or sleeping; remote actions are paused until reconnected.
              </span>
            </div>
            <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 font-mono text-[10px] uppercase font-bold shrink-0 ml-2">
              LOCAL CACHE
            </span>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs flex items-center space-x-2.5 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {successMsg && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs flex items-center space-x-2.5 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* TAB 1: CURATED BENCHMARKS */}
        {activeTab === "curated" && (
          <div className="space-y-4">
            {viewMode === "grid" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredCurated.map((item) => {
                  const isCurrentActive = activeDataset?.metadata?.id === item.id;
                  return (
                    <div
                      key={item.id}
                      className={`rounded-2xl border p-5 flex flex-col justify-between space-y-4 transition-all duration-200 ${
                        isCurrentActive
                          ? "border-emerald-500/60 bg-emerald-500/10 ring-1 ring-emerald-500/30"
                          : "border-border bg-card hover:border-emerald-500/40 hover:bg-muted/40 shadow-sm"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono font-medium uppercase px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border tracking-wider">
                          {item.task}
                        </span>
                        {isCurrentActive && (
                          <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center space-x-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span>Active in Memory</span>
                          </span>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <h3 className="font-semibold text-base text-foreground tracking-tight">{item.name}</h3>
                        <p className="text-xs text-muted-foreground font-normal leading-relaxed line-clamp-2">
                          {item.description}
                        </p>
                      </div>

                      <div className="pt-3 border-t border-border flex items-center justify-between text-xs">
                        <span className="font-mono text-xs text-muted-foreground font-medium">
                          {item.rows.toLocaleString()} rows • {item.cols} cols
                        </span>
                        <button
                          onClick={() => handleLoadCurated(item.id)}
                          disabled={loading}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center space-x-1 ${
                            isCurrentActive
                              ? "bg-muted text-foreground hover:bg-muted/80 border border-border"
                              : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm shadow-emerald-600/25"
                          }`}
                        >
                          <span>{isCurrentActive ? "Reload" : "Mount"}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* List View */
              <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase text-[11px] font-mono">
                    <tr>
                      <th className="p-3.5">Dataset</th>
                      <th className="p-3.5">Task</th>
                      <th className="p-3.5">Rows</th>
                      <th className="p-3.5">Cols</th>
                      <th className="p-3.5">Target</th>
                      <th className="p-3.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredCurated.map((item) => (
                      <tr key={item.id} className="hover:bg-muted/40 transition-colors">
                        <td className="p-3.5 font-semibold text-foreground">
                          <div className="flex items-center space-x-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            <span>{item.name}</span>
                          </div>
                        </td>
                        <td className="p-3.5">
                          <span className="text-[11px] px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                            {item.task}
                          </span>
                        </td>
                        <td className="p-3.5 font-mono text-foreground">{item.rows.toLocaleString()}</td>
                        <td className="p-3.5 font-mono text-foreground">{item.cols}</td>
                        <td className="p-3.5 font-mono text-muted-foreground">{item.target || "Auto-detect"}</td>
                        <td className="p-3.5 text-right">
                          <button
                            onClick={() => handleLoadCurated(item.id)}
                            disabled={loading}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-sm transition-all"
                          >
                            Mount Dataset
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: HUGGING FACE HUB */}
        {activeTab === "hf" && (
          <div className="space-y-6">
            <div className="p-5 rounded-2xl border border-border bg-card space-y-3 shadow-sm">
              <div className="text-xs font-semibold text-foreground">
                Search Public Hugging Face Hub Repositories
              </div>
              <form onSubmit={handleSearchHF} className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={hfQuery}
                    onChange={(e) => setHfQuery(e.target.value)}
                    placeholder="Search keywords: e.g. tabular, medical, finance, housing, sentiment..."
                    className="w-full bg-muted/50 border border-border rounded-xl px-4 py-2.5 text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={searching}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center space-x-2 shadow-sm shadow-emerald-600/30 transition-all"
                >
                  {searching ? <Ring className="size-4 text-white" /> : <Search className="w-4 h-4" />}
                  <span>Search Hub</span>
                </button>
              </form>

              {/* Search Shortcut Chips */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[11px] text-muted-foreground mr-1">Popular categories:</span>
                {["tabular", "healthcare", "finance", "california_housing", "iris", "sentiment"].map((chip) => (
                  <button
                    key={chip}
                    onClick={() => handleSearchHF(chip)}
                    className="px-2.5 py-1 rounded-lg bg-muted hover:bg-muted/80 text-foreground border border-border text-[11px] font-mono transition-colors"
                  >
                    #{chip}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {hfResults.map((hf) => (
                <div
                  key={hf.id}
                  className="rounded-2xl border border-border bg-card p-5 flex flex-col justify-between space-y-4 hover:border-emerald-500/40 transition-colors shadow-sm"
                >
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="font-mono truncate max-w-[170px]">{hf.author || "Community"}</span>
                    <span className="text-[11px] text-muted-foreground">♥ {hf.likes || 0}</span>
                  </div>

                  <div className="space-y-1">
                    <h4 className="font-semibold text-sm text-foreground truncate">{hf.name}</h4>
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {hf.description || "Hugging Face dataset repository available for streaming."}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-border flex items-center justify-between">
                    <span className="text-[11px] font-mono text-muted-foreground">
                      {hf.downloads?.toLocaleString() || 0} downloads
                    </span>
                    <button
                      onClick={() => handleLoadHF(hf.id)}
                      disabled={loading}
                      className="px-3 py-1.5 rounded-lg bg-card hover:bg-muted text-foreground border border-border text-xs font-semibold transition-colors flex items-center space-x-1"
                    >
                      <span>Stream Dataset</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: MULTI-FORMAT UPLOAD & DRAG-AND-DROP */}
        {activeTab === "csv" && (
          <div className="space-y-6">
            <div
              onDragEnter={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDragging(true);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDragging(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDragging(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDragging(false);
                const droppedFile = e.dataTransfer.files?.[0];
                if (droppedFile) processUpload(droppedFile);
              }}
              className={`rounded-2xl border-2 border-dashed p-8 sm:p-12 text-center transition-all duration-200 shadow-sm relative ${
                isDragging
                  ? "border-emerald-500 bg-emerald-500/10 ring-2 ring-emerald-500/30 scale-[1.01]"
                  : "border-border bg-card/60 hover:border-emerald-500/50 hover:bg-card"
              }`}
            >
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-4">
                <UploadCloud className={`w-7 h-7 transition-transform ${isDragging ? "scale-110" : ""}`} />
              </div>

              <div className="space-y-2 mb-6">
                <h3 className="font-bold text-base text-foreground">
                  {isDragging ? "Drop your dataset file here" : "Drag & Drop or Upload Dataset"}
                </h3>
                <p className="text-xs text-muted-foreground max-w-lg mx-auto leading-relaxed">
                  Native parsing engine for structured data. Automatic delimiter sniffing, multi-sheet Excel extraction, JSON records unrolling, PDF tabular line detection, and SQL DDL/INSERT statements. Files up to 25MB are parsed and cached in session store.
                </p>
              </div>

              {/* Supported Formats Pills */}
              <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
                {[
                  { label: "CSV / TSV", ext: ".csv, .tsv, .txt", color: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20" },
                  { label: "Excel Workbooks", ext: ".xlsx, .xls", color: "bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/20" },
                  { label: "JSON / JSONL", ext: ".json, .jsonl", color: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20" },
                  { label: "PDF Tables", ext: ".pdf", color: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20" },
                  { label: "SQL Dumps", ext: ".sql", color: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/20" },
                ].map((fmt) => (
                  <span
                    key={fmt.label}
                    className={`text-[11px] font-mono px-2.5 py-1 rounded-full border ${fmt.color} font-medium`}
                  >
                    {fmt.label} <span className="opacity-70">({fmt.ext})</span>
                  </span>
                ))}
              </div>

              {/* Upload Action / Active File In-Progress */}
              {loading && selectedFile ? (
                <div className="max-w-md mx-auto p-4 rounded-xl border border-emerald-500/40 bg-emerald-500/5 space-y-3">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="font-semibold text-foreground truncate max-w-[200px]">{selectedFile.name}</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-emerald-600 h-2 rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="animate-pulse">{uploadStage}</span>
                    <button
                      onClick={handleCancelUpload}
                      className="text-rose-500 hover:text-rose-600 font-medium inline-flex items-center space-x-1"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Cancel</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                  <label className="inline-flex items-center space-x-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs cursor-pointer shadow-md shadow-emerald-600/30 transition-all active:scale-95">
                    <Upload className="w-4 h-4" />
                    <span>Choose File to Upload</span>
                    <input
                      type="file"
                      accept=".csv,.tsv,.txt,.xlsx,.xls,.json,.jsonl,.pdf,.sql"
                      onChange={handleUploadFile}
                      className="hidden"
                    />
                  </label>
                  <span className="text-xs text-muted-foreground font-mono">or drag &amp; drop file here (Max 25 MB)</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ACTIVE DATASET PREVIEW TABLE */}
        {activeDataset && (
          <div className="rounded-2xl border border-border bg-card overflow-hidden space-y-0 shadow-sm">
            {/* Table Header Bar */}
            <div className="p-4 sm:p-5 bg-muted/40 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-0.5">
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="font-semibold text-sm text-foreground">
                    Active Dataset: {activeDataset.metadata?.name || activeDataset.metadata?.id}
                  </span>
                  <span className="text-xs font-mono text-muted-foreground">
                    ({activeDataset.total_rows.toLocaleString()} rows × {activeDataset.total_cols} columns)
                  </span>
                </div>
                <div className="text-xs text-muted-foreground font-mono">
                  Memory: {activeDataset.memory_mb.toFixed(2)} MB • Source: {activeDataset.metadata?.source?.toUpperCase() || "UPLOAD"}
                </div>
              </div>

              <div className="flex items-center space-x-2.5">
                <Link
                  href="/quality"
                  className="px-3.5 py-1.5 rounded-lg bg-card hover:bg-muted text-foreground text-xs font-semibold border border-border transition-colors flex items-center space-x-1.5 shadow-sm"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Quality Audit</span>
                </Link>
                <Link
                  href="/studio"
                  className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition-colors flex items-center space-x-1.5"
                >
                  <Cpu className="w-3.5 h-3.5" />
                  <span>Train in Studio</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {/* Matrix Data Viewer */}
            <div className="overflow-x-auto max-h-[400px]">
              <table className="w-full text-left text-xs font-mono border-collapse">
                <thead className="bg-muted/80 sticky top-0 border-b border-border text-foreground">
                  <tr>
                    <th className="p-3 border-r border-border text-muted-foreground text-center w-12">#</th>
                    {activeDataset.columns.map((col) => (
                      <th key={col.name} className="p-3 border-r border-border font-medium">
                        <div className="text-foreground font-semibold">{col.name}</div>
                        <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-normal">{col.dtype}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-card">
                  {activeDataset.records.slice(0, 10).map((row, idx) => (
                    <tr key={idx} className="hover:bg-muted/30">
                      <td className="p-3 border-r border-border text-center text-muted-foreground font-medium">
                        {idx + 1}
                      </td>
                      {activeDataset.columns.map((col) => (
                        <td key={col.name} className="p-3 border-r border-border text-foreground">
                          {row[col.name] !== null && row[col.name] !== undefined ? (
                            String(row[col.name])
                          ) : (
                            <span className="text-rose-500/80 italic font-normal">NULL</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-3 bg-muted/30 border-t border-border text-xs font-mono text-muted-foreground flex justify-between">
              <span>Showing preview sample of first 10 rows</span>
              <span>Total cells: {(activeDataset.total_rows * activeDataset.total_cols).toLocaleString()}</span>
            </div>
          </div>
        )}
      </div>

      {/* Floating Command Dock */}
      <RetroDock
        filters={filters}
        onFilterChange={setFilters}
        viewMode={viewMode}
        onToggleView={() => setViewMode((v) => (v === "grid" ? "list" : "grid"))}
      />
    </div>
  );
}
