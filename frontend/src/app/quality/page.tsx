"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  AlertTriangle,
  Database,
  BarChart2,
  Table as TableIcon,
  ArrowRight,
  TrendingUp,
  Cpu,
  Layers,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Info,
  Sparkles,
  Send,
  HelpCircle,
  ChevronRight,
  Undo2,
  Redo2,
  Wand2,
  Scissors,
  Sliders,
  Trash2,
  Filter,
  History,
  Bookmark,
  BookmarkCheck,
  ArrowUpDown,
  Scale,
  Eye,
  X,
  Check,
  RotateCcw,
  Bot,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts";
import { api, categorizeApiError, getWorkspaceId } from "@/lib/api";
import {
  QualityAnalysisResponse,
  CopilotResponse,
  ColumnDistributionResponse,
  HistoryItem,
  PreviewCleanResponse,
  NamedCheckpointItem,
} from "@/lib/types";
import { RetroDock } from "@/components/retro-dock";
import { workspaceSync } from "@/lib/workspace-sync";
import { loadActiveWorkspace } from "@/lib/workspace-restore";

export default function QualityPage() {
  const [quality, setQuality] = useState<QualityAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [qualityError, setQualityError] = useState<string | null>(null);
  const [isOfflineMode, setIsOfflineMode] = useState<boolean>(false);
  const [selectedCol, setSelectedCol] = useState<string>("");
  const [distData, setDistData] = useState<ColumnDistributionResponse | null>(null);
  const [distLoading, setDistLoading] = useState(false);
  const [distError, setDistError] = useState<string | null>(null);

  // Copilot Assistant State
  const [copilotQuery, setCopilotQuery] = useState("");
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [copilotError, setCopilotError] = useState<string | null>(null);
  const [copilotResponse, setCopilotResponse] = useState<CopilotResponse | null>(null);

  // Interactive Cleaning Studio State
  const [activeCleanTool, setActiveCleanTool] = useState<
    "impute" | "duplicates" | "type" | "outliers" | "sort" | "normalize" | "drop" | "filter"
  >("impute");
  const [cleaningLoading, setCleaningLoading] = useState(false);
  const [cleaningStatus, setCleaningStatus] = useState<string | null>(null);
  const [cleaningError, setCleaningError] = useState<string | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Tool Specific Parameters
  const [imputeCol, setImputeCol] = useState("");
  const [imputeStrategy, setImputeStrategy] = useState("median");
  const [imputeConstant, setImputeConstant] = useState("");

  const [typeCol, setTypeCol] = useState("");
  const [targetType, setTargetType] = useState("numeric");

  const [outlierCol, setOutlierCol] = useState("");
  const [outlierActionType, setOutlierActionType] = useState<"clip" | "remove">("clip");
  const [outlierMethod, setOutlierMethod] = useState("iqr");
  const [outlierThreshold, setOutlierThreshold] = useState(1.5);
  const [lowerQuantile, setLowerQuantile] = useState(0.01);
  const [upperQuantile, setUpperQuantile] = useState(0.99);

  const [sortCol, setSortCol] = useState("");
  const [sortAscending, setSortAscending] = useState(true);

  const [normalizeCol, setNormalizeCol] = useState("");
  const [normalizeMethod, setNormalizeMethod] = useState("minmax");

  const [dropCol, setDropCol] = useState("");

  const [filterCol, setFilterCol] = useState("");
  const [filterOperator, setFilterOperator] = useState("==");
  const [filterVal, setFilterVal] = useState("");

  // Dry-run preview state
  const [previewData, setPreviewData] = useState<PreviewCleanResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ actionType: string; params: Record<string, any> } | null>(null);

  // Named Checkpoints state
  const [checkpoints, setCheckpoints] = useState<NamedCheckpointItem[]>([]);
  const [checkpointName, setCheckpointName] = useState("");
  const [showCheckpointModal, setShowCheckpointModal] = useState(false);
  const [checkpointLoading, setCheckpointLoading] = useState(false);
  const [activeHistoryTab, setActiveHistoryTab] = useState<"history" | "checkpoints">("history");

  const checkpointsRef = useRef<NamedCheckpointItem[]>([]);
  checkpointsRef.current = checkpoints;

  const historyItemsRef = useRef<HistoryItem[]>([]);
  historyItemsRef.current = historyItems;

  const refreshHistory = useCallback(async () => {
    try {
      const res = await api.getCleanHistory();
      setCanUndo(res.can_undo);
      setCanRedo(res.can_redo);
      setHistoryItems(res.history);

      const cpMap: Record<string, any> = {};
      checkpointsRef.current.forEach((cp) => {
        cpMap[cp.name] = {
          timestamp: cp.timestamp,
          rows: cp.rows,
          cols: cp.cols,
          last_action: cp.last_action || null,
        };
      });

      workspaceSync.queueAutoSave({
        transformations: {
          workspace_id: getWorkspaceId(),
          history: (res.history || []).map((h: any, idx: number) => ({
            step: h.step ?? idx,
            action: h.action || "Transformation",
            timestamp: typeof h.timestamp === "number" ? h.timestamp : Date.now(),
            rows: h.rows ?? 0,
            cols: h.cols ?? 0,
          })),
          named_checkpoints: cpMap,
          last_action: res.history?.[res.history.length - 1]?.action || null,
          updated_at: new Date().toISOString(),
        },
      });
    } catch {
      // Non-blocking
    }
  }, []);

  const refreshCheckpoints = useCallback(async () => {
    try {
      const res = await api.getNamedCheckpoints();
      setCheckpoints(res.checkpoints);

      const cpMap: Record<string, any> = {};
      (res.checkpoints || []).forEach((cp) => {
        cpMap[cp.name] = {
          timestamp: cp.timestamp,
          rows: cp.rows,
          cols: cp.cols,
          last_action: cp.last_action || null,
        };
      });

      workspaceSync.queueAutoSave({
        transformations: {
          workspace_id: getWorkspaceId(),
          history: (historyItemsRef.current || []).map((h: any, idx: number) => ({
            step: h.step ?? idx,
            action: h.action || "Transformation",
            timestamp: typeof h.timestamp === "number" ? h.timestamp : Date.now(),
            rows: h.rows ?? 0,
            cols: h.cols ?? 0,
          })),
          named_checkpoints: cpMap,
          last_action: historyItemsRef.current?.[historyItemsRef.current.length - 1]?.action || null,
          updated_at: new Date().toISOString(),
        },
      });
    } catch {
      // Non-blocking
    }
  }, []);

  const fetchQuality = useCallback(async () => {
    setLoading(true);
    setQualityError(null);
    try {
      const q = await api.getQualityAnalysis();
      setQuality(q);
      setIsOfflineMode(false);
      const cols = Object.keys(q.missing_summary);
      if (cols.length > 0) {
        setSelectedCol((prev) => (prev && cols.includes(prev) ? prev : cols[0]));
        setImputeCol((prev) => prev || cols[0]);
        setTypeCol((prev) => prev || cols[0]);
        setOutlierCol((prev) => prev || q.column_types.numeric[0] || cols[0]);
        setSortCol((prev) => prev || cols[0]);
        setNormalizeCol((prev) => prev || q.column_types.numeric[0] || cols[0]);
        setDropCol((prev) => prev || cols[0]);
        setFilterCol((prev) => prev || cols[0]);
      }
      refreshHistory();
      refreshCheckpoints();

      workspaceSync.queueAutoSave({
        analysis_history: {
          workspace_id: getWorkspaceId(),
          quality_overview: q as any,
          updated_at: new Date().toISOString(),
        },
      });
    } catch (e: any) {
      console.error(e);
      // Attempt to restore cached quality & transformation state from IndexedDB
      try {
        const restored = await loadActiveWorkspace();
        if (restored.hasCachedData) {
          if (restored.transformations) {
            if (restored.transformations.history) {
              setHistoryItems(restored.transformations.history as any);
            }
            if (restored.transformations.named_checkpoints) {
              const cps: NamedCheckpointItem[] = Object.entries(restored.transformations.named_checkpoints).map(([name, data]: [string, any]) => ({
                name,
                timestamp: data.timestamp ?? Date.now(),
                rows: data.rows ?? 0,
                cols: data.cols ?? 0,
                last_action: data.last_action || null,
              }));
              setCheckpoints(cps);
            }
          }
          if (restored.analysisHistory?.quality_overview) {
            setQuality(restored.analysisHistory.quality_overview as any);
            setIsOfflineMode(true);
            return;
          } else if (restored.dataset && restored.dataset.columns) {
            const cols = restored.dataset.columns;
            const numCols = cols.filter(c => c.dtype.includes("int") || c.dtype.includes("float")).map(c => c.name);
            const catCols = cols.filter(c => !numCols.includes(c.name)).map(c => c.name);
            const missingSummary: Record<string, any> = {};
            let totalMissing = 0;
            cols.forEach(c => {
              missingSummary[c.name] = {
                missing_count: c.null_count || 0,
                missing_pct: c.null_count && restored.dataset ? (c.null_count / (restored.dataset.total_rows || 1)) * 100 : 0,
                dtype: c.dtype,
                unique_count: c.unique_count || 0,
              };
              totalMissing += c.null_count || 0;
            });
            const totalCells = (restored.dataset.total_rows || 1) * cols.length;
            const completenessScore = totalCells > 0 ? ((totalCells - totalMissing) / totalCells) * 100 : 100;
            setQuality({
              overview: {
                total_rows: restored.dataset.total_rows || 0,
                total_cols: cols.length,
                missing_cells: totalMissing,
                missing_pct: totalCells > 0 ? (totalMissing / totalCells) * 100 : 0,
                duplicate_rows: 0,
                duplicate_pct: 0,
                completeness_score: completenessScore,
                memory_mb: restored.dataset.memory_mb || 0,
              },
              missing_summary: missingSummary,
              column_types: { numeric: numCols, categorical: catCols, datetime: [], text: [] },
              outlier_summary: {},
              high_cardinality: [],
              high_correlation_pairs: [],
              correlation_matrix: null,
              recommendations: [],
            } as any);
            setIsOfflineMode(true);
            return;
          } else if (restored.dataset) {
            setIsOfflineMode(true);
          }
        }
      } catch (restoreErr) {
        console.warn("Quality restore from IndexedDB failed:", restoreErr);
      }

      const cat = categorizeApiError(e);
      if (cat.type === "cold_start") {
        setQualityError("Waking up the backend. This may take up to 50 seconds on Render's free tier. Click retry once awake.");
      } else if (cat.type === "timeout") {
        setQualityError("Quality audit request timed out after 75s. Click retry to query again.");
      } else {
        setQualityError(cat.message || "Failed to load quality analysis. Ensure a dataset is active in your workspace.");
      }
    } finally {
      setLoading(false);
    }
  }, [refreshHistory, refreshCheckpoints]);

  useEffect(() => {
    fetchQuality();
  }, [fetchQuality]);

  const fetchColumnDistribution = (colName: string) => {
    if (!colName) return;
    setDistLoading(true);
    setDistError(null);
    api.getColumnDistribution(colName)
      .then((res) => {
        setDistData(res);
        setDistError(null);
      })
      .catch((err: any) => {
        console.error(err);
        const cat = categorizeApiError(err);
        setDistError(cat.message || "Failed to calculate distribution histogram.");
        setDistData(null);
      })
      .finally(() => setDistLoading(false));
  };

  useEffect(() => {
    if (selectedCol) {
      fetchColumnDistribution(selectedCol);
    }
  }, [selectedCol]);

  const syncCommittedDataset = async (maxRetries: number = 2): Promise<boolean> => {
    let lastError: any = null;
    workspaceSync.setStatus("saving", "Synchronizing transformed dataset to local storage...");

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const [activeDs, fullCsv] = await Promise.all([
          api.getActiveDataset(),
          api.downloadDatasetCsvText(),
        ]);

        if (!activeDs || typeof fullCsv !== "string") {
          throw new Error("Invalid or empty dataset response from backend.");
        }

        // Commit full consistent snapshot atomically
        const saved = await workspaceSync.saveDatasetSnapshotImmediately({
          workspace_id: getWorkspaceId(),
          metadata: activeDs.metadata,
          columns: activeDs.columns,
          records: activeDs.records,
          total_rows: activeDs.total_rows,
          total_cols: activeDs.total_cols,
          memory_mb: activeDs.memory_mb,
          raw_csv: fullCsv,
          raw_csv_omitted_for_quota: false,
          is_full_dataset: true,
          is_preview_only: false,
          updated_at: new Date().toISOString(),
        });

        if (saved) {
          return true;
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`[Quality] syncCommittedDataset attempt ${attempt} failed:`, err);
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, 600));
        }
      }
    }

    console.error("[Quality] Failed to synchronize committed dataset after retries:", lastError);
    workspaceSync.setStatus(
      "error",
      "Failed to synchronize full dataset CSV. Local offline cache was not updated."
    );
    return false;
  };

  const handleApplyCleanAction = async (actionType: string, params: Record<string, any>) => {
    setCleaningLoading(true);
    setCleaningStatus(null);
    setCleaningError(null);
    try {
      const res = await api.cleanDataset(actionType, params);
      setCleaningStatus(res.action);
      setCanUndo(res.can_undo);
      setCanRedo(res.can_redo);
      await fetchQuality();
      const synced = await syncCommittedDataset();
      if (!synced) {
        setCleaningError("Transformation applied, but local offline synchronization failed. Changes are not saved locally.");
      }
    } catch (e: any) {
      console.error(e);
      const cat = categorizeApiError(e);
      setCleaningError(cat.message || "Failed to apply cleaning transformation.");
    } finally {
      setCleaningLoading(false);
    }
  };

  const handleUndo = async () => {
    if (!canUndo || cleaningLoading) return;
    setCleaningLoading(true);
    setCleaningStatus(null);
    setCleaningError(null);
    try {
      const res = await api.undoClean();
      setCleaningStatus(`Undo: ${res.action}`);
      setCanUndo(res.can_undo);
      setCanRedo(res.can_redo);
      await fetchQuality();
      const synced = await syncCommittedDataset();
      if (!synced) {
        setCleaningError("Undo applied, but local offline synchronization failed. Changes are not saved locally.");
      }
    } catch (e: any) {
      console.error(e);
      setCleaningError(e.response?.data?.detail || "Failed to undo transformation.");
    } finally {
      setCleaningLoading(false);
    }
  };

  const handleRedo = async () => {
    if (!canRedo || cleaningLoading) return;
    setCleaningLoading(true);
    setCleaningStatus(null);
    setCleaningError(null);
    try {
      const res = await api.redoClean();
      setCleaningStatus(`Redo: ${res.action}`);
      setCanUndo(res.can_undo);
      setCanRedo(res.can_redo);
      await fetchQuality();
      const synced = await syncCommittedDataset();
      if (!synced) {
        setCleaningError("Redo applied, but local offline synchronization failed. Changes are not saved locally.");
      }
    } catch (e: any) {
      console.error(e);
      setCleaningError(e.response?.data?.detail || "Failed to redo transformation.");
    } finally {
      setCleaningLoading(false);
    }
  };

  const handlePreviewCleanAction = async (actionType: string, params: Record<string, any>) => {
    setPreviewLoading(true);
    setCleaningError(null);
    try {
      const preview = await api.previewClean(actionType, params);
      setPreviewData(preview);
      setPendingAction({ actionType, params });
    } catch (e: any) {
      console.error(e);
      const cat = categorizeApiError(e);
      setCleaningError(cat.message || "Failed to generate dry-run preview.");
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleCommitPreview = async () => {
    if (!pendingAction) return;
    const actionToApply = { ...pendingAction };
    setPreviewData(null);
    setPendingAction(null);
    await handleApplyCleanAction(actionToApply.actionType, actionToApply.params);
  };

  const handleSaveCheckpoint = async () => {
    if (!checkpointName.trim()) return;
    setCheckpointLoading(true);
    setCleaningError(null);
    try {
      await api.createNamedCheckpoint(checkpointName.trim());
      setCleaningStatus(`Saved checkpoint: '${checkpointName.trim()}'`);
      setCheckpointName("");
      setShowCheckpointModal(false);
      await refreshCheckpoints();
    } catch (e: any) {
      console.error(e);
      const cat = categorizeApiError(e);
      setCleaningError(cat.message || "Failed to save named checkpoint.");
    } finally {
      setCheckpointLoading(false);
    }
  };

  const handleRestoreCheckpoint = async (name: string) => {
    setCheckpointLoading(true);
    setCleaningError(null);
    try {
      const res = await api.restoreNamedCheckpoint(name);
      setCleaningStatus(`Restored checkpoint: ${name}`);
      setCanUndo(res.can_undo);
      setCanRedo(res.can_redo);
      await fetchQuality();
      await refreshCheckpoints();
      const synced = await syncCommittedDataset();
      if (!synced) {
        setCleaningError("Checkpoint restored, but local offline synchronization failed. Changes are not saved locally.");
      }
    } catch (e: any) {
      console.error(e);
      const cat = categorizeApiError(e);
      setCleaningError(cat.message || "Failed to restore named checkpoint.");
    } finally {
      setCheckpointLoading(false);
    }
  };

  const handleDeleteCheckpoint = async (name: string) => {
    try {
      await api.deleteNamedCheckpoint(name);
      await refreshCheckpoints();
    } catch (e: any) {
      console.error(e);
    }
  };

  const handleAskCopilot = async (question?: string) => {
    const qText = question || copilotQuery;
    if (!qText.trim()) return;
    setCopilotLoading(true);
    setCopilotError(null);
    try {
      const res = await api.queryCopilot(qText);
      setCopilotResponse(res);
      workspaceSync.queueAutoSave({
        analysis_history: {
          workspace_id: getWorkspaceId(),
          copilot_history: [
            {
              role: "user",
              content: qText,
              timestamp: new Date().toISOString(),
            },
            {
              role: "assistant",
              content: res.answer || "Copilot response",
              timestamp: new Date().toISOString(),
              insights: res as any,
            },
          ],
          updated_at: new Date().toISOString(),
        },
      });
      setCopilotQuery("");
    } catch (e: any) {
      console.error(e);
      setCopilotError(e.response?.data?.detail || "Copilot failed to generate an answer. Click to retry.");
    } finally {
      setCopilotLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-8">
        <div className="p-8 rounded-2xl border border-border bg-card text-center space-y-3 shadow-md">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-500 mx-auto" />
          <div className="text-xs font-mono text-muted-foreground">
            Computing statistical moments, IQR outlier boundaries, and quality health scores...
          </div>
        </div>
      </div>
    );
  }

  if (qualityError) {
    return (
      <div className="min-h-screen bg-background text-foreground p-8 flex items-center justify-center">
        <div className="max-w-xl mx-auto rounded-2xl border border-rose-500/30 bg-card p-10 text-center space-y-5 shadow-lg">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-base font-bold text-foreground">Quality Analysis Error</h3>
            <p className="text-xs text-rose-600 dark:text-rose-300 max-w-sm mx-auto leading-relaxed">
              {qualityError}
            </p>
          </div>
          <div className="flex items-center justify-center space-x-3 pt-2">
            <button
              onClick={() => fetchQuality()}
              className="px-4 py-2 rounded-xl bg-card hover:bg-muted text-foreground text-xs font-semibold border border-border transition-colors shadow-sm"
            >
              Retry Analysis
            </button>
            <Link
              href="/explorer"
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition-all"
            >
              <span>Go to Explorer</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!quality) {
    return (
      <div className="min-h-screen bg-background text-foreground p-8 flex items-center justify-center">
        <div className="max-w-xl mx-auto rounded-2xl border border-border bg-card p-10 text-center space-y-5 shadow-lg">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-base font-bold text-foreground">No Dataset Available to Audit</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
              Mount a dataset into workspace memory via the Dataset Explorer before running statistical diagnostics.
            </p>
          </div>
          <Link
            href="/explorer"
            className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition-all"
          >
            <span>Open Dataset Explorer</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    );
  }

  const missingChartData = Object.entries(quality.missing_summary).map(([name, info]) => ({
    name,
    missingPct: info.missing_pct,
    missingCount: info.missing_count,
  }));

  const outlierEntries = quality.outliers ? Object.entries(quality.outliers) : [];
  const allColumns = Object.keys(quality.missing_summary);
  const numericColumns = quality.column_types.numeric || [];

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8 pb-28 sm:pb-32">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header Breadcrumb */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border">
          <div className="space-y-1">
            <div className="flex items-center space-x-2 text-xs font-mono text-muted-foreground mb-1">
              <Link href="/explorer" className="hover:text-foreground">Explorer</Link>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">Quality &amp; Cleaning Studio</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center space-x-3">
              <span>Data Quality Intelligence</span>
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground font-sans">
              Audit completeness, IQR numerical outliers, clean data interactively with undo/redo, and validate pre-flight ML readiness.
            </p>
          </div>

          <div className="flex items-center space-x-2.5">
            {/* Undo / Redo / History / Checkpoints Toolbar */}
            <div className="flex items-center p-1 rounded-xl bg-card border border-border shadow-sm space-x-1">
              <button
                onClick={handleUndo}
                disabled={!canUndo || cleaningLoading}
                className="p-1.5 rounded-lg text-xs font-medium text-foreground hover:bg-muted disabled:opacity-30 disabled:pointer-events-none transition-colors"
                title="Undo last transformation"
              >
                <Undo2 className="w-4 h-4" />
              </button>
              <button
                onClick={handleRedo}
                disabled={!canRedo || cleaningLoading}
                className="p-1.5 rounded-lg text-xs font-medium text-foreground hover:bg-muted disabled:opacity-30 disabled:pointer-events-none transition-colors"
                title="Redo transformation"
              >
                <Redo2 className="w-4 h-4" />
              </button>
              <div className="w-[1px] h-4 bg-border mx-1" />
              <button
                onClick={() => {
                  setShowHistoryModal(!showHistoryModal);
                  setActiveHistoryTab("history");
                }}
                className={`flex items-center space-x-1 px-2 py-1 rounded-lg text-xs font-mono transition-colors ${
                  showHistoryModal && activeHistoryTab === "history"
                    ? "bg-emerald-600/15 text-emerald-600 dark:text-emerald-400 font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
                title="View transformation history"
              >
                <History className="w-3.5 h-3.5" />
                <span>{historyItems.length}</span>
              </button>
              <button
                onClick={() => {
                  setShowHistoryModal(!showHistoryModal);
                  setActiveHistoryTab("checkpoints");
                }}
                className={`flex items-center space-x-1 px-2 py-1 rounded-lg text-xs font-mono transition-colors ${
                  showHistoryModal && activeHistoryTab === "checkpoints"
                    ? "bg-emerald-600/15 text-emerald-600 dark:text-emerald-400 font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
                title="Named checkpoints"
              >
                <Bookmark className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>{checkpoints.length}</span>
              </button>
              <div className="w-[1px] h-4 bg-border mx-1" />
              <button
                onClick={() => setShowCheckpointModal(true)}
                className="flex items-center space-x-1 px-2 py-1 rounded-lg text-xs font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors"
                title="Save current state as a named checkpoint"
              >
                <BookmarkCheck className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Save State</span>
              </button>
            </div>

            <Link
              href="/studio"
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium shadow-sm shadow-emerald-600/30 transition-all active:scale-95"
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>Proceed to ML Studio</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Save Checkpoint Modal */}
        {showCheckpointModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <div className="flex items-center space-x-2">
                  <BookmarkCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  <h3 className="font-semibold text-sm text-foreground">Save Named Checkpoint</h3>
                </div>
                <button
                  onClick={() => setShowCheckpointModal(false)}
                  className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Snapshot the current dataset state ({quality.overview.total_rows.toLocaleString()} rows × {quality.overview.total_cols} cols) so you can return to it anytime.
              </p>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Checkpoint Name</label>
                <input
                  type="text"
                  value={checkpointName}
                  onChange={(e) => setCheckpointName(e.target.value)}
                  placeholder="e.g. Pre-Outlier Cleanup, Scaled Features"
                  maxLength={60}
                  className="w-full bg-background border border-border rounded-xl p-2.5 text-xs text-foreground focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCheckpointModal(false)}
                  className="px-3.5 py-2 rounded-xl border border-border text-xs font-medium text-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveCheckpoint}
                  disabled={!checkpointName.trim() || checkpointLoading}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition-all disabled:opacity-50 flex items-center space-x-1.5"
                >
                  {checkpointLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>Save Snapshot</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* History / Checkpoints Drawer */}
        {showHistoryModal && (
          <div className="p-4 rounded-2xl border border-border bg-card shadow-lg space-y-4 animate-in fade-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setActiveHistoryTab("history")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all ${
                    activeHistoryTab === "history"
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <History className="w-3.5 h-3.5" />
                  <span>Timeline History ({historyItems.length})</span>
                </button>
                <button
                  onClick={() => setActiveHistoryTab("checkpoints")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all ${
                    activeHistoryTab === "checkpoints"
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Bookmark className="w-3.5 h-3.5" />
                  <span>Named Checkpoints ({checkpoints.length}/5)</span>
                </button>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Close
              </button>
            </div>

            {activeHistoryTab === "history" ? (
              historyItems.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">No transformations recorded yet. Use the Data Cleaning Studio below to clean and transform columns.</p>
              ) : (
                <div className="space-y-1.5 max-h-56 overflow-y-auto">
                  {historyItems.map((item) => (
                    <div key={item.step} className="p-2.5 rounded-lg bg-muted/40 border border-border/80 text-xs flex items-center justify-between">
                      <div className="space-y-0.5">
                        <span className="font-semibold text-foreground">Step {item.step}: {item.action}</span>
                        <div className="text-[11px] font-mono text-muted-foreground">
                          {item.rows.toLocaleString()} rows × {item.cols} cols
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {new Date(item.timestamp * 1000).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </div>
              )
            ) : (
              checkpoints.length === 0 ? (
                <div className="text-center py-4 space-y-2">
                  <Bookmark className="w-6 h-6 text-muted-foreground mx-auto opacity-50" />
                  <p className="text-xs text-muted-foreground">No named checkpoints saved yet.</p>
                  <button
                    onClick={() => setShowCheckpointModal(true)}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-500"
                  >
                    Save First Checkpoint
                  </button>
                </div>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {checkpoints.map((cp) => (
                    <div key={cp.name} className="p-3 rounded-xl bg-muted/40 border border-border flex items-center justify-between text-xs">
                      <div className="space-y-0.5">
                        <div className="font-bold text-foreground flex items-center space-x-1.5">
                          <BookmarkCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span>{cp.name}</span>
                        </div>
                        <div className="text-[11px] font-mono text-muted-foreground">
                          {cp.rows.toLocaleString()} rows × {cp.cols} cols &bull; {new Date(cp.timestamp * 1000).toLocaleString()}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleRestoreCheckpoint(cp.name)}
                          disabled={checkpointLoading}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center space-x-1 disabled:opacity-50"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Restore</span>
                        </button>
                        <button
                          onClick={() => handleDeleteCheckpoint(cp.name)}
                          className="p-1 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-muted"
                          title="Delete checkpoint"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        )}

        {/* Offline / Cached State Notification Banner */}
        {isOfflineMode && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-200 text-xs flex items-center justify-between animate-in fade-in">
            <div className="flex items-center space-x-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
              <span>
                <strong>Offline / Local Mode:</strong> Quality metrics restored from browser storage. Data cleaning mutations and AI Copilot require an active backend connection.
              </span>
            </div>
            <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 font-mono text-[10px] uppercase font-bold shrink-0 ml-2">
              LOCAL CACHE
            </span>
          </div>
        )}

        {/* Top 4 KPI Health Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl border border-border bg-card space-y-2 shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground text-xs font-sans font-medium">
              <span>Completeness Score</span>
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="text-3xl font-bold font-mono text-foreground">
              {quality.overview.completeness_score}%
            </div>
            <div className="text-xs text-muted-foreground font-sans">
              {quality.overview.total_missing_cells.toLocaleString()} missing cells out of{" "}
              {quality.overview.total_cells.toLocaleString()}
            </div>
          </div>

          <div className="p-5 rounded-2xl border border-border bg-card space-y-2 shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground text-xs font-sans font-medium">
              <span>Duplicate Rows</span>
              <TableIcon className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            </div>
            <div className="text-3xl font-bold font-mono text-foreground">
              {quality.overview.duplicate_rows}
            </div>
            <div className="text-xs text-muted-foreground font-sans">
              {quality.overview.duplicate_pct}% duplication rate
            </div>
          </div>

          <div className="p-5 rounded-2xl border border-border bg-card space-y-2 shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground text-xs font-sans font-medium">
              <span>Features Audited</span>
              <Layers className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="text-3xl font-bold font-mono text-foreground">
              {quality.overview.total_cols}
            </div>
            <div className="text-xs text-muted-foreground font-sans">
              {quality.column_types.numeric.length} numeric, {quality.column_types.categorical.length} categorical
            </div>
          </div>

          <div className="p-5 rounded-2xl border border-border bg-card space-y-2 shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground text-xs font-sans font-medium">
              <span>Memory Footprint</span>
              <Cpu className="w-4 h-4 text-violet-500" />
            </div>
            <div className="text-3xl font-bold font-mono text-foreground">
              {quality.overview.memory_mb} <span className="text-sm font-normal text-muted-foreground font-sans">MB</span>
            </div>
            <div className="text-xs text-muted-foreground font-sans">
              {quality.overview.total_rows.toLocaleString()} memory-resident records
            </div>
          </div>
        </div>

        {/* INTERACTIVE DATA CLEANING STUDIO */}
        <div className="rounded-2xl border border-border bg-card p-6 space-y-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <Wand2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-semibold text-sm text-foreground">Interactive Data Cleaning Studio</h3>
                <p className="text-xs text-muted-foreground">Deterministic transformations with zero leakage and instant undo/redo</p>
              </div>
            </div>

            {/* Tool Selector Pills */}
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: "impute", label: "Impute Missing" },
                { id: "duplicates", label: "Deduplicate" },
                { id: "type", label: "Cast Type" },
                { id: "outliers", label: "Outliers" },
                { id: "sort", label: "Sort Rows" },
                { id: "normalize", label: "Normalize" },
                { id: "drop", label: "Drop Column" },
                { id: "filter", label: "Filter Rows" },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveCleanTool(t.id as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activeCleanTool === t.id
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tool Parameters Form */}
          <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-4">
            {activeCleanTool === "impute" && (
              <div className="space-y-3">
                <div className="text-xs font-medium text-foreground">Impute Missing Values in Feature</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] text-muted-foreground block mb-1">Target Column</label>
                    <select
                      value={imputeCol}
                      onChange={(e) => setImputeCol(e.target.value)}
                      className="w-full bg-card border border-border rounded-lg text-xs p-2 text-foreground focus:outline-none focus:border-emerald-500"
                    >
                      {allColumns.map((col) => (
                        <option key={col} value={col}>
                          {col} ({quality.missing_summary[col]?.missing_count || 0} nulls)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] text-muted-foreground block mb-1">Imputation Strategy</label>
                    <select
                      value={imputeStrategy}
                      onChange={(e) => setImputeStrategy(e.target.value)}
                      className="w-full bg-card border border-border rounded-lg text-xs p-2 text-foreground focus:outline-none focus:border-emerald-500"
                    >
                      <option value="median">Median (Numeric robust)</option>
                      <option value="mean">Mean (Numeric standard)</option>
                      <option value="mode">Mode (Most frequent category)</option>
                      <option value="constant">Constant Value</option>
                      <option value="drop">Drop Rows with Nulls</option>
                    </select>
                  </div>

                  {imputeStrategy === "constant" && (
                    <div>
                      <label className="text-[11px] text-muted-foreground block mb-1">Constant Value</label>
                      <input
                        type="text"
                        value={imputeConstant}
                        onChange={(e) => setImputeConstant(e.target.value)}
                        placeholder="e.g. 0 or 'Unknown'"
                        className="w-full bg-card border border-border rounded-lg text-xs p-2 text-foreground focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  )}
                </div>

                <div className="flex items-center space-x-2 pt-1">
                  <button
                    onClick={() =>
                      handlePreviewCleanAction("impute_missing", {
                        column: imputeCol,
                        strategy: imputeStrategy,
                        constant_value: imputeStrategy === "constant" ? imputeConstant : undefined,
                      })
                    }
                    disabled={previewLoading || cleaningLoading}
                    className="px-3.5 py-2 rounded-lg bg-card border border-border hover:bg-muted text-foreground text-xs font-semibold shadow-sm transition-all flex items-center space-x-1.5"
                  >
                    {previewLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
                    <span>Preview Imputation</span>
                  </button>
                  <button
                    onClick={() =>
                      handleApplyCleanAction("impute_missing", {
                        column: imputeCol,
                        strategy: imputeStrategy,
                        constant_value: imputeStrategy === "constant" ? imputeConstant : undefined,
                      })
                    }
                    disabled={cleaningLoading}
                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition-all flex items-center space-x-1.5"
                  >
                    {cleaningLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                    <span>Apply Imputation</span>
                  </button>
                </div>
              </div>
            )}

            {activeCleanTool === "duplicates" && (
              <div className="space-y-3">
                <div className="text-xs font-medium text-foreground">Remove Exact Duplicate Rows</div>
                <p className="text-xs text-muted-foreground">
                  Current dataset contains <strong className="text-foreground">{quality.overview.duplicate_rows}</strong> duplicate rows ({quality.overview.duplicate_pct}%). Deduplication preserves the first occurrence of each row.
                </p>
                <div className="flex items-center space-x-2 pt-1">
                  <button
                    onClick={() => handlePreviewCleanAction("remove_duplicates", { keep: "first" })}
                    disabled={previewLoading || cleaningLoading || quality.overview.duplicate_rows === 0}
                    className="px-3.5 py-2 rounded-lg bg-card border border-border hover:bg-muted text-foreground text-xs font-semibold shadow-sm transition-all flex items-center space-x-1.5 disabled:opacity-50"
                  >
                    {previewLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
                    <span>Preview Deduplication</span>
                  </button>
                  <button
                    onClick={() => handleApplyCleanAction("remove_duplicates", { keep: "first" })}
                    disabled={cleaningLoading || quality.overview.duplicate_rows === 0}
                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition-all flex items-center space-x-1.5 disabled:opacity-50"
                  >
                    {cleaningLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Scissors className="w-3.5 h-3.5" />}
                    <span>Remove Duplicate Rows</span>
                  </button>
                </div>
              </div>
            )}

            {activeCleanTool === "type" && (
              <div className="space-y-3">
                <div className="text-xs font-medium text-foreground">Cast Column Data Type</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md">
                  <div>
                    <label className="text-[11px] text-muted-foreground block mb-1">Column</label>
                    <select
                      value={typeCol}
                      onChange={(e) => setTypeCol(e.target.value)}
                      className="w-full bg-card border border-border rounded-lg text-xs p-2 text-foreground focus:outline-none focus:border-emerald-500"
                    >
                      {allColumns.map((col) => (
                        <option key={col} value={col}>
                          {col} ({quality.missing_summary[col]?.dtype})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-muted-foreground block mb-1">Target Data Type</label>
                    <select
                      value={targetType}
                      onChange={(e) => setTargetType(e.target.value)}
                      className="w-full bg-card border border-border rounded-lg text-xs p-2 text-foreground focus:outline-none focus:border-emerald-500"
                    >
                      <option value="numeric">Numeric (Float)</option>
                      <option value="integer">Integer (Nullable Int64)</option>
                      <option value="string">String (Text)</option>
                      <option value="categorical">Categorical</option>
                      <option value="datetime">Datetime</option>
                      <option value="boolean">Boolean</option>
                    </select>
                  </div>
                </div>
                <div className="flex items-center space-x-2 pt-1">
                  <button
                    onClick={() => handlePreviewCleanAction("convert_dtype", { column: typeCol, target_dtype: targetType })}
                    disabled={previewLoading || cleaningLoading}
                    className="px-3.5 py-2 rounded-lg bg-card border border-border hover:bg-muted text-foreground text-xs font-semibold shadow-sm transition-all flex items-center space-x-1.5"
                  >
                    {previewLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
                    <span>Preview Type Cast</span>
                  </button>
                  <button
                    onClick={() => handleApplyCleanAction("convert_dtype", { column: typeCol, target_dtype: targetType })}
                    disabled={cleaningLoading}
                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition-all flex items-center space-x-1.5"
                  >
                    {cleaningLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sliders className="w-3.5 h-3.5" />}
                    <span>Convert Column Type</span>
                  </button>
                </div>
              </div>
            )}

            {activeCleanTool === "outliers" && (
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="text-xs font-medium text-foreground">Detect and Handle Outliers</div>
                  <div className="flex items-center p-0.5 rounded-lg bg-card border border-border text-xs">
                    <button
                      onClick={() => setOutlierActionType("clip")}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                        outlierActionType === "clip" ? "bg-emerald-600 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Clip / Winsorize (Preserve Rows)
                    </button>
                    <button
                      onClick={() => setOutlierActionType("remove")}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                        outlierActionType === "remove" ? "bg-emerald-600 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Drop Outlier Rows
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] text-muted-foreground block mb-1">Numeric Column</label>
                    <select
                      value={outlierCol}
                      onChange={(e) => setOutlierCol(e.target.value)}
                      className="w-full bg-card border border-border rounded-lg text-xs p-2 text-foreground focus:outline-none focus:border-emerald-500"
                    >
                      {numericColumns.map((col) => (
                        <option key={col} value={col}>{col}</option>
                      ))}
                    </select>
                  </div>

                  {outlierActionType === "clip" ? (
                    <>
                      <div>
                        <label className="text-[11px] text-muted-foreground block mb-1">Lower Quantile ({lowerQuantile})</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0.0"
                          max="0.4"
                          value={lowerQuantile}
                          onChange={(e) => setLowerQuantile(parseFloat(e.target.value) || 0.01)}
                          className="w-full bg-card border border-border rounded-lg text-xs p-2 text-foreground focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-muted-foreground block mb-1">Upper Quantile ({upperQuantile})</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0.6"
                          max="1.0"
                          value={upperQuantile}
                          onChange={(e) => setUpperQuantile(parseFloat(e.target.value) || 0.99)}
                          className="w-full bg-card border border-border rounded-lg text-xs p-2 text-foreground focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label className="text-[11px] text-muted-foreground block mb-1">Detection Method</label>
                        <select
                          value={outlierMethod}
                          onChange={(e) => setOutlierMethod(e.target.value)}
                          className="w-full bg-card border border-border rounded-lg text-xs p-2 text-foreground focus:outline-none focus:border-emerald-500"
                        >
                          <option value="iqr">Interquartile Range (IQR)</option>
                          <option value="zscore">Z-Score Standard Deviation</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[11px] text-muted-foreground block mb-1">
                          Threshold ({outlierMethod === "iqr" ? "k × IQR, e.g. 1.5" : "k × σ, e.g. 3.0"})
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          min="0.5"
                          max="5.0"
                          value={outlierThreshold}
                          onChange={(e) => setOutlierThreshold(parseFloat(e.target.value) || 1.5)}
                          className="w-full bg-card border border-border rounded-lg text-xs p-2 text-foreground focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </>
                  )}
                </div>

                <div className="flex items-center space-x-2 pt-1">
                  <button
                    onClick={() => {
                      if (outlierActionType === "clip") {
                        handlePreviewCleanAction("clip_outliers", {
                          column: outlierCol,
                          lower_quantile: lowerQuantile,
                          upper_quantile: upperQuantile,
                        });
                      } else {
                        handlePreviewCleanAction("remove_outliers", {
                          column: outlierCol,
                          method: outlierMethod,
                          threshold: outlierThreshold,
                        });
                      }
                    }}
                    disabled={previewLoading || cleaningLoading || numericColumns.length === 0}
                    className="px-3.5 py-2 rounded-lg bg-card border border-border hover:bg-muted text-foreground text-xs font-semibold shadow-sm transition-all flex items-center space-x-1.5 disabled:opacity-50"
                  >
                    {previewLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
                    <span>Preview Outliers</span>
                  </button>
                  <button
                    onClick={() => {
                      if (outlierActionType === "clip") {
                        handleApplyCleanAction("clip_outliers", {
                          column: outlierCol,
                          lower_quantile: lowerQuantile,
                          upper_quantile: upperQuantile,
                        });
                      } else {
                        handleApplyCleanAction("remove_outliers", {
                          column: outlierCol,
                          method: outlierMethod,
                          threshold: outlierThreshold,
                        });
                      }
                    }}
                    disabled={cleaningLoading || numericColumns.length === 0}
                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition-all flex items-center space-x-1.5 disabled:opacity-50"
                  >
                    {cleaningLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                    <span>{outlierActionType === "clip" ? "Clip Outliers" : "Drop Outlier Rows"}</span>
                  </button>
                </div>
              </div>
            )}

            {activeCleanTool === "sort" && (
              <div className="space-y-3">
                <div className="text-xs font-medium text-foreground">Sort Dataset Rows Deterministically</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md">
                  <div>
                    <label className="text-[11px] text-muted-foreground block mb-1">Column to Sort By</label>
                    <select
                      value={sortCol}
                      onChange={(e) => setSortCol(e.target.value)}
                      className="w-full bg-card border border-border rounded-lg text-xs p-2 text-foreground focus:outline-none focus:border-emerald-500"
                    >
                      {allColumns.map((col) => (
                        <option key={col} value={col}>{col}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-muted-foreground block mb-1">Direction</label>
                    <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                      <button
                        type="button"
                        onClick={() => setSortAscending(true)}
                        className={`p-2 rounded-lg text-xs font-semibold border transition-all ${
                          sortAscending
                            ? "bg-emerald-600 text-white border-emerald-500 shadow-sm"
                            : "bg-card border-border text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Ascending (A-Z)
                      </button>
                      <button
                        type="button"
                        onClick={() => setSortAscending(false)}
                        className={`p-2 rounded-lg text-xs font-semibold border transition-all ${
                          !sortAscending
                            ? "bg-emerald-600 text-white border-emerald-500 shadow-sm"
                            : "bg-card border-border text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Descending (Z-A)
                      </button>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2 pt-1">
                  <button
                    onClick={() => handlePreviewCleanAction("sort_rows", { column: sortCol, ascending: sortAscending })}
                    disabled={previewLoading || cleaningLoading}
                    className="px-3.5 py-2 rounded-lg bg-card border border-border hover:bg-muted text-foreground text-xs font-semibold shadow-sm transition-all flex items-center space-x-1.5"
                  >
                    {previewLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
                    <span>Preview Sort</span>
                  </button>
                  <button
                    onClick={() => handleApplyCleanAction("sort_rows", { column: sortCol, ascending: sortAscending })}
                    disabled={cleaningLoading}
                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition-all flex items-center space-x-1.5"
                  >
                    {cleaningLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowUpDown className="w-3.5 h-3.5" />}
                    <span>Sort Dataset</span>
                  </button>
                </div>
              </div>
            )}

            {activeCleanTool === "normalize" && (
              <div className="space-y-3">
                <div className="text-xs font-medium text-foreground">Normalize / Standardize Numeric Feature</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md">
                  <div>
                    <label className="text-[11px] text-muted-foreground block mb-1">Numeric Column</label>
                    <select
                      value={normalizeCol}
                      onChange={(e) => setNormalizeCol(e.target.value)}
                      className="w-full bg-card border border-border rounded-lg text-xs p-2 text-foreground focus:outline-none focus:border-emerald-500"
                    >
                      {numericColumns.map((col) => (
                        <option key={col} value={col}>{col}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-muted-foreground block mb-1">Normalization Method</label>
                    <select
                      value={normalizeMethod}
                      onChange={(e) => setNormalizeMethod(e.target.value)}
                      className="w-full bg-card border border-border rounded-lg text-xs p-2 text-foreground focus:outline-none focus:border-emerald-500"
                    >
                      <option value="minmax">Min-Max Scaling [0, 1]</option>
                      <option value="zscore">Z-Score Standardization (μ=0, σ=1)</option>
                      <option value="robust">Robust Scaling (Median &amp; IQR)</option>
                    </select>
                  </div>
                </div>
                <div className="flex items-center space-x-2 pt-1">
                  <button
                    onClick={() => handlePreviewCleanAction("normalize", { column: normalizeCol, method: normalizeMethod })}
                    disabled={previewLoading || cleaningLoading || numericColumns.length === 0}
                    className="px-3.5 py-2 rounded-lg bg-card border border-border hover:bg-muted text-foreground text-xs font-semibold shadow-sm transition-all flex items-center space-x-1.5 disabled:opacity-50"
                  >
                    {previewLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
                    <span>Preview Normalization</span>
                  </button>
                  <button
                    onClick={() => handleApplyCleanAction("normalize", { column: normalizeCol, method: normalizeMethod })}
                    disabled={cleaningLoading || numericColumns.length === 0}
                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition-all flex items-center space-x-1.5 disabled:opacity-50"
                  >
                    {cleaningLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Scale className="w-3.5 h-3.5" />}
                    <span>Normalize Column</span>
                  </button>
                </div>
              </div>
            )}

            {activeCleanTool === "drop" && (
              <div className="space-y-3">
                <div className="text-xs font-medium text-foreground">Drop Irrelevant or High-Cardinality Column</div>
                <div className="max-w-xs">
                  <label className="text-[11px] text-muted-foreground block mb-1">Column to Remove</label>
                  <select
                    value={dropCol}
                    onChange={(e) => setDropCol(e.target.value)}
                    className="w-full bg-card border border-border rounded-lg text-xs p-2 text-foreground focus:outline-none focus:border-emerald-500"
                  >
                    {allColumns.map((col) => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center space-x-2 pt-1">
                  <button
                    onClick={() => handlePreviewCleanAction("drop_columns", { columns: [dropCol] })}
                    disabled={previewLoading || cleaningLoading}
                    className="px-3.5 py-2 rounded-lg bg-card border border-border hover:bg-muted text-foreground text-xs font-semibold shadow-sm transition-all flex items-center space-x-1.5"
                  >
                    {previewLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5 text-rose-500" />}
                    <span>Preview Drop</span>
                  </button>
                  <button
                    onClick={() => handleApplyCleanAction("drop_columns", { columns: [dropCol] })}
                    disabled={cleaningLoading}
                    className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-sm transition-all flex items-center space-x-1.5"
                  >
                    {cleaningLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    <span>Drop Column</span>
                  </button>
                </div>
              </div>
            )}

            {activeCleanTool === "filter" && (
              <div className="space-y-3">
                <div className="text-xs font-medium text-foreground">Filter Rows by Condition</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] text-muted-foreground block mb-1">Column</label>
                    <select
                      value={filterCol}
                      onChange={(e) => setFilterCol(e.target.value)}
                      className="w-full bg-card border border-border rounded-lg text-xs p-2 text-foreground focus:outline-none focus:border-emerald-500"
                    >
                      {allColumns.map((col) => (
                        <option key={col} value={col}>{col}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-muted-foreground block mb-1">Operator</label>
                    <select
                      value={filterOperator}
                      onChange={(e) => setFilterOperator(e.target.value)}
                      className="w-full bg-card border border-border rounded-lg text-xs p-2 text-foreground focus:outline-none focus:border-emerald-500"
                    >
                      <option value="==">Equals (==)</option>
                      <option value="!=">Not Equals (!=)</option>
                      <option value=">">Greater Than (&gt;)</option>
                      <option value=">=">Greater or Equal (&gt;=)</option>
                      <option value="<">Less Than (&lt;)</option>
                      <option value="<=">Less or Equal (&lt;=)</option>
                      <option value="contains">Contains (text substring)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-muted-foreground block mb-1">Value</label>
                    <input
                      type="text"
                      value={filterVal}
                      onChange={(e) => setFilterVal(e.target.value)}
                      placeholder="e.g. 50 or active"
                      className="w-full bg-card border border-border rounded-lg text-xs p-2 text-foreground focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
                <div className="flex items-center space-x-2 pt-1">
                  <button
                    onClick={() =>
                      handlePreviewCleanAction("filter_rows", {
                        column: filterCol,
                        operator: filterOperator,
                        value: filterVal,
                      })
                    }
                    disabled={previewLoading || cleaningLoading || !filterVal.trim()}
                    className="px-3.5 py-2 rounded-lg bg-card border border-border hover:bg-muted text-foreground text-xs font-semibold shadow-sm transition-all flex items-center space-x-1.5 disabled:opacity-50"
                  >
                    {previewLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
                    <span>Preview Filter</span>
                  </button>
                  <button
                    onClick={() =>
                      handleApplyCleanAction("filter_rows", {
                        column: filterCol,
                        operator: filterOperator,
                        value: filterVal,
                      })
                    }
                    disabled={cleaningLoading || !filterVal.trim()}
                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition-all flex items-center space-x-1.5 disabled:opacity-50"
                  >
                    {cleaningLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Filter className="w-3.5 h-3.5" />}
                    <span>Filter Rows</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Dry-Run Before / After Preview Diff Banner */}
          {previewData && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border-2 border-emerald-500/30 text-xs space-y-3 animate-in fade-in duration-200">
              <div className="flex items-center justify-between pb-2 border-b border-emerald-500/20">
                <div className="flex items-center space-x-2">
                  <Eye className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="font-bold text-emerald-800 dark:text-emerald-200 uppercase tracking-wider text-[11px] font-mono">
                    Dry-Run Transformation Preview
                  </span>
                </div>
                <button
                  onClick={() => {
                    setPreviewData(null);
                    setPendingAction(null);
                  }}
                  className="text-muted-foreground hover:text-foreground text-xs"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-2.5 rounded-lg bg-background/80 border border-emerald-500/20 text-foreground font-mono text-[11px]">
                {previewData.summary}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                <div className="p-2 rounded-lg bg-card border border-border">
                  <div className="text-[10px] text-muted-foreground uppercase font-mono">Rows Before</div>
                  <div className="font-bold text-foreground">{previewData.rows_before.toLocaleString()}</div>
                </div>
                <div className="p-2 rounded-lg bg-card border border-border">
                  <div className="text-[10px] text-muted-foreground uppercase font-mono">Rows After</div>
                  <div className="font-bold text-emerald-600 dark:text-emerald-400">
                    {previewData.rows_after.toLocaleString()}
                    {previewData.rows_after !== previewData.rows_before && (
                      <span className="text-[10px] ml-1 text-muted-foreground">
                        ({previewData.rows_after - previewData.rows_before})
                      </span>
                    )}
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-card border border-border">
                  <div className="text-[10px] text-muted-foreground uppercase font-mono">Columns Before</div>
                  <div className="font-bold text-foreground">{previewData.cols_before}</div>
                </div>
                <div className="p-2 rounded-lg bg-card border border-border">
                  <div className="text-[10px] text-muted-foreground uppercase font-mono">Columns After</div>
                  <div className="font-bold text-emerald-600 dark:text-emerald-400">{previewData.cols_after}</div>
                </div>
              </div>

              {previewData.stats_before && previewData.stats_after && (
                <div className="p-2.5 rounded-lg bg-card border border-border text-[11px] font-mono space-y-1">
                  <div className="text-muted-foreground text-[10px] uppercase font-bold">Numeric Distribution Shift ({previewData.affected_column})</div>
                  <div className="grid grid-cols-3 gap-2 text-foreground">
                    <div>Min: {previewData.stats_before.min} &rarr; <span className="text-emerald-600 dark:text-emerald-400 font-bold">{previewData.stats_after.min}</span></div>
                    <div>Mean: {previewData.stats_before.mean} &rarr; <span className="text-emerald-600 dark:text-emerald-400 font-bold">{previewData.stats_after.mean}</span></div>
                    <div>Max: {previewData.stats_before.max} &rarr; <span className="text-emerald-600 dark:text-emerald-400 font-bold">{previewData.stats_after.max}</span></div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end space-x-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setPreviewData(null);
                    setPendingAction(null);
                  }}
                  className="px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-xs font-medium text-foreground transition-colors"
                >
                  Dismiss Preview
                </button>
                <button
                  type="button"
                  onClick={handleCommitPreview}
                  disabled={cleaningLoading}
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition-all flex items-center space-x-1.5"
                >
                  {cleaningLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>Confirm &amp; Apply Changes</span>
                </button>
              </div>
            </div>
          )}

          {/* Action Status Banner */}
          {cleaningStatus && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span className="font-medium">{cleaningStatus}</span>
              </div>
              <button
                onClick={handleUndo}
                disabled={!canUndo}
                className="text-[11px] font-semibold underline hover:text-emerald-900 dark:hover:text-emerald-100 disabled:opacity-40"
              >
                Undo
              </button>
            </div>
          )}

          {cleaningError && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{cleaningError}</span>
            </div>
          )}
        </div>

        {/* AI DATASET COPILOT ASSISTANT (VIOLET/INDICO IDENTITY) */}
        <div className="rounded-2xl border border-violet-500/30 dark:border-violet-500/40 bg-gradient-to-r from-violet-500/5 via-indigo-500/5 to-card p-6 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-violet-600 to-indigo-600 text-white flex items-center justify-center font-bold shadow-sm shadow-violet-500/20">
                <Sparkles className="w-4 h-4 text-violet-200" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="font-semibold text-sm text-foreground font-sans">AI Dataset Copilot</h3>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-500/10 text-violet-700 dark:text-violet-300 border border-violet-500/30 font-mono">
                    Deterministic Copilot
                  </span>
                </div>
                <p className="text-xs text-muted-foreground font-sans">Audited workspace intelligence powered by verified statistical metrics</p>
              </div>
            </div>
          </div>

          {/* Quick Questions Buttons */}
          <div className="flex flex-wrap gap-2 pt-1">
            {[
              "Explain my dataset",
              "Which columns have missing values?",
              "What should I clean first?",
              "Are there any outliers?",
            ].map((prompt) => (
              <button
                key={prompt}
                onClick={() => handleAskCopilot(prompt)}
                className="px-3 py-1 rounded-full border border-violet-200/80 dark:border-violet-800/60 bg-violet-50/40 dark:bg-violet-900/15 hover:bg-violet-100/70 dark:hover:bg-violet-900/30 text-xs font-sans font-medium text-foreground hover:border-violet-400 transition-all shadow-sm"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Input Box */}
          <div className="flex items-center space-x-2 pt-2">
            <input
              type="text"
              value={copilotQuery}
              onChange={(e) => setCopilotQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAskCopilot()}
              placeholder="Ask Copilot a question about this dataset (e.g. 'Explain my dataset' or 'What should I clean first?')..."
              className="flex-1 p-2.5 rounded-xl border border-violet-200/80 dark:border-violet-800/60 bg-background text-xs font-sans text-foreground placeholder-muted-foreground focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/25"
            />
            <button
              onClick={() => handleAskCopilot()}
              disabled={copilotLoading}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-medium flex items-center space-x-1.5 transition-colors disabled:opacity-50 shadow-sm shadow-violet-500/20"
            >
              {copilotLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              <span>Ask Copilot</span>
            </button>
          </div>

          {/* Copilot Error Alert */}
          {copilotError && (
            <div className="mt-2 p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-xs text-rose-700 dark:text-rose-300 flex items-center justify-between">
              <span className="font-sans">{copilotError}</span>
              <button
                onClick={() => handleAskCopilot()}
                className="px-2.5 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-800 dark:text-rose-100 font-medium text-xs transition-colors"
              >
                Retry
              </button>
            </div>
          )}

          {/* Copilot Answer Display */}
          {copilotResponse && (
            <div className="mt-3 p-4 rounded-xl border border-violet-500/30 bg-violet-50/70 dark:bg-violet-950/25 text-xs text-foreground space-y-2 animate-in fade-in duration-200 shadow-sm">
              <div className="font-semibold text-violet-700 dark:text-violet-300 text-[11px] uppercase tracking-wider font-mono flex items-center space-x-1.5">
                <Bot className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
                <span>Copilot Analysis ({copilotResponse.intent})</span>
              </div>
              <div className="whitespace-pre-line leading-relaxed text-foreground font-sans text-xs">
                {copilotResponse.answer}
              </div>
            </div>
          )}
        </div>

        {/* Automated Recommendations */}
        {quality.recommendations.length > 0 && (
          <div className="rounded-2xl border border-border bg-card p-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center space-x-2">
                <Info className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <h3 className="font-semibold text-sm text-foreground font-sans">
                  Automated Quality Recommendations ({quality.recommendations.length})
                </h3>
              </div>
              <span className="text-xs text-muted-foreground font-mono">Pre-flight ML validation</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {quality.recommendations.map((rec, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl border border-border bg-muted/30 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-foreground font-sans">{rec.title}</span>
                    <span
                      className={`text-[10px] font-mono font-medium uppercase px-2 py-0.5 rounded-full ${
                        rec.type === "danger"
                          ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                          : rec.type === "warning"
                          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                          : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                      }`}
                    >
                      {rec.type}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed font-sans">{rec.description}</p>
                  {rec.action && (
                    <div className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 pt-1">
                      Action: {rec.action}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Outlier Detection via IQR */}
        {outlierEntries.length > 0 && (
          <div className="rounded-2xl border border-border bg-card p-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="font-semibold text-sm text-foreground flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span>Numerical Outlier Detection (Interquartile Range Method)</span>
              </h3>
              <span className="text-xs font-mono text-muted-foreground">Boundaries: Q1 - 1.5×IQR / Q3 + 1.5×IQR</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {outlierEntries.map(([col, o]) => (
                <div key={col} className="p-3.5 rounded-xl border border-border bg-muted/30 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-semibold text-foreground">{col}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      o.outlier_pct > 3.0 ? "bg-rose-500/20 text-rose-600 dark:text-rose-400" : "bg-muted text-muted-foreground"
                    }`}>
                      {o.outlier_count} outliers ({o.outlier_pct}%)
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-muted-foreground">
                    Valid Range: [{o.lower_bound} to {o.upper_bound}]
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Missing Values Chart */}
          <div className="rounded-2xl border border-border bg-card p-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="font-semibold text-sm text-foreground">Missing Values Ratio by Feature (%)</h3>
              <span className="text-xs font-mono text-muted-foreground">Threshold: 0% Ideal</span>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={missingChartData}>
                  <CartesianGrid strokeDasharray="2 2" stroke="currentColor" className="opacity-10" vertical={false} />
                  <XAxis
                    dataKey="name"
                    stroke="currentColor"
                    className="text-muted-foreground"
                    fontSize={11}
                    interval={0}
                    angle={-20}
                    textAnchor="end"
                  />
                  <YAxis stroke="currentColor" className="text-muted-foreground" fontSize={11} domain={[0, 100]} unit="%" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--background)",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                      fontSize: "12px",
                      color: "var(--foreground)",
                    }}
                  />
                  <Bar dataKey="missingPct" fill="#10B981">
                    {missingChartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.missingPct > 20 ? "#EF4444" : entry.missingPct > 0 ? "#F59E0B" : "#10B981"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Feature Distribution Inspector */}
          <div className="rounded-2xl border border-border bg-card p-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="font-semibold text-sm text-foreground">Feature Distribution Inspector</h3>
              <select
                value={selectedCol}
                onChange={(e) => setSelectedCol(e.target.value)}
                className="bg-muted border border-border rounded-lg text-xs text-foreground px-3 py-1.5 focus:outline-none focus:border-emerald-500"
              >
                {Object.keys(quality.missing_summary).map((col) => (
                  <option key={col} value={col}>
                    {col}
                  </option>
                ))}
              </select>
            </div>

            {distLoading ? (
              <div className="h-64 flex items-center justify-center text-xs font-mono text-muted-foreground space-x-2">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
                <span>Computing distribution histograms...</span>
              </div>
            ) : distError ? (
              <div className="h-64 flex flex-col items-center justify-center p-6 text-center space-y-3">
                <AlertTriangle className="w-6 h-6 text-rose-500" />
                <div className="text-xs text-rose-600 dark:text-rose-300 font-mono">{distError}</div>
                <button
                  onClick={() => fetchColumnDistribution(selectedCol)}
                  className="px-3 py-1.5 rounded-lg bg-card hover:bg-muted text-xs font-semibold text-foreground border border-border transition-colors shadow-sm"
                >
                  Retry Distribution Profiling
                </button>
              </div>
            ) : distData?.type === "empty" ? (
              <div className="h-64 flex flex-col items-center justify-center p-6 text-center space-y-2 text-muted-foreground">
                <AlertCircle className="w-6 h-6 text-muted-foreground" />
                <div className="text-xs font-mono">No non-null observations in column &apos;{selectedCol}&apos;.</div>
              </div>
            ) : distData?.type === "categorical" ? (
              <div className="space-y-4">
                <div className="h-52 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={distData.categories || []}>
                      <CartesianGrid strokeDasharray="2 2" stroke="currentColor" className="opacity-10" vertical={false} />
                      <XAxis dataKey="category" stroke="currentColor" className="text-muted-foreground" fontSize={10} interval={0} angle={-15} textAnchor="end" />
                      <YAxis stroke="currentColor" className="text-muted-foreground" fontSize={11} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "var(--background)",
                          border: "1px solid var(--border)",
                          borderRadius: "8px",
                          fontSize: "12px",
                          color: "var(--foreground)",
                        }}
                      />
                      <Bar dataKey="count" fill="#10B981" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center p-3 rounded-xl bg-muted/40 border border-border text-xs">
                  <div>
                    <div className="text-muted-foreground text-[10px] uppercase font-mono">Distinct Categories</div>
                    <div className="font-bold text-foreground">{distData.unique ?? distData.categories?.length ?? "N/A"}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-[10px] uppercase font-mono">Top Category</div>
                    <div className="font-bold text-emerald-600 dark:text-emerald-400 truncate">{distData.categories?.[0]?.category ?? "N/A"}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-[10px] uppercase font-mono">Top Category Count</div>
                    <div className="font-bold text-foreground">{distData.categories?.[0]?.count ?? "N/A"}</div>
                  </div>
                </div>
              </div>
            ) : distData?.type === "numeric" ? (
              <div className="space-y-4">
                <div className="h-52 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={distData.bins || []}>
                      <CartesianGrid strokeDasharray="2 2" stroke="currentColor" className="opacity-10" vertical={false} />
                      <XAxis dataKey="bin" stroke="currentColor" className="text-muted-foreground" fontSize={10} />
                      <YAxis stroke="currentColor" className="text-muted-foreground" fontSize={11} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "var(--background)",
                          border: "1px solid var(--border)",
                          borderRadius: "8px",
                          fontSize: "12px",
                          color: "var(--foreground)",
                        }}
                      />
                      <Bar dataKey="count" fill="#10B981" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="grid grid-cols-4 gap-2 text-center p-3 rounded-xl bg-muted/40 border border-border text-xs">
                  <div>
                    <div className="text-muted-foreground text-[10px] uppercase font-mono">Mean</div>
                    <div className="font-bold text-foreground">{distData.mean !== undefined ? distData.mean.toFixed(2) : "N/A"}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-[10px] uppercase font-mono">Median</div>
                    <div className="font-bold text-foreground">{distData.median !== undefined ? distData.median.toFixed(2) : "N/A"}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-[10px] uppercase font-mono">Min</div>
                    <div className="font-bold text-foreground">{distData.min !== undefined ? distData.min.toFixed(2) : "N/A"}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-[10px] uppercase font-mono">Max</div>
                    <div className="font-bold text-foreground">{distData.max !== undefined ? distData.max.toFixed(2) : "N/A"}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-xs font-mono text-muted-foreground">
                Select a column from the dropdown above
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Floating Command Dock */}
      <RetroDock />
    </div>
  );
}
