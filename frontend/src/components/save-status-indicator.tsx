"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  CloudOff,
  AlertTriangle,
  XCircle,
  HardDrive,
  Clock,
} from "lucide-react";
import { Ring } from "@/components/loading-ui/ring";
import { workspaceSync, SaveStatusInfo } from "@/lib/workspace-sync";

interface SaveStatusIndicatorProps {
  onOpenWorkspaces?: () => void;
  className?: string;
}

export function SaveStatusIndicator({ onOpenWorkspaces, className = "" }: SaveStatusIndicatorProps) {
  const [status, setStatus] = useState<SaveStatusInfo>({
    state: "saved",
    message: "All changes saved locally",
    lastSavedAt: null,
  });

  useEffect(() => {
    const unsub = workspaceSync.subscribe(setStatus);
    return unsub;
  }, []);

  const formatTime = (d: Date | null) => {
    if (!d) return "Just now";
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };

  const renderBadge = () => {
    switch (status.state) {
      case "saving":
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <Ring className="size-3 text-amber-600 dark:text-amber-400" />
            <span>Saving...</span>
          </div>
        );
      case "unsaved":
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-muted/60 text-muted-foreground border border-border">
            <span className="size-2 rounded-full bg-amber-500 animate-pulse" />
            <span>Unsaved</span>
          </div>
        );
      case "offline_saved":
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
            <CloudOff className="size-3 text-sky-500" />
            <span>Saved Offline</span>
          </div>
        );
      case "unavailable":
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20" title="IndexedDB unavailable">
            <AlertTriangle className="size-3 text-amber-500" />
            <span className="hidden sm:inline">Storage Unavailable</span>
          </div>
        );
      case "error":
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20" title={status.message}>
            <XCircle className="size-3 text-red-500" />
            <span>Save Failed</span>
          </div>
        );
      case "saved":
      default:
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="size-3 text-emerald-500" />
            <span className="hidden sm:inline">Saved Locally</span>
            <span className="sm:hidden">Saved</span>
          </div>
        );
    }
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={onOpenWorkspaces}
        className="flex items-center gap-1.5 group transition-opacity hover:opacity-85 focus:outline-none"
        title={`${status.message} • Click to manage local workspaces`}
      >
        {renderBadge()}
      </button>
    </div>
  );
}
