/**
 * OpenDataLens — Shared Page-Level Workspace Restoration Engine
 * Phase 7.1 & 7.2: Offline & Local Persistence Fallback Engine
 * 
 * Guarantees that when the backend is offline, unreachable, or cold-starting,
 * pages can restore cached datasets, schemas, cleaning history, chart configurations,
 * and ML leaderboard states directly from browser IndexedDB.
 * 
 * In Phase 7.2.1:
 * - Parses cached full CSV into full dataset records for offline visualization calculations.
 * - Distinguishes between full datasets and preview-only workspaces (e.g. quota-degraded).
 * - Implements zero-dependency RFC 4180 CSV parsing with type inference and null preservation.
 */

import {
  localDB,
  LocalDatasetRecord,
  LocalTransformationsRecord,
  LocalVisualizationsRecord,
  LocalAnalysisHistoryRecord,
  LocalModelResultsRecord,
} from "./indexeddb";
import { getWorkspaceId } from "./api";

export interface RestoredWorkspaceState {
  isOffline: boolean;
  hasCachedData: boolean;
  isFullDataset: boolean;
  isPreviewOnly: boolean;
  workspaceId: string;
  dataset: LocalDatasetRecord | null;
  transformations: LocalTransformationsRecord | null;
  visualizations: LocalVisualizationsRecord | null;
  analysisHistory: LocalAnalysisHistoryRecord | null;
  modelResults: LocalModelResultsRecord | null;
  noticeMessage: string | null;
}

/**
 * High-performance, RFC 4180 compliant CSV parser.
 * Supports quoted fields, escaped quotes, newlines, commas, and type inference.
 */
export function parseCsvToRecords(
  csvText: string,
  options?: { maxRows?: number }
): { records: Record<string, any>[]; rowCount: number; columns: string[] } {
  if (!csvText || typeof csvText !== "string") {
    return { records: [], rowCount: 0, columns: [] };
  }

  const maxRows = options?.maxRows ?? Infinity;
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;
  const len = csvText.length;

  for (let i = 0; i < len; i++) {
    const ch = csvText[i];

    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < len && csvText[i + 1] === '"') {
          // Escaped quote: "" -> "
          currentField += '"';
          i++;
        } else {
          // Closing quote
          inQuotes = false;
        }
      } else {
        currentField += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        currentRow.push(currentField);
        currentField = "";
      } else if (ch === "\r") {
        if (i + 1 < len && csvText[i + 1] === "\n") {
          i++;
        }
        currentRow.push(currentField);
        currentField = "";
        rows.push(currentRow);
        currentRow = [];
        if (rows.length > maxRows) break;
      } else if (ch === "\n") {
        currentRow.push(currentField);
        currentField = "";
        rows.push(currentRow);
        currentRow = [];
        if (rows.length > maxRows) break;
      } else {
        currentField += ch;
      }
    }
  }

  // Flush remaining field/row
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  if (rows.length === 0) {
    return { records: [], rowCount: 0, columns: [] };
  }

  // Header row
  const headers = rows[0].map((h) => h.trim());
  const numHeaders = headers.length;
  const records: Record<string, any>[] = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    // Skip empty trailing lines
    if (row.length === 1 && row[0].trim() === "") continue;

    const record: Record<string, any> = {};
    for (let c = 0; c < numHeaders; c++) {
      const header = headers[c];
      const rawVal = c < row.length ? row[c] : "";
      record[header] = parseCellValue(rawVal);
    }
    records.push(record);
  }

  return {
    records,
    rowCount: records.length,
    columns: headers,
  };
}

function parseCellValue(raw: string): any {
  if (raw === null || raw === undefined) return null;
  const trimmed = raw.trim();
  if (trimmed === "") return null;

  const lower = trimmed.toLowerCase();
  if (lower === "null" || lower === "nan" || lower === "none" || lower === "n/a" || lower === "na") {
    return null;
  }
  if (lower === "true") return true;
  if (lower === "false") return false;

  // Numeric parsing
  if (!isNaN(Number(trimmed))) {
    if (trimmed.length > 1 && trimmed.startsWith("0") && !trimmed.startsWith("0.")) {
      // Keep codes like "01234" as string
      return trimmed;
    }
    return Number(trimmed);
  }

  return raw;
}

/**
 * Loads the active workspace from IndexedDB.
 * Restores full dataset records when raw_csv is available.
 * Accurately flags whether full dataset or preview-only data is active.
 */
export async function loadActiveWorkspace(workspaceId?: string): Promise<RestoredWorkspaceState> {
  const sid = workspaceId || getWorkspaceId();
  const isOffline = typeof navigator !== "undefined" && !navigator.onLine;

  try {
    const full = await localDB.getFullWorkspace(sid);
    if (!full || !full.dataset) {
      return {
        isOffline,
        hasCachedData: false,
        isFullDataset: false,
        isPreviewOnly: false,
        workspaceId: sid,
        dataset: null,
        transformations: null,
        visualizations: null,
        analysisHistory: null,
        modelResults: null,
        noticeMessage: null,
      };
    }

    let isFullDataset = false;
    let isPreviewOnly = true;
    let noticeMessage = "Preview-only workspace restored from local cache (sample preview rows only).";

    // If raw_csv is cached in IndexedDB, parse the full dataset into records
    if (full.dataset.raw_csv && full.dataset.raw_csv.trim().length > 0) {
      try {
        const parsed = parseCsvToRecords(full.dataset.raw_csv);
        if (parsed.records.length > 0) {
          full.dataset.records = parsed.records;
          full.dataset.total_rows = parsed.rowCount;
          isFullDataset = true;
          isPreviewOnly = false;
          noticeMessage = `Full dataset restored from local browser cache (${parsed.rowCount.toLocaleString()} rows). Offline analytics active.`;
        }
      } catch (parseErr) {
        console.warn("[WorkspaceRestore] Could not parse raw_csv, falling back to preview rows:", parseErr);
      }
    } else {
      noticeMessage = "Preview-only workspace restored from local cache (full raw CSV omitted due to storage quota).";
    }

    full.dataset.is_full_dataset = isFullDataset;
    full.dataset.is_preview_only = isPreviewOnly;

    return {
      isOffline,
      hasCachedData: true,
      isFullDataset,
      isPreviewOnly,
      workspaceId: sid,
      dataset: full.dataset,
      transformations: full.transformations || null,
      visualizations: full.visualizations || null,
      analysisHistory: full.analysis_history || null,
      modelResults: full.model_results || null,
      noticeMessage,
    };
  } catch (err) {
    console.warn("[WorkspaceRestore] Could not load workspace from IndexedDB:", err);
    return {
      isOffline,
      hasCachedData: false,
      isFullDataset: false,
      isPreviewOnly: false,
      workspaceId: sid,
      dataset: null,
      transformations: null,
      visualizations: null,
      analysisHistory: null,
      modelResults: null,
      noticeMessage: null,
    };
  }
}