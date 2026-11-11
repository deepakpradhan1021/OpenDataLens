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
  Loader2,
  ExternalLink,
  Layers,
  Sparkles,
  LayoutGrid,
  List,
  Cpu,
  ShieldCheck,
  FileSpreadsheet,
} from "lucide-react";
import { api } from "@/lib/api";
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
      setError(err?.response?.data?.detail || err.message || "Failed to load curated dataset.");
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
      setError(err?.response?.data?.detail || err.message || "Failed to search Hugging Face.");
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
      setError(err?.response?.data?.detail || err.message || "Failed to load Hugging Face dataset.");
    } finally {
      setLoading(false);
    }
  };

  const handleUploadCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const data = await api.uploadCSV(file);
      setActiveDataset(data);
      setSuccessMsg(`Parsed CSV '${file.name}' (${data.total_rows.toLocaleString()} rows, ${data.total_cols} cols).`);
    } catch (err: any) {
      setError(err?.response?.data?.detail || err.message || "Failed to upload CSV file.");
    } finally {
      setLoading(false);
    }
  };

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
    <div className="min-h-screen bg-[#09090B] text-zinc-100 p-4 sm:p-6 lg:p-8 selection:bg-blue-600 selection:text-white">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-800">
          <div className="space-y-1">
            <div className="flex items-center space-x-2 text-xs font-mono text-blue-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              <span>Dataset Explorer &amp; Data Lake Ingestion</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Dataset Discovery
            </h1>
          </div>

          {/* Controls */}
          <div className="flex items-center space-x-2">
            <div className="p-1 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center space-x-1">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-1.5 rounded-lg text-xs font-medium transition-colors ${
                  viewMode === "grid" ? "bg-zinc-800 text-white shadow-sm" : "text-zinc-400 hover:text-white"
                }`}
                title="Grid view"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-1.5 rounded-lg text-xs font-medium transition-colors ${
                  viewMode === "list" ? "bg-zinc-800 text-white shadow-sm" : "text-zinc-400 hover:text-white"
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
                ? "bg-blue-600 text-white shadow-sm shadow-blue-600/30"
                : "bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800"
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
                ? "bg-blue-600 text-white shadow-sm shadow-blue-600/30"
                : "bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800"
            }`}
          >
            Hugging Face Hub
          </button>
          <button
            onClick={() => setActiveTab("csv")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === "csv"
                ? "bg-blue-600 text-white shadow-sm shadow-blue-600/30"
                : "bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800"
            }`}
          >
            Upload Custom CSV
          </button>
        </div>

        {/* Notification Banners */}
        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-200 text-xs flex items-center space-x-2.5 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {successMsg && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center space-x-2.5 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
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
                          ? "border-blue-500/60 bg-blue-950/15 ring-1 ring-blue-500/30"
                          : "border-zinc-800 bg-[#101014] hover:border-zinc-700 hover:bg-zinc-900/50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono font-semibold uppercase px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700/60">
                          {item.task}
                        </span>
                        {isCurrentActive && (
                          <span className="text-[10px] font-semibold text-emerald-400 flex items-center space-x-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            <span>Active in Memory</span>
                          </span>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <h3 className="font-semibold text-base text-white">{item.name}</h3>
                        <p className="text-xs text-zinc-400 leading-relaxed line-clamp-2">
                          {item.description}
                        </p>
                      </div>

                      <div className="pt-3 border-t border-zinc-800/80 flex items-center justify-between text-xs">
                        <span className="font-mono text-zinc-500">
                          {item.rows.toLocaleString()} rows • {item.cols} cols
                        </span>
                        <button
                          onClick={() => handleLoadCurated(item.id)}
                          disabled={loading}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center space-x-1 ${
                            isCurrentActive
                              ? "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                              : "bg-blue-600 hover:bg-blue-500 text-white shadow-sm shadow-blue-600/25"
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
              <div className="rounded-2xl border border-zinc-800 bg-[#101014] overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-900/60 border-b border-zinc-800 text-zinc-400 uppercase text-[11px] font-mono">
                    <tr>
                      <th className="p-3.5">Dataset</th>
                      <th className="p-3.5">Task</th>
                      <th className="p-3.5">Rows</th>
                      <th className="p-3.5">Cols</th>
                      <th className="p-3.5">Target</th>
                      <th className="p-3.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/80">
                    {filteredCurated.map((item) => (
                      <tr key={item.id} className="hover:bg-zinc-900/40 transition-colors">
                        <td className="p-3.5 font-semibold text-white">
                          <div className="flex items-center space-x-2">
                            <span className="w-2 h-2 rounded-full bg-blue-500" />
                            <span>{item.name}</span>
                          </div>
                        </td>
                        <td className="p-3.5">
                          <span className="text-[11px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                            {item.task}
                          </span>
                        </td>
                        <td className="p-3.5 font-mono text-zinc-300">{item.rows.toLocaleString()}</td>
                        <td className="p-3.5 font-mono text-zinc-300">{item.cols}</td>
                        <td className="p-3.5 font-mono text-zinc-400">{item.target || "Auto-detect"}</td>
                        <td className="p-3.5 text-right">
                          <button
                            onClick={() => handleLoadCurated(item.id)}
                            disabled={loading}
                            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-sm transition-all"
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
            <div className="p-5 rounded-2xl border border-zinc-800 bg-[#101014] space-y-3">
              <div className="text-xs font-semibold text-zinc-300">
                Search Public Hugging Face Hub Repositories
              </div>
              <form onSubmit={handleSearchHF} className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={hfQuery}
                    onChange={(e) => setHfQuery(e.target.value)}
                    placeholder="Search keywords: e.g. tabular, medical, finance, housing, sentiment..."
                    className="w-full bg-zinc-900/80 border border-zinc-700/80 rounded-xl px-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={searching}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center space-x-2 shadow-sm shadow-blue-600/30 transition-all"
                >
                  {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  <span>Search Hub</span>
                </button>
              </form>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {hfResults.map((hf) => (
                <div
                  key={hf.id}
                  className="rounded-2xl border border-zinc-800 bg-[#101014] p-5 flex flex-col justify-between space-y-4 hover:border-zinc-700 transition-colors"
                >
                  <div className="flex items-center justify-between text-xs text-zinc-400">
                    <span className="font-mono truncate max-w-[170px]">{hf.author || "Community"}</span>
                    <span className="text-[11px] text-zinc-500">♥ {hf.likes || 0}</span>
                  </div>

                  <div className="space-y-1">
                    <h4 className="font-semibold text-sm text-white truncate">{hf.name}</h4>
                    <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                      {hf.description || "Hugging Face dataset repository available for streaming."}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-zinc-800 flex items-center justify-between">
                    <span className="text-[11px] font-mono text-zinc-500">
                      {hf.downloads?.toLocaleString() || 0} downloads
                    </span>
                    <button
                      onClick={() => handleLoadHF(hf.id)}
                      disabled={loading}
                      className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold transition-colors flex items-center space-x-1"
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

        {/* TAB 3: CSV UPLOAD */}
        {activeTab === "csv" && (
          <div className="rounded-2xl border-2 border-dashed border-zinc-700/80 bg-[#101014]/60 p-12 text-center space-y-5">
            <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto">
              <Upload className="w-7 h-7" />
            </div>

            <div className="space-y-1.5">
              <h3 className="font-bold text-base text-white">Upload Custom CSV or Delimited File</h3>
              <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
                Automatic delimiter sniffing for commas, tabs, semicolons, and pipes. Files up to 50MB are parsed and cached in your session store.
              </p>
            </div>

            <div className="pt-2">
              <label className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs cursor-pointer shadow-md shadow-blue-600/30 transition-all">
                <Upload className="w-4 h-4" />
                <span>Select CSV from Computer</span>
                <input type="file" accept=".csv,.txt" onChange={handleUploadCSV} className="hidden" />
              </label>
            </div>
          </div>
        )}

        {/* ACTIVE DATASET PREVIEW TABLE */}
        {activeDataset && (
          <div className="rounded-2xl border border-zinc-800 bg-[#101014] overflow-hidden space-y-0">
            {/* Table Header Bar */}
            <div className="p-4 sm:p-5 bg-zinc-900/50 border-b border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-0.5">
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="font-semibold text-sm text-white">
                    Active Dataset: {activeDataset.metadata?.name || activeDataset.metadata?.id}
                  </span>
                  <span className="text-xs font-mono text-zinc-400">
                    ({activeDataset.total_rows.toLocaleString()} rows × {activeDataset.total_cols} columns)
                  </span>
                </div>
                <div className="text-xs text-zinc-500 font-mono">
                  Memory: {activeDataset.memory_mb.toFixed(2)} MB • Source: {activeDataset.metadata?.source?.toUpperCase() || "CSV"}
                </div>
              </div>

              <div className="flex items-center space-x-2.5">
                <Link
                  href="/quality"
                  className="px-3.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white text-xs font-semibold border border-zinc-700 transition-colors flex items-center space-x-1.5"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Quality Audit</span>
                </Link>
                <Link
                  href="/studio"
                  className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-colors flex items-center space-x-1.5"
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
                <thead className="bg-zinc-950 sticky top-0 border-b border-zinc-800 text-zinc-300">
                  <tr>
                    <th className="p-3 border-r border-zinc-800/80 text-zinc-500 text-center w-12">#</th>
                    {activeDataset.columns.map((col) => (
                      <th key={col.name} className="p-3 border-r border-zinc-800/80 font-medium">
                        <div className="text-white font-semibold">{col.name}</div>
                        <div className="text-[10px] text-blue-400 font-normal">{col.dtype}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 bg-[#0A0A0D]">
                  {activeDataset.records.slice(0, 10).map((row, idx) => (
                    <tr key={idx} className="hover:bg-zinc-900/40">
                      <td className="p-3 border-r border-zinc-800/60 text-center text-zinc-500 font-medium">
                        {idx + 1}
                      </td>
                      {activeDataset.columns.map((col) => (
                        <td key={col.name} className="p-3 border-r border-zinc-800/60 text-zinc-300">
                          {row[col.name] !== null && row[col.name] !== undefined ? (
                            String(row[col.name])
                          ) : (
                            <span className="text-red-400/80 italic font-normal">NULL</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-3 bg-zinc-950 border-t border-zinc-800 text-xs font-mono text-zinc-500 flex justify-between">
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
