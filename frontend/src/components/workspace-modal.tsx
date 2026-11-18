"use client";

import { useEffect, useState, useRef } from "react";
import {
  FolderArchive,
  HardDrive,
  Trash2,
  Download,
  Upload,
  Plus,
  RefreshCw,
  Clock,
  Database,
  Layers,
  CheckCircle2,
  AlertTriangle,
  X,
  Edit2,
  Check,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { localDB, LocalWorkspaceMetadata, CompleteWorkspaceSnapshot } from "@/lib/indexeddb";
import { workspaceSync } from "@/lib/workspace-sync";
import { getWorkspaceId, resetWorkspaceId, api } from "@/lib/api";

interface WorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onWorkspaceRestored?: () => void;
}

export function WorkspaceModal({ isOpen, onClose, onWorkspaceRestored }: WorkspaceModalProps) {
  const [workspaces, setWorkspaces] = useState<LocalWorkspaceMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string>("");
  const [storageEstimate, setStorageEstimate] = useState<{ usageMB: number; quotaMB: number; percentUsed: number; supported: boolean }>({
    usageMB: 0,
    quotaMB: 0,
    percentUsed: 0,
    supported: false,
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const currentId = getWorkspaceId();
      setActiveId(currentId);
      const list = await localDB.listWorkspaces();
      setWorkspaces(list);
      const est = await localDB.getStorageEstimate();
      setStorageEstimate(est);
    } catch (e) {
      console.error("Failed to load workspace metadata:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
      setActionNotice(null);
      setConfirmDeleteId(null);
      setConfirmClearAll(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleStartRename = (ws: LocalWorkspaceMetadata) => {
    setEditingId(ws.id);
    setEditName(ws.name);
  };

  const handleSaveRename = async (id: string) => {
    if (!editName.trim()) {
      setEditingId(null);
      return;
    }
    const ws = await localDB.getWorkspaceMetadata(id);
    if (ws) {
      ws.name = editName.trim();
      ws.updated_at = new Date().toISOString();
      await localDB.saveWorkspaceMetadata(ws);
      setActionNotice(`Renamed to "${ws.name}"`);
      await loadData();
    }
    setEditingId(null);
  };

  const handleDelete = async (id: string) => {
    await localDB.deleteWorkspace(id);
    setConfirmDeleteId(null);
    setActionNotice("Workspace permanently removed from local storage.");
    await loadData();
  };

  const handleRestore = async (id: string) => {
    try {
      setLoading(true);
      const full = await localDB.getFullWorkspace(id);
      if (!full) {
        alert("Workspace snapshot not found in local IndexedDB.");
        return;
      }

      // Switch active workspace in localStorage
      localStorage.setItem("opendatalens_workspace_id", id);
      setActiveId(id);

      // If dataset exists in snapshot, reload it into session if possible
      if (full.dataset && full.dataset.records && full.dataset.records.length > 0) {
        // Backend synchronization
        try {
          if (full.dataset.raw_csv) {
            const blob = new Blob([full.dataset.raw_csv], { type: "text/csv" });
            const file = new File([blob], `${full.metadata.dataset_name || "restored"}.csv`, { type: "text/csv" });
            await api.uploadCSV(file, id);
          }
        } catch {
          // Offline mode: backend might be offline; local data remains in IndexedDB
        }
      }

      setActionNotice(`Restored workspace "${full.metadata.name}"!`);
      if (onWorkspaceRestored) onWorkspaceRestored();
      setTimeout(() => {
        onClose();
        window.location.reload();
      }, 700);
    } catch (err: any) {
      alert(`Restoration failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleStartNewWorkspace = async () => {
    const freshId = resetWorkspaceId();
    setActiveId(freshId);
    setActionNotice("Created a clean new workspace.");
    if (onWorkspaceRestored) onWorkspaceRestored();
    setTimeout(() => {
      onClose();
      window.location.reload();
    }, 700);
  };

  const handleExport = async (id: string) => {
    try {
      await workspaceSync.exportWorkspaceJSON(id);
    } catch (e: any) {
      alert(`Export failed: ${e.message}`);
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setLoading(true);
      const newId = await workspaceSync.importWorkspaceJSON(file);
      setActionNotice("Workspace imported successfully into IndexedDB.");
      await loadData();
      // Auto-switch to imported workspace
      localStorage.setItem("opendatalens_workspace_id", newId);
      setActiveId(newId);
      if (onWorkspaceRestored) onWorkspaceRestored();
    } catch (err: any) {
      alert(`Import error: ${err.message}`);
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleClearAll = async () => {
    await localDB.clearAllWorkspaceData();
    setConfirmClearAll(false);
    setActionNotice("All local browser workspaces have been purged.");
    await loadData();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <FolderArchive className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Local Workspaces &amp; Persistence</h2>
              <p className="text-xs text-muted-foreground">
                IndexedDB storage • 100% private in browser • Zero external cloud required
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Action Notice */}
        {actionNotice && (
          <div className="px-5 py-2.5 bg-emerald-500/10 border-b border-emerald-500/20 text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center justify-between">
            <span>{actionNotice}</span>
            <button onClick={() => setActionNotice(null)} className="opacity-75 hover:opacity-100">
              <X className="size-3" />
            </button>
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Top Actions: New Workspace + Import */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl border border-border bg-muted/10">
            <button
              onClick={handleStartNewWorkspace}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all active:scale-95"
            >
              <Plus className="size-3.5" />
              <span>Start Clean Workspace</span>
            </button>

            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleImportFile}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border bg-card hover:bg-muted text-foreground transition-colors"
              >
                <Upload className="size-3.5 text-muted-foreground" />
                <span>Import Workspace (.json)</span>
              </button>
            </div>
          </div>

          {/* Workspaces List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Saved Workspaces ({workspaces.length})
              </h3>
              <button
                onClick={loadData}
                className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
              >
                <RefreshCw className="size-3" />
                <span>Refresh</span>
              </button>
            </div>

            {loading ? (
              <div className="p-8 text-center text-xs text-muted-foreground">Loading local storage...</div>
            ) : workspaces.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-border rounded-xl space-y-2">
                <HardDrive className="size-8 mx-auto text-muted-foreground opacity-50" />
                <p className="text-xs font-medium text-foreground">No saved workspaces in IndexedDB</p>
                <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
                  Workspaces are automatically saved as you mount datasets, clean columns, and train models.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {workspaces.map((ws) => {
                  const isActive = ws.id === activeId;
                  const isEditing = editingId === ws.id;
                  const isConfirmingDelete = confirmDeleteId === ws.id;

                  return (
                    <div
                      key={ws.id}
                      className={`p-4 rounded-xl border transition-all ${
                        isActive
                          ? "border-emerald-500/50 bg-emerald-500/5 shadow-sm"
                          : "border-border bg-card hover:border-border/80"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1 flex-1 min-w-0">
                          {isEditing ? (
                            <div className="flex items-center gap-2 max-w-sm">
                              <input
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="px-2 py-1 text-xs font-medium rounded border border-border bg-background text-foreground w-full focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleSaveRename(ws.id);
                                  if (e.key === "Escape") setEditingId(null);
                                }}
                              />
                              <button
                                onClick={() => handleSaveRename(ws.id)}
                                className="p-1 rounded bg-emerald-600 text-white"
                              >
                                <Check className="size-3.5" />
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="p-1 rounded border border-border text-muted-foreground hover:bg-muted"
                              >
                                <X className="size-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-xs text-foreground truncate">{ws.name}</span>
                              {isActive && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                  Active
                                </span>
                              )}
                              <button
                                onClick={() => handleStartRename(ws)}
                                className="text-muted-foreground hover:text-foreground opacity-60 hover:opacity-100"
                                title="Rename workspace"
                              >
                                <Edit2 className="size-3" />
                              </button>
                            </div>
                          )}

                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Database className="size-3 text-emerald-500" />
                              {ws.dataset_name || "Dataset"}
                            </span>
                            <span>•</span>
                            <span className="font-mono">
                              {ws.total_rows.toLocaleString()} × {ws.total_cols}
                            </span>
                            <span>•</span>
                            <span>{ws.clean_steps_count} clean steps</span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Clock className="size-3" />
                              {new Date(ws.updated_at).toLocaleDateString()} {new Date(ws.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {!isActive && (
                            <button
                              onClick={() => handleRestore(ws.id)}
                              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all"
                            >
                              Restore
                            </button>
                          )}

                          <button
                            onClick={() => handleExport(ws.id)}
                            className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                            title="Export Workspace JSON"
                          >
                            <Download className="size-3.5" />
                          </button>

                          {isConfirmingDelete ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleDelete(ws.id)}
                                className="px-2 py-1 text-[11px] font-semibold rounded bg-red-600 text-white hover:bg-red-500"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(null)}
                                className="px-1.5 py-1 text-[11px] rounded border border-border text-muted-foreground"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmDeleteId(ws.id)}
                              className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
                              title="Delete Workspace"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Privacy & Storage Section */}
          <div className="p-4 rounded-xl border border-border bg-muted/10 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <HardDrive className="size-3.5 text-muted-foreground" />
                Browser Storage Quota
              </span>
              <span className="font-mono text-muted-foreground">
                {storageEstimate.usageMB.toFixed(2)} MB used / {storageEstimate.quotaMB.toLocaleString()} MB total
              </span>
            </div>

            {storageEstimate.supported && (
              <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all"
                  style={{ width: `${Math.max(1, storageEstimate.percentUsed)}%` }}
                />
              </div>
            )}

            <div className="flex items-start gap-2 text-[11px] text-muted-foreground leading-relaxed pt-1">
              <ShieldCheck className="size-3.5 text-emerald-500 shrink-0 mt-0.5" />
              <span>
                All workspaces are isolated inside your browser’s IndexedDB sandbox. Data never syncs to third parties
                and stays available even when offline. Clearing browser site data will remove local workspaces.
              </span>
            </div>

            <div className="pt-2 border-t border-border flex justify-end">
              {confirmClearAll ? (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-red-500 font-medium">Delete all {workspaces.length} workspaces?</span>
                  <button
                    onClick={handleClearAll}
                    className="px-2.5 py-1 text-xs font-semibold rounded bg-red-600 text-white hover:bg-red-500"
                  >
                    Yes, Delete All
                  </button>
                  <button
                    onClick={() => setConfirmClearAll(false)}
                    className="px-2 py-1 text-xs rounded border border-border text-muted-foreground"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmClearAll(true)}
                  disabled={workspaces.length === 0}
                  className="text-xs text-red-500 hover:text-red-600 font-medium transition-colors disabled:opacity-40"
                >
                  Clear All Local Workspaces
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-muted/20 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-card border border-border hover:bg-muted text-foreground transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
