"use client";

import { useState, useEffect } from "react";
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
} from "lucide-react";
import { api } from "@/lib/api";
import { CuratedDatasetItem, HFDatasetCard, DatasetPreviewResponse } from "@/lib/types";
import { RetroDock } from "@/components/retro-dock";
import { FilterState } from "@/components/retro-filter-drawer";
import {
  RetroMonitorIcon,
  RetroHeartDocIcon,
  RetroRobotIcon,
  RetroRocketIcon,
  RetroFolderGlobeIcon,
  RetroMacCoinIcon,
  RetroTerminalIcon,
  RetroCashIcon,
  RetroMicroscopeIcon,
  RetroPuzzleHeartIcon,
  RetroUsersIcon,
  RetroHFIcon,
  RetroDisketteIcon,
} from "@/components/retro-icons";

const CURATED_ICON_MAP: Record<string, any> = {
  iris: RetroHeartDocIcon,
  california_housing: RetroFolderGlobeIcon,
  wine_quality: RetroMonitorIcon,
  diabetes: RetroPuzzleHeartIcon,
  titanic: RetroUsersIcon,
};

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
    api.getActiveDataset("default").then(setActiveDataset).catch(() => null);
  }, []);

  const handleLoadCurated = async (id: string) => {
    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const data = await api.loadCuratedDataset(id, "default");
      setActiveDataset(data);
      setSuccessMsg(`Benchmark '${data.metadata.name}' loaded (${data.total_rows} rows, ${data.total_cols} cols).`);
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
      const data = await api.loadHFDataset(datasetName, "train", 2000, "default");
      setActiveDataset(data);
      setSuccessMsg(`Streamed '${datasetName}' via HF Dataset API (${data.total_rows} rows).`);
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
      const data = await api.uploadCSV(file, "default");
      setActiveDataset(data);
      setSuccessMsg(`Parsed CSV '${file.name}' (${data.total_rows} rows, ${data.total_cols} cols).`);
    } catch (err: any) {
      setError(err?.response?.data?.detail || err.message || "Failed to upload CSV file.");
    } finally {
      setLoading(false);
    }
  };

  // Filter curated list based on filter state
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
    <div className="min-h-screen bg-[#0C0C0E] text-white p-4 sm:p-6 lg:p-8 bg-retro-grid selection:bg-[#1864FF] selection:text-white">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Workstation Title Header */}
        <div className="retro-window-dark p-4 border border-zinc-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-[#1864FF] font-mono text-xs font-bold uppercase tracking-wider">
                <span className="w-2 h-2 bg-[#1864FF] inline-block" />
                <span>MODULE_02 // DATA LAKE & BENCHMARK DISCOVERY</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-mono font-bold tracking-tight text-white uppercase">
                DATASET EXPLORER
              </h1>
            </div>

            {/* View Switcher & Action Tabs */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}
                className="btn-retro btn-retro-dark text-xs flex items-center gap-1.5"
              >
                {viewMode === "grid" ? <List className="w-3.5 h-3.5" /> : <LayoutGrid className="w-3.5 h-3.5" />}
                <span>VIEW: {viewMode.toUpperCase()}</span>
              </button>
            </div>
          </div>

          {/* Source Tabs */}
          <div className="flex flex-wrap gap-2 pt-4">
            <button
              onClick={() => setActiveTab("curated")}
              className={`px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider border transition-all ${
                activeTab === "curated"
                  ? "bg-[#1864FF] text-white border-white shadow-[2px_2px_0px_0px_#FFF]"
                  : "bg-zinc-900 text-zinc-400 border-zinc-700 hover:text-white"
              }`}
            >
              [1] CURATED BENCHMARKS ({curatedList.length})
            </button>
            <button
              onClick={() => {
                setActiveTab("hf");
                if (hfResults.length === 0) handleSearchHF();
              }}
              className={`px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider border transition-all ${
                activeTab === "hf"
                  ? "bg-[#1864FF] text-white border-white shadow-[2px_2px_0px_0px_#FFF]"
                  : "bg-zinc-900 text-zinc-400 border-zinc-700 hover:text-white"
              }`}
            >
              [2] HUGGING FACE HUB
            </button>
            <button
              onClick={() => setActiveTab("csv")}
              className={`px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider border transition-all ${
                activeTab === "csv"
                  ? "bg-[#1864FF] text-white border-white shadow-[2px_2px_0px_0px_#FFF]"
                  : "bg-zinc-900 text-zinc-400 border-zinc-700 hover:text-white"
              }`}
            >
              [3] LOCAL CSV DISKETTE
            </button>
          </div>
        </div>

        {/* Notifications / Error Banner */}
        {error && (
          <div className="p-3 bg-red-950/80 border border-red-500 text-red-200 font-mono text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>ERROR: {error}</span>
          </div>
        )}
        {successMsg && (
          <div className="p-3 bg-emerald-950/80 border border-[#9AE6B4] text-[#9AE6B4] font-mono text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#9AE6B4] shrink-0" />
            <span>SUCCESS: {successMsg}</span>
          </div>
        )}

        {/* TAB 1: CURATED BENCHMARKS */}
        {activeTab === "curated" && (
          <div className="space-y-4">
            {viewMode === "grid" ? (
              /* Retro Desktop Icon Grid */
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {filteredCurated.map((item) => {
                  const Icon = CURATED_ICON_MAP[item.id] || RetroMonitorIcon;
                  const isCurrentActive = activeDataset?.metadata?.id === item.id;
                  return (
                    <div
                      key={item.id}
                      onClick={() => handleLoadCurated(item.id)}
                      className={`retro-window-dark p-4 flex flex-col justify-between cursor-pointer group transition-transform hover:-translate-y-1 ${
                        isCurrentActive ? "border-[#1864FF] ring-2 ring-[#1864FF]" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                        <span className="font-mono text-[10px] uppercase font-bold text-zinc-400">
                          {item.task}
                        </span>
                        {isCurrentActive && (
                          <span className="text-[10px] bg-[#1864FF] text-white px-1 font-mono font-bold">
                            LOADED
                          </span>
                        )}
                      </div>

                      <div className="py-4 flex flex-col items-center text-center space-y-2">
                        <div className="group-hover:scale-110 transition-transform">
                          <Icon size={44} />
                        </div>
                        <div className="font-bold text-sm text-white group-hover:text-[#1864FF] transition-colors">
                          {item.name}
                        </div>
                        <p className="text-zinc-500 text-[11px] line-clamp-2">
                          {item.description}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-zinc-800 flex items-center justify-between font-mono text-[11px] text-zinc-400">
                        <span>{item.rows.toLocaleString()} ROWS</span>
                        <div className="retro-pill active text-[10px] py-0.5 px-1.5">
                          <span>LOAD</span>
                          <span>↗</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Retro Monospace Table List */
              <div className="retro-window-dark overflow-x-auto border border-zinc-800">
                <table className="w-full text-left font-mono text-xs">
                  <thead className="bg-zinc-900 border-b border-zinc-800 text-zinc-400 uppercase text-[11px]">
                    <tr>
                      <th className="p-3">DATASET IDENTIFIER</th>
                      <th className="p-3">TASK</th>
                      <th className="p-3">ROWS</th>
                      <th className="p-3">COLS</th>
                      <th className="p-3">TARGET</th>
                      <th className="p-3 text-right">ACTION</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {filteredCurated.map((item) => (
                      <tr key={item.id} className="hover:bg-zinc-900/60 transition-colors">
                        <td className="p-3 font-bold text-white flex items-center gap-2">
                          <span className="w-2 h-2 bg-[#1864FF]" />
                          <span>{item.name}</span>
                        </td>
                        <td className="p-3 text-[#9AE6B4] uppercase">{item.task}</td>
                        <td className="p-3 text-zinc-300">{item.rows.toLocaleString()}</td>
                        <td className="p-3 text-zinc-300">{item.cols}</td>
                        <td className="p-3 text-zinc-400">{item.target || "Auto-detect"}</td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => handleLoadCurated(item.id)}
                            className="btn-retro btn-retro-blue text-[10px] py-1 px-2.5"
                          >
                            SELECT & INGEST
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
          <div className="space-y-4">
            <div className="retro-window-dark p-4 border border-zinc-800 space-y-3">
              <div className="text-xs font-mono font-bold text-zinc-400 uppercase">
                QUERY HUGGING FACE DATASET VIEWER API
              </div>
              <form onSubmit={handleSearchHF} className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={hfQuery}
                    onChange={(e) => setHfQuery(e.target.value)}
                    placeholder="Search keywords e.g. tabular, medical, housing, fraud..."
                    className="w-full bg-zinc-900 border border-zinc-700 p-2.5 font-mono text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#1864FF]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={searching}
                  className="btn-retro btn-retro-blue px-4 py-2.5 flex items-center gap-2"
                >
                  {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  <span>SEARCH HUB</span>
                </button>
              </form>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {hfResults.map((hf) => (
                <div
                  key={hf.id}
                  className="retro-window-dark p-4 flex flex-col justify-between space-y-3 border border-zinc-800 hover:border-zinc-700"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                    <span className="font-mono text-[10px] text-zinc-400 uppercase truncate max-w-[180px]">
                      {hf.author}
                    </span>
                    <RetroHFIcon size={20} />
                  </div>

                  <div className="space-y-1">
                    <div className="font-bold text-sm text-white truncate">{hf.name}</div>
                    <p className="text-zinc-500 text-xs line-clamp-2">{hf.description || "Hugging Face dataset"}</p>
                  </div>

                  <div className="pt-2 border-t border-zinc-800 flex items-center justify-between font-mono text-[11px]">
                    <span className="text-zinc-400">♥ {hf.likes || 0}</span>
                    <button
                      onClick={() => handleLoadHF(hf.id)}
                      disabled={loading}
                      className="retro-pill active text-[10px]"
                    >
                      <span>STREAM DATASET</span>
                      <span>↗</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: CSV FILE UPLOAD */}
        {activeTab === "csv" && (
          <div className="retro-window-dark p-8 border border-zinc-800 text-center space-y-4">
            <div className="flex justify-center">
              <RetroDisketteIcon size={64} />
            </div>
            <div className="space-y-1">
              <h3 className="font-mono text-base font-bold text-white uppercase">
                FLOPPY_DRIVE_A:\ INSERT LOCAL CSV FILE
              </h3>
              <p className="font-mono text-xs text-zinc-400 max-w-md mx-auto">
                Sniffs commas, tabs, semicolons, and pipes automatically. Maximum 50MB. Prepares instant in-memory session.
              </p>
            </div>

            <div className="pt-4 flex justify-center">
              <label className="btn-retro btn-retro-blue text-xs py-3 px-6 cursor-pointer flex items-center gap-2">
                <Upload className="w-4 h-4" />
                <span>SELECT CSV FROM LOCAL MACHINE</span>
                <input type="file" accept=".csv,.txt" onChange={handleUploadCSV} className="hidden" />
              </label>
            </div>
          </div>
        )}

        {/* ACTIVE DATASET PREVIEW TABLE (Lotus 1-2-3 / Retro Spreadsheet Style) */}
        {activeDataset && (
          <div className="retro-window-dark border border-zinc-800 overflow-hidden space-y-0">
            {/* Table Header Bar */}
            <div className="p-4 bg-zinc-900 border-b border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-[#9AE6B4] inline-block" />
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-white">
                  ACTIVE_MEMORY: {activeDataset.metadata?.name || activeDataset.metadata?.id}
                </span>
                <span className="text-zinc-500 font-mono text-xs">
                  ({activeDataset.total_rows.toLocaleString()} ROWS × {activeDataset.total_cols} COLS)
                </span>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href="/quality"
                  className="btn-retro btn-retro-dark text-[11px] py-1 px-3 flex items-center gap-1.5"
                >
                  <span>RUN QUALITY PROFILER</span>
                  <span>↗</span>
                </a>
                <a
                  href="/studio"
                  className="btn-retro btn-retro-blue text-[11px] py-1 px-3 flex items-center gap-1.5"
                >
                  <span>PROCEED TO ML STUDIO</span>
                  <span>↗</span>
                </a>
              </div>
            </div>

            {/* Matrix Data Viewer */}
            <div className="overflow-x-auto max-h-[380px]">
              <table className="w-full text-left font-mono text-xs border-collapse">
                <thead className="bg-[#121215] sticky top-0 border-b border-zinc-700 text-zinc-300">
                  <tr>
                    <th className="p-2 border-r border-zinc-800 text-zinc-500 bg-zinc-950 w-12 text-center">#</th>
                    {activeDataset.columns.map((col) => (
                      <th key={col.name} className="p-2 border-r border-zinc-800">
                        <div className="font-bold text-white uppercase">{col.name}</div>
                        <div className="text-[10px] text-[#1864FF]">{col.dtype}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800 bg-[#0C0C0E]">
                  {activeDataset.records.slice(0, 10).map((row, idx) => (
                    <tr key={idx} className="hover:bg-zinc-900/50">
                      <td className="p-2 border-r border-zinc-800 text-center text-zinc-500 bg-zinc-950/80 font-bold">
                        {idx + 1}
                      </td>
                      {activeDataset.columns.map((col) => (
                        <td key={col.name} className="p-2 border-r border-zinc-800 text-zinc-300">
                          {row[col.name] !== null && row[col.name] !== undefined
                            ? String(row[col.name])
                            : <span className="text-red-400 italic">NULL</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-2 bg-zinc-950 border-t border-zinc-800 font-mono text-[11px] text-zinc-500 flex justify-between">
              <span>SHOWING FIRST 10 RECORDS FOR MATRIX INSPECTION</span>
              <span>MEMORY ESTIMATE: {activeDataset.memory_mb.toFixed(2)} MB</span>
            </div>
          </div>
        )}
      </div>

      {/* Floating Retro Dock Toolbar */}
      <RetroDock
        filters={filters}
        onFilterChange={setFilters}
        viewMode={viewMode}
        onToggleView={() => setViewMode((v) => (v === "grid" ? "list" : "grid"))}
      />
    </div>
  );
}
