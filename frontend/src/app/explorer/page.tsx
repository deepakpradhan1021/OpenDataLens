"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Database,
  Search,
  Upload,
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
} from "lucide-react";
import { Ring } from "@/components/loading-ui/ring";
import { api, categorizeApiError } from "@/lib/api";
import { CuratedDatasetItem, HFDatasetCard, DatasetPreviewResponse } from "@/lib/types";
import { RetroDock } from "@/components/retro-dock";
import { FilterState } from "@/components/retro-filter-drawer";

export default function ExplorerPage() {
  const [activeTab, setActiveTab] = useState<"curated" | "hf" | "csv">("curated");
  const [curatedList, setCuratedList] = useState<CuratedDatasetItem[]>([]);
  const [hfQuery, setHfQuery] = useState("tabular");
  const [hfResults, setHfResults] = useState<HFDatasetCard[]>([]);
  const [activeDataset, setActiveDataset] = useState<DatasetPreviewResponse | null>(null);

  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

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
    api.getActiveDataset().then(setActiveDataset).catch(() => null);
  }, []);

  const handleLoadCurated = async (id: string) => {
    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const data = await api.loadCuratedDataset(id);
      setActiveDataset(data);
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

  const handleSearchHF = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSearching(true);
    setError(null);
    try {
      const data = await api.searchHFDatasets(hfQuery, 9);
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

  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || loading) return;
    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const data = await api.uploadFile(file);
      setActiveDataset(data);
      const ext = file.name.split(".").pop()?.toUpperCase() || "FILE";
      setSuccessMsg(`Parsed ${ext} '${file.name}' successfully (${data.total_rows.toLocaleString()} rows, ${data.total_cols} cols).`);
    } catch (err: any) {
      const cat = categorizeApiError(err);
      if (cat.type === "cold_start") {
        setError("Waking up the backend. This may take up to 50 seconds on Render's free tier. Please upload your file again in a moment.");
      } else if (cat.type === "timeout") {
        setError("Upload timed out after 75s. The backend may still be starting up. Please try again.");
      } else {
        setError(cat.message || "Failed to upload file.");
      }
    } finally {
      setLoading(false);
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

        {/* TAB 3: MULTI-FORMAT UPLOAD */}
        {activeTab === "csv" && (
          <div className="rounded-2xl border-2 border-dashed border-border bg-card/60 p-10 sm:p-12 text-center space-y-6 shadow-sm">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
              <Upload className="w-7 h-7" />
            </div>

            <div className="space-y-2">
              <h3 className="font-bold text-base text-foreground">Upload Dataset in Multiple Formats</h3>
              <p className="text-xs text-muted-foreground max-w-lg mx-auto leading-relaxed">
                Native parsing engine for structured data. Automatic delimiter sniffing, multi-sheet Excel extraction, JSON records unrolling, PDF tabular line detection, and SQL DDL/INSERT statements. Files up to 25MB are parsed and cached in session store.
              </p>
            </div>

            {/* Supported Formats Pills */}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
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

            <div className="pt-3">
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
