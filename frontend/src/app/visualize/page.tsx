"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import {
  BarChart2,
  LineChart as LineChartIcon,
  PieChart as PieChartIcon,
  ScatterChart as ScatterIcon,
  AreaChart as AreaIcon,
  Activity,
  Grid3X3,
  CircleDot,
  Layers,
  Sparkles,
  Download,
  Filter,
  ArrowRight,
  Database,
  ChevronRight,
  Info,
  Maximize2,
  RefreshCw,
  Sliders,
  Check,
  FileDown,
  X,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  ScatterChart,
  Scatter,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { Ring } from "@/components/loading-ui/ring";
import { api, categorizeApiError } from "@/lib/api";
import { DatasetPreviewResponse } from "@/lib/types";
import { RetroDock } from "@/components/retro-dock";

const PALETTE = [
  "#10B981", // Emerald
  "#059669", // Deep Emerald
  "#34D399", // Light Emerald
  "#F59E0B", // Amber
  "#8B5CF6", // Purple
  "#3B82F6", // Blue
  "#EC4899", // Pink
  "#06B6D4", // Cyan
  "#14B8A6", // Teal
  "#6366F1", // Indigo
];

type ChartType = "bar" | "line" | "area" | "scatter" | "pie" | "donut" | "histogram" | "heatmap";
type AggregationType = "sum" | "mean" | "count" | "min" | "max";

export default function VisualizePage() {
  const [dataset, setDataset] = useState<DatasetPreviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Chart Architecture State
  const [chartType, setChartType] = useState<ChartType>("bar");
  const [xAxisCol, setXAxisCol] = useState<string>("");
  const [yAxisCol, setYAxisCol] = useState<string>("");
  const [aggregation, setAggregation] = useState<AggregationType>("mean");
  const [topN, setTopN] = useState<number>(15);

  // Filters & Customization
  const [excludeNulls, setExcludeNulls] = useState<boolean>(true);
  const [filterKeyword, setFilterKeyword] = useState<string>("");
  const [minThreshold, setMinThreshold] = useState<string>("");
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [showLegend, setShowLegend] = useState<boolean>(true);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  const chartContainerRef = useRef<HTMLDivElement>(null);

  const numericalColumns = useMemo(() => {
    if (!dataset || !dataset.columns) return [];
    return dataset.columns
      .filter((c) =>
        ["int", "float", "number", "double"].some((t) =>
          c.dtype.toLowerCase().includes(t)
        )
      )
      .map((c) => c.name);
  }, [dataset]);

  const categoricalColumns = useMemo(() => {
    if (!dataset || !dataset.columns) return [];
    return dataset.columns
      .filter(
        (c) =>
          !["int", "float", "number", "double"].some((t) =>
            c.dtype.toLowerCase().includes(t)
          )
      )
      .map((c) => c.name);
  }, [dataset]);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const data = await api.getActiveDataset();
        if (data && data.records && data.records.length > 0) {
          setDataset(data);

          const numCols = data.columns
            .filter((c) =>
              ["int", "float", "number", "double"].some((t) =>
                c.dtype.toLowerCase().includes(t)
              )
            )
            .map((c) => c.name);

          const catCols = data.columns
            .filter(
              (c) =>
                !["int", "float", "number", "double"].some((t) =>
                  c.dtype.toLowerCase().includes(t)
                )
            )
            .map((c) => c.name);

          if (catCols.length > 0 && numCols.length > 0) {
            setXAxisCol(catCols[0]);
            setYAxisCol(numCols[0]);
          } else if (numCols.length >= 2) {
            setXAxisCol(numCols[0]);
            setYAxisCol(numCols[1]);
          } else if (data.columns.length > 0) {
            setXAxisCol(data.columns[0].name);
            if (data.columns.length > 1) {
              setYAxisCol(data.columns[1].name);
            }
          }
        } else {
          setDataset(null);
        }
      } catch (err: any) {
        const cat = categorizeApiError(err);
        if (cat.type === "cold_start") {
          setError("Waking up the backend. This may take up to 50 seconds on Render's free tier.");
        } else {
          setError("No active dataset loaded in workspace.");
        }
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Filtered Source Rows
  const filteredRows = useMemo(() => {
    if (!dataset || !dataset.records) return [];
    let rows = dataset.records;

    if (excludeNulls && xAxisCol) {
      rows = rows.filter((r) => r[xAxisCol] !== null && r[xAxisCol] !== undefined && r[xAxisCol] !== "");
      if (yAxisCol) {
        rows = rows.filter((r) => r[yAxisCol] !== null && r[yAxisCol] !== undefined);
      }
    }

    if (filterKeyword.trim() && xAxisCol) {
      const q = filterKeyword.toLowerCase().trim();
      rows = rows.filter((r) => String(r[xAxisCol] ?? "").toLowerCase().includes(q));
    }

    if (minThreshold.trim() && yAxisCol && !isNaN(Number(minThreshold))) {
      const thresh = Number(minThreshold);
      rows = rows.filter((r) => typeof r[yAxisCol] === "number" && r[yAxisCol] >= thresh);
    }

    return rows;
  }, [dataset, xAxisCol, yAxisCol, excludeNulls, filterKeyword, minThreshold]);

  // Aggregated Chart Data Computation
  const computedChartData = useMemo(() => {
    if (!dataset || !xAxisCol || filteredRows.length === 0) return [];
    const rows = filteredRows;

    // 1. Histogram: Continuous distribution binned into buckets
    if (chartType === "histogram") {
      const targetCol = numericalColumns.includes(xAxisCol) ? xAxisCol : (numericalColumns[0] || xAxisCol);
      const values = rows
        .map((r) => Number(r[targetCol]))
        .filter((v) => !isNaN(v) && isFinite(v));

      if (values.length === 0) return [];
      const min = Math.min(...values);
      const max = Math.max(...values);
      const binCount = Math.min(15, Math.max(5, Math.floor(Math.sqrt(values.length))));
      const binWidth = max === min ? 1 : (max - min) / binCount;

      const bins = Array.from({ length: binCount }, (_, i) => {
        const bMin = min + i * binWidth;
        const bMax = i === binCount - 1 ? max : bMin + binWidth;
        return {
          name: `${bMin.toFixed(2)} - ${bMax.toFixed(2)}`,
          value: 0,
          count: 0,
          range: `[${bMin.toFixed(2)}, ${bMax.toFixed(2)}]`,
        };
      });

      values.forEach((v) => {
        const idx = Math.min(binCount - 1, Math.max(0, Math.floor((v - min) / binWidth)));
        bins[idx].value += 1;
        bins[idx].count += 1;
      });

      return bins;
    }

    // 2. Scatter: Raw coordinate pairs without grouping
    if (chartType === "scatter") {
      return rows
        .map((r, i) => {
          const xVal = typeof r[xAxisCol] === "number" ? r[xAxisCol] : i;
          const yVal = yAxisCol && typeof r[yAxisCol] === "number" ? r[yAxisCol] : 0;
          return {
            name: `Point #${i + 1}`,
            value: Number(yVal),
            count: 1,
            x: xVal,
            y: yVal,
            label: String(r[xAxisCol] ?? i),
          };
        })
        .filter((pt) => pt.x !== null && pt.y !== null && !isNaN(pt.x) && !isNaN(pt.y))
        .slice(0, 150);
    }

    // 3. Grouped Aggregation (Bar, Line, Area, Pie, Donut)
    const groups: { [key: string]: number[] } = {};
    rows.forEach((r) => {
      const key = String(r[xAxisCol] ?? "Unknown");
      if (!groups[key]) groups[key] = [];

      if (yAxisCol && typeof r[yAxisCol] === "number") {
        groups[key].push(r[yAxisCol]);
      } else {
        groups[key].push(1);
      }
    });

    const result = Object.entries(groups).map(([name, vals]) => {
      let value = 0;
      if (aggregation === "count" || !yAxisCol) {
        value = vals.length;
      } else if (vals.length > 0) {
        if (aggregation === "sum") {
          value = vals.reduce((a, b) => a + b, 0);
        } else if (aggregation === "mean") {
          value = vals.reduce((a, b) => a + b, 0) / vals.length;
        } else if (aggregation === "min") {
          value = Math.min(...vals);
        } else if (aggregation === "max") {
          value = Math.max(...vals);
        }
      }
      return {
        name,
        value: Number(value.toFixed(2)),
        count: vals.length,
      };
    });

    result.sort((a, b) => b.value - a.value);
    return result.slice(0, topN);
  }, [dataset, filteredRows, xAxisCol, yAxisCol, aggregation, chartType, topN, numericalColumns]);

  // 4. Heatmap Correlation Matrix Computation
  const correlationMatrix = useMemo(() => {
    if (!dataset || !dataset.records || numericalColumns.length < 2) return null;
    const cols = numericalColumns.slice(0, 8);
    const rows = dataset.records;

    const matrix: { [feature: string]: { [target: string]: number } } = {};
    cols.forEach((c1) => {
      matrix[c1] = {};
      const v1 = rows.map((r) => Number(r[c1])).filter((v) => !isNaN(v) && isFinite(v));
      const m1 = v1.reduce((a, b) => a + b, 0) / (v1.length || 1);

      cols.forEach((c2) => {
        if (c1 === c2) {
          matrix[c1][c2] = 1.0;
          return;
        }
        const pairs = rows
          .map((r) => [Number(r[c1]), Number(r[c2])])
          .filter(([a, b]) => !isNaN(a) && isFinite(a) && !isNaN(b) && isFinite(b));

        if (pairs.length < 2) {
          matrix[c1][c2] = 0.0;
          return;
        }

        const ma = pairs.reduce((sum, [a]) => sum + a, 0) / pairs.length;
        const mb = pairs.reduce((sum, [, b]) => sum + b, 0) / pairs.length;
        let num = 0, denA = 0, denB = 0;

        pairs.forEach(([a, b]) => {
          const da = a - ma;
          const db = b - mb;
          num += da * db;
          denA += da * da;
          denB += db * db;
        });

        const den = Math.sqrt(denA * denB);
        matrix[c1][c2] = den === 0 ? 0.0 : Number((num / den).toFixed(3));
      });
    });

    return { columns: cols, matrix };
  }, [dataset, numericalColumns]);

  // Smart Recommendations
  const presets = useMemo(() => {
    if (!dataset) return [];
    const p: { label: string; type: ChartType; x: string; y: string; agg: AggregationType }[] = [];
    const catCols = categoricalColumns;
    const numCols = numericalColumns;

    if (numCols.length > 0) {
      p.push({
        label: `${numCols[0]} Histogram`,
        type: "histogram",
        x: numCols[0],
        y: "",
        agg: "count",
      });
    }

    if (numCols.length >= 2) {
      p.push({
        label: "Feature Correlation Heatmap",
        type: "heatmap",
        x: numCols[0],
        y: numCols[1],
        agg: "mean",
      });
      p.push({
        label: `${numCols[0]} vs ${numCols[1]} Scatter`,
        type: "scatter",
        x: numCols[0],
        y: numCols[1],
        agg: "mean",
      });
      p.push({
        label: `${numCols[0]} Trend`,
        type: "line",
        x: numCols[0],
        y: numCols[1],
        agg: "mean",
      });
    }

    if (catCols.length > 0 && numCols.length > 0) {
      p.push({
        label: `${catCols[0]} vs ${numCols[0]}`,
        type: "bar",
        x: catCols[0],
        y: numCols[0],
        agg: "mean",
      });
      p.push({
        label: `${catCols[0]} Donut Share`,
        type: "donut",
        x: catCols[0],
        y: numCols[0],
        agg: "sum",
      });
    }

    return p;
  }, [dataset, categoricalColumns, numericalColumns]);

  // Chart Export Handlers (SVG and PNG)
  const handleExportSVG = () => {
    const svg = chartContainerRef.current?.querySelector("svg");
    if (!svg) {
      setExportNotice("Could not find SVG chart element to export.");
      return;
    }
    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(svg);
    const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${dataset?.metadata.name || "chart"}_${chartType}.svg`;
    link.click();
    URL.revokeObjectURL(url);
    setExportNotice("Exported SVG vector graphic successfully.");
    setTimeout(() => setExportNotice(null), 3000);
  };

  const handleExportPNG = () => {
    const svg = chartContainerRef.current?.querySelector("svg");
    if (!svg) {
      setExportNotice("Could not find SVG chart element to export.");
      return;
    }
    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(svg);
    const img = new window.Image();
    const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = (svg.clientWidth || 800) * 2;
      canvas.height = (svg.clientHeight || 500) * 2;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const pngUrl = canvas.toDataURL("image/png");
        const link = document.createElement("a");
        link.href = pngUrl;
        link.download = `${dataset?.metadata.name || "chart"}_${chartType}.png`;
        link.click();
        setExportNotice("Exported high-res PNG image successfully.");
        setTimeout(() => setExportNotice(null), 3000);
      }
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-8">
        <div className="p-8 rounded-2xl border border-border bg-card text-center space-y-3 shadow-lg">
          <Ring className="size-7 text-emerald-500 mx-auto" />
          <div className="text-xs font-mono text-muted-foreground">
            Initializing Interactive Visualization Engine...
          </div>
        </div>
      </div>
    );
  }

  if (!dataset || !dataset.records || dataset.records.length === 0) {
    return (
      <div className="min-h-screen bg-background text-foreground p-8 flex items-center justify-center">
        <div className="max-w-xl mx-auto rounded-2xl border border-border bg-card p-10 text-center space-y-5 shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
            <BarChart2 className="w-6 h-6" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-base font-bold text-foreground">No Dataset Loaded to Visualize</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
              Load a curated dataset or upload your custom CSV, Excel, or JSON data to begin generating interactive charts.
            </p>
          </div>
          <Link
            href="/explorer"
            className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition-all"
          >
            <span>Open Dataset Explorer</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8 pb-28 sm:pb-32 selection:bg-emerald-500 selection:text-white transition-colors duration-200">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header Breadcrumb */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border">
          <div className="space-y-1">
            <div className="flex items-center space-x-2 text-xs font-mono text-muted-foreground mb-1">
              <Link href="/dashboard" className="hover:text-foreground">Workspace</Link>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Visual Analytics</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center space-x-3">
              <span>Interactive Multi-Chart Studio</span>
            </h1>
            <p className="text-xs text-muted-foreground">
              Synthesize 7+ chart architectures, histograms, correlation heatmaps, and high-res vector exports from {dataset.metadata.name} ({dataset.total_rows.toLocaleString()} rows).
            </p>
          </div>

          <div className="flex items-center space-x-3">
            {/* Export Dropdown / Buttons */}
            <div className="flex items-center space-x-1.5 p-1 rounded-xl bg-card border border-border shadow-sm">
              <button
                onClick={handleExportPNG}
                className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-foreground hover:bg-muted transition-colors"
                title="Download high-resolution PNG image"
              >
                <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>PNG</span>
              </button>
              <button
                onClick={handleExportSVG}
                className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-foreground hover:bg-muted transition-colors"
                title="Download scalable vector SVG graphic"
              >
                <FileDown className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>SVG</span>
              </button>
            </div>

            <Link
              href="/quality"
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-foreground text-xs font-semibold transition-colors shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Clean Studio</span>
            </Link>
            <Link
              href="/studio"
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition-all"
            >
              <span>Train Models</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Export Notification Toast */}
        {exportNotice && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-200 text-xs font-medium flex items-center justify-between animate-in fade-in">
            <div className="flex items-center space-x-2">
              <Check className="w-4 h-4 text-emerald-500" />
              <span>{exportNotice}</span>
            </div>
            <button onClick={() => setExportNotice(null)} className="text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Smart Recommendations Bar */}
        {presets.length > 0 && (
          <div className="flex items-center space-x-2 overflow-x-auto pb-1 text-xs">
            <span className="font-mono text-muted-foreground flex items-center space-x-1 shrink-0">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Smart Presets:</span>
            </span>
            {presets.map((p, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setChartType(p.type);
                  if (p.x) setXAxisCol(p.x);
                  if (p.y) setYAxisCol(p.y);
                  setAggregation(p.agg);
                }}
                className={`px-2.5 py-1 rounded-full border text-xs font-medium transition-colors shrink-0 ${
                  chartType === p.type && xAxisCol === p.x
                    ? "bg-emerald-600 text-white border-emerald-500 font-semibold"
                    : "border-border bg-card hover:bg-muted text-foreground"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}

        {/* Workbench: Controls (Left) & Canvas (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Controls Sidebar */}
          <div className="space-y-5 lg:col-span-1">
            {/* 1. Chart Architecture Selector */}
            <div className="p-5 rounded-2xl border border-border bg-card space-y-3 shadow-sm">
              <label className="text-xs font-semibold text-foreground">1. Chart Architecture</label>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { id: "bar", name: "Bar", icon: BarChart2 },
                  { id: "line", name: "Line", icon: LineChartIcon },
                  { id: "area", name: "Area", icon: AreaIcon },
                  { id: "scatter", name: "Scatter", icon: ScatterIcon },
                  { id: "donut", name: "Donut", icon: CircleDot },
                  { id: "pie", name: "Pie", icon: PieChartIcon },
                  { id: "histogram", name: "Histogram", icon: Activity },
                  { id: "heatmap", name: "Heatmap", icon: Grid3X3 },
                ].map((item) => {
                  const Icon = item.icon;
                  const isSelected = chartType === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setChartType(item.id as ChartType)}
                      className={`p-2 rounded-xl border flex flex-col items-center space-y-1 transition-all ${
                        isSelected
                          ? "bg-emerald-600 text-white border-emerald-500 shadow-sm"
                          : "bg-muted/40 border-border text-muted-foreground hover:text-foreground hover:bg-muted/70"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-medium truncate w-full text-center">{item.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Axis Configuration */}
            {chartType !== "heatmap" && (
              <div className="p-5 rounded-2xl border border-border bg-card space-y-4 shadow-sm">
                <label className="text-xs font-semibold text-foreground">2. Dimension &amp; Metric</label>

                {/* X-Axis */}
                <div className="space-y-1.5">
                  <label className="text-[11px] text-muted-foreground font-medium">
                    {chartType === "histogram"
                      ? "Distribution Feature (Numeric)"
                      : chartType === "pie" || chartType === "donut"
                      ? "Category Slices"
                      : "X-Axis (Independent)"}
                  </label>
                  <select
                    value={xAxisCol}
                    onChange={(e) => setXAxisCol(e.target.value)}
                    className="w-full bg-background border border-border rounded-xl p-2.5 text-xs text-foreground focus:outline-none focus:border-emerald-500"
                  >
                    {dataset.columns.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name} ({c.dtype})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Y-Axis */}
                {chartType !== "histogram" && (
                  <div className="space-y-1.5">
                    <label className="text-[11px] text-muted-foreground font-medium">
                      {chartType === "pie" || chartType === "donut"
                        ? "Slice Metric (Value)"
                        : "Y-Axis (Metric / Value)"}
                    </label>
                    <select
                      value={yAxisCol}
                      onChange={(e) => setYAxisCol(e.target.value)}
                      className="w-full bg-background border border-border rounded-xl p-2.5 text-xs text-foreground focus:outline-none focus:border-emerald-500"
                    >
                      <option value="">(None / Record Count)</option>
                      {numericalColumns.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Aggregation */}
                {chartType !== "scatter" && chartType !== "histogram" && (
                  <div className="space-y-1.5">
                    <label className="text-[11px] text-muted-foreground font-medium">Aggregation Operator</label>
                    <div className="grid grid-cols-3 gap-1 text-[11px]">
                      {(["mean", "sum", "count", "min", "max"] as const).map((agg) => (
                        <button
                          key={agg}
                          type="button"
                          onClick={() => setAggregation(agg)}
                          className={`p-1.5 rounded-lg uppercase font-mono text-center transition-all ${
                            aggregation === agg
                              ? "bg-emerald-600 text-white font-semibold"
                              : "bg-muted/60 text-muted-foreground hover:text-foreground border border-border"
                          }`}
                        >
                          {agg}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Top N Limit */}
                {chartType !== "scatter" && chartType !== "histogram" && (
                  <div className="space-y-1.5 pt-2">
                    <div className="flex justify-between text-[11px] text-muted-foreground">
                      <span>Display Top Slices</span>
                      <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">{topN}</span>
                    </div>
                    <input
                      type="range"
                      min="5"
                      max="30"
                      step="5"
                      value={topN}
                      onChange={(e) => setTopN(parseInt(e.target.value))}
                      className="w-full h-1.5 bg-muted rounded-full appearance-none cursor-pointer accent-emerald-500"
                    />
                  </div>
                )}
              </div>
            )}

            {/* 3. Filters & Canvas Settings */}
            <div className="p-5 rounded-2xl border border-border bg-card space-y-3.5 shadow-sm">
              <label className="text-xs font-semibold text-foreground flex items-center space-x-1.5">
                <Sliders className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>3. Filters &amp; Controls</span>
              </label>

              {/* Exclude Nulls Toggle */}
              <label className="flex items-center space-x-2 text-xs text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={excludeNulls}
                  onChange={(e) => setExcludeNulls(e.target.checked)}
                  className="rounded border-border text-emerald-600 focus:ring-emerald-500 accent-emerald-600"
                />
                <span>Exclude Null / Missing Values</span>
              </label>

              {/* Grid Toggle */}
              <label className="flex items-center space-x-2 text-xs text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={showGrid}
                  onChange={(e) => setShowGrid(e.target.checked)}
                  className="rounded border-border text-emerald-600 focus:ring-emerald-500 accent-emerald-600"
                />
                <span>Show Cartesian Gridlines</span>
              </label>

              {/* Legend Toggle */}
              <label className="flex items-center space-x-2 text-xs text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={showLegend}
                  onChange={(e) => setShowLegend(e.target.checked)}
                  className="rounded border-border text-emerald-600 focus:ring-emerald-500 accent-emerald-600"
                />
                <span>Show Series Legend</span>
              </label>

              {/* Keyword Filter */}
              <div className="space-y-1 pt-1">
                <label className="text-[11px] text-muted-foreground font-medium">Search / Filter Axis</label>
                <input
                  type="text"
                  value={filterKeyword}
                  onChange={(e) => setFilterKeyword(e.target.value)}
                  placeholder="Filter category label..."
                  className="w-full bg-background border border-border rounded-lg p-2 text-xs text-foreground focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Minimum Threshold */}
              {yAxisCol && (
                <div className="space-y-1">
                  <label className="text-[11px] text-muted-foreground font-medium">Min Metric Threshold</label>
                  <input
                    type="number"
                    value={minThreshold}
                    onChange={(e) => setMinThreshold(e.target.value)}
                    placeholder="e.g. 10.0"
                    className="w-full bg-background border border-border rounded-lg p-2 text-xs text-foreground focus:outline-none focus:border-emerald-500"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Chart Display Canvas */}
          <div className="lg:col-span-3 space-y-6">
            <div className="p-6 rounded-2xl border border-border bg-card space-y-5 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border">
                <div>
                  <h3 className="font-bold text-base text-foreground capitalize">
                    {chartType === "heatmap"
                      ? "Pairwise Feature Correlation Heatmap"
                      : chartType === "histogram"
                      ? `Distribution Histogram: ${xAxisCol}`
                      : `${chartType} Visualization: ${xAxisCol} ${yAxisCol ? `vs ${yAxisCol} (${aggregation.toUpperCase()})` : "(Frequency Count)"}`}
                  </h3>
                  <div className="text-xs font-mono text-muted-foreground mt-0.5">
                    {chartType === "heatmap"
                      ? `Showing Pearson correlation matrix across ${numericalColumns.slice(0, 8).length} numeric features`
                      : `Displaying ${computedChartData.length} records computed over ${filteredRows.length.toLocaleString()} active observations`}
                  </div>
                </div>

                <div className="flex items-center space-x-2 text-xs font-mono text-emerald-600 dark:text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Phase 3 Studio Active</span>
                </div>
              </div>

              {/* Chart Body Container */}
              <div ref={chartContainerRef} className="h-96 w-full pt-2">
                {chartType === "heatmap" ? (
                  !correlationMatrix ? (
                    <div className="h-full flex items-center justify-center text-xs font-mono text-muted-foreground">
                      Dataset requires at least 2 numeric columns for correlation heatmap.
                    </div>
                  ) : (
                    <div className="h-full overflow-auto flex flex-col items-center justify-center p-2">
                      <div className="inline-block border border-border rounded-xl overflow-hidden shadow-sm">
                        <table className="text-xs font-mono border-collapse">
                          <thead>
                            <tr className="bg-muted">
                              <th className="p-2 border border-border text-left text-muted-foreground font-semibold">
                                Feature
                              </th>
                              {correlationMatrix.columns.map((col) => (
                                <th
                                  key={col}
                                  className="p-2 border border-border text-center text-muted-foreground font-semibold max-w-[90px] truncate"
                                  title={col}
                                >
                                  {col}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {correlationMatrix.columns.map((rowCol) => (
                              <tr key={rowCol} className="hover:bg-muted/30">
                                <td className="p-2 border border-border font-semibold text-foreground max-w-[130px] truncate" title={rowCol}>
                                  {rowCol}
                                </td>
                                {correlationMatrix.columns.map((colCol) => {
                                  const r = correlationMatrix.matrix[rowCol]?.[colCol] ?? 0;
                                  const isPos = r >= 0;
                                  const intensity = Math.abs(r);
                                  const bgColor =
                                    r === 1.0
                                      ? "rgba(16, 185, 129, 0.4)"
                                      : isPos
                                      ? `rgba(16, 185, 129, ${Math.max(0.08, intensity * 0.5)})`
                                      : `rgba(239, 68, 68, ${Math.max(0.08, intensity * 0.45)})`;
                                  return (
                                    <td
                                      key={colCol}
                                      style={{ backgroundColor: bgColor }}
                                      className="p-2 border border-border text-center font-bold text-[11px] transition-colors"
                                      title={`${rowCol} vs ${colCol}: Pearson r = ${r}`}
                                    >
                                      {r.toFixed(2)}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="flex items-center space-x-4 pt-3 text-[11px] font-mono text-muted-foreground">
                        <span className="flex items-center space-x-1">
                          <span className="w-3 h-3 rounded bg-emerald-500/40 inline-block border border-emerald-500" />
                          <span>Positive Correlation (0 to +1)</span>
                        </span>
                        <span className="flex items-center space-x-1">
                          <span className="w-3 h-3 rounded bg-rose-500/40 inline-block border border-rose-500" />
                          <span>Negative Correlation (-1 to 0)</span>
                        </span>
                      </div>
                    </div>
                  )
                ) : computedChartData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs font-mono text-muted-foreground">
                    Select valid axes dimensions to render chart
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    {chartType === "bar" || chartType === "histogram" ? (
                      <BarChart data={computedChartData} margin={{ top: 10, right: 20, left: 0, bottom: 40 }}>
                        {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="opacity-10" vertical={false} />}
                        <XAxis dataKey="name" stroke="#71717A" fontSize={11} interval={0} angle={-25} textAnchor="end" />
                        <YAxis stroke="#71717A" fontSize={11} domain={[0, "auto"]} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            borderColor: "hsl(var(--border))",
                            borderRadius: "8px",
                            fontSize: "12px",
                            color: "hsl(var(--foreground))",
                          }}
                        />
                        {showLegend && <Legend verticalAlign="top" height={30} />}
                        <Bar
                          dataKey="value"
                          name={chartType === "histogram" ? "Observation Frequency" : yAxisCol || "Count"}
                          fill="#10B981"
                          radius={[4, 4, 0, 0]}
                        >
                          {computedChartData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={PALETTE[index % PALETTE.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    ) : chartType === "line" ? (
                      <LineChart data={computedChartData} margin={{ top: 10, right: 20, left: 0, bottom: 40 }}>
                        {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="opacity-10" />}
                        <XAxis dataKey="name" stroke="#71717A" fontSize={11} angle={-25} textAnchor="end" />
                        <YAxis stroke="#71717A" fontSize={11} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            borderColor: "hsl(var(--border))",
                            borderRadius: "8px",
                            fontSize: "12px",
                            color: "hsl(var(--foreground))",
                          }}
                        />
                        {showLegend && <Legend verticalAlign="top" height={30} />}
                        <Line
                          type="monotone"
                          dataKey="value"
                          name={yAxisCol || "Value"}
                          stroke="#10B981"
                          strokeWidth={2.5}
                          dot={{ fill: "#10B981", r: 4 }}
                          activeDot={{ r: 6 }}
                        />
                      </LineChart>
                    ) : chartType === "area" ? (
                      <AreaChart data={computedChartData} margin={{ top: 10, right: 20, left: 0, bottom: 40 }}>
                        <defs>
                          <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                          </linearGradient>
                        </defs>
                        {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="opacity-10" />}
                        <XAxis dataKey="name" stroke="#71717A" fontSize={11} angle={-25} textAnchor="end" />
                        <YAxis stroke="#71717A" fontSize={11} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            borderColor: "hsl(var(--border))",
                            borderRadius: "8px",
                            fontSize: "12px",
                            color: "hsl(var(--foreground))",
                          }}
                        />
                        {showLegend && <Legend verticalAlign="top" height={30} />}
                        <Area
                          type="monotone"
                          dataKey="value"
                          name={yAxisCol || "Value"}
                          stroke="#10B981"
                          strokeWidth={2}
                          fillOpacity={1}
                          fill="url(#colorValue)"
                        />
                      </AreaChart>
                    ) : chartType === "scatter" ? (
                      <ScatterChart margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                        {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="opacity-10" />}
                        <XAxis dataKey="x" name={xAxisCol} stroke="#71717A" fontSize={11} />
                        <YAxis dataKey="y" name={yAxisCol} stroke="#71717A" fontSize={11} />
                        <Tooltip
                          cursor={{ strokeDasharray: "3 3" }}
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            borderColor: "hsl(var(--border))",
                            borderRadius: "8px",
                            fontSize: "12px",
                            color: "hsl(var(--foreground))",
                          }}
                        />
                        {showLegend && <Legend verticalAlign="top" height={30} />}
                        <Scatter name={`${xAxisCol} vs ${yAxisCol}`} data={computedChartData} fill="#10B981" />
                      </ScatterChart>
                    ) : (
                      <PieChart>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            borderColor: "hsl(var(--border))",
                            borderRadius: "8px",
                            fontSize: "12px",
                            color: "hsl(var(--foreground))",
                          }}
                        />
                        {showLegend && <Legend verticalAlign="bottom" height={36} />}
                        <Pie
                          data={computedChartData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={chartType === "donut" ? 65 : 0}
                          outerRadius={95}
                          paddingAngle={chartType === "donut" ? 3 : 0}
                        >
                          {computedChartData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={PALETTE[index % PALETTE.length]} />
                          ))}
                        </Pie>
                      </PieChart>
                    )}
                  </ResponsiveContainer>
                )}
              </div>

              {/* Underlying Data Telemetry Table */}
              {chartType !== "heatmap" && (
                <div className="border-t border-border pt-4">
                  <div className="flex items-center justify-between text-xs mb-3">
                    <span className="font-semibold text-foreground">Underlying Aggregation Table</span>
                    <span className="font-mono text-muted-foreground">{computedChartData.length} records</span>
                  </div>
                  <div className="max-h-48 overflow-y-auto rounded-xl border border-border">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="bg-muted text-muted-foreground uppercase text-[10px]">
                        <tr>
                          <th className="p-2.5">
                            {chartType === "histogram" ? "Bin Range" : `Category (${xAxisCol})`}
                          </th>
                          <th className="p-2.5 text-right">
                            {chartType === "histogram" ? "Frequency Count" : `Value (${aggregation.toUpperCase()})`}
                          </th>
                          <th className="p-2.5 text-right">Observation Count</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {computedChartData.map((row) => (
                          <tr key={row.name} className="hover:bg-muted/40">
                            <td className="p-2.5 font-semibold text-foreground truncate max-w-xs">{row.name}</td>
                            <td className="p-2.5 text-right font-bold text-emerald-600 dark:text-emerald-400">
                              {row.value.toLocaleString()}
                            </td>
                            <td className="p-2.5 text-right text-muted-foreground">{row.count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Floating Command Dock */}
      <RetroDock />
    </div>
  );
}
