"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  BarChart2,
  LineChart as LineChartIcon,
  PieChart as PieChartIcon,
  ScatterChart as ScatterIcon,
  AreaChart as AreaIcon,
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
];

type ChartType = "bar" | "line" | "area" | "scatter" | "pie";
type AggregationType = "sum" | "mean" | "count" | "min" | "max";

export default function VisualizePage() {
  const [dataset, setDataset] = useState<DatasetPreviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Chart Configuration State
  const [chartType, setChartType] = useState<ChartType>("bar");
  const [xAxisCol, setXAxisCol] = useState<string>("");
  const [yAxisCol, setYAxisCol] = useState<string>("");
  const [aggregation, setAggregation] = useState<AggregationType>("mean");
  const [topN, setTopN] = useState<number>(15);

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

  // Aggregated Chart Data Computation
  const computedChartData = useMemo(() => {
    if (!dataset || !dataset.records || !xAxisCol) return [];
    const rows = dataset.records;

    if (chartType === "scatter") {
      // Scatter uses raw coordinates without aggregation
      return rows
        .map((r, i) => {
          const xVal = typeof r[xAxisCol] === "number" ? r[xAxisCol] : i;
          const yVal = yAxisCol && typeof r[yAxisCol] === "number" ? r[yAxisCol] : 0;
          return {
            name: `Sample #${i + 1} (${xAxisCol}: ${xVal})`,
            value: Number(yVal),
            count: 1,
            x: xVal,
            y: yVal,
            label: String(r[xAxisCol] ?? i),
          };
        })
        .filter((pt) => pt.x !== null && pt.y !== null)
        .slice(0, 100);
    }

    // Grouping by X-Axis column
    const groups: { [key: string]: number[] } = {};
    rows.forEach((r) => {
      const key = String(r[xAxisCol] ?? "Unknown");
      if (!groups[key]) groups[key] = [];

      if (yAxisCol && typeof r[yAxisCol] === "number") {
        groups[key].push(r[yAxisCol]);
      } else {
        groups[key].push(1); // For count
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

    // Sort by value descending and slice to topN
    result.sort((a, b) => b.value - a.value);
    return result.slice(0, topN);
  }, [dataset, xAxisCol, yAxisCol, aggregation, chartType, topN]);

  // Smart presets based on schema
  const presets = useMemo(() => {
    if (!dataset) return [];
    const p: { label: string; type: ChartType; x: string; y: string; agg: AggregationType }[] = [];
    const catCols = categoricalColumns;
    const numCols = numericalColumns;

    if (catCols.length > 0 && numCols.length > 0) {
      p.push({
        label: `${catCols[0]} vs ${numCols[0]}`,
        type: "bar",
        x: catCols[0],
        y: numCols[0],
        agg: "mean",
      });
      p.push({
        label: `${catCols[0]} Share`,
        type: "pie",
        x: catCols[0],
        y: numCols[0],
        agg: "sum",
      });
    }
    if (numCols.length >= 2) {
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
    if (catCols.length > 0) {
      p.push({
        label: `${catCols[0]} Frequency`,
        type: "bar",
        x: catCols[0],
        y: "",
        agg: "count",
      });
    }
    return p;
  }, [dataset, categoricalColumns, numericalColumns]);

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
              Synthesize interactive charts, scatter distributions, and aggregation graphs from {dataset.metadata.name} ({dataset.total_rows.toLocaleString()} rows).
            </p>
          </div>

          <div className="flex items-center space-x-3">
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
                  setXAxisCol(p.x);
                  setYAxisCol(p.y);
                  setAggregation(p.agg);
                }}
                className="px-2.5 py-1 rounded-full border border-border bg-card hover:bg-muted text-foreground text-xs font-medium transition-colors shrink-0"
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
            {/* 1. Chart Type Selector */}
            <div className="p-5 rounded-2xl border border-border bg-card space-y-3 shadow-sm">
              <label className="text-xs font-semibold text-foreground">1. Chart Architecture</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "bar", name: "Bar", icon: BarChart2 },
                  { id: "line", name: "Line", icon: LineChartIcon },
                  { id: "area", name: "Area", icon: AreaIcon },
                  { id: "scatter", name: "Scatter", icon: ScatterIcon },
                  { id: "pie", name: "Donut", icon: PieChartIcon },
                ].map((item) => {
                  const Icon = item.icon;
                  const isSelected = chartType === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setChartType(item.id as ChartType)}
                      className={`p-2.5 rounded-xl border flex flex-col items-center space-y-1 transition-all ${
                        isSelected
                          ? "bg-emerald-600 text-white border-emerald-500 shadow-sm"
                          : "bg-muted/40 border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="text-[11px] font-medium">{item.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Axis Configuration */}
            <div className="p-5 rounded-2xl border border-border bg-card space-y-4 shadow-sm">
              <label className="text-xs font-semibold text-foreground">2. Dimension &amp; Metric</label>

              {/* X-Axis */}
              <div className="space-y-1.5">
                <label className="text-[11px] text-muted-foreground font-medium">
                  {chartType === "pie" ? "Category Segment (Slices)" : "X-Axis (Group / Independent)"}
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
              <div className="space-y-1.5">
                <label className="text-[11px] text-muted-foreground font-medium">
                  {chartType === "pie" ? "Slice Metric (Value)" : "Y-Axis (Metric / Value)"}
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

              {/* Aggregation */}
              {chartType !== "scatter" && (
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
              <div className="space-y-1.5 pt-2">
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>Display Top Categories</span>
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
            </div>
          </div>

          {/* Chart Display Canvas */}
          <div className="lg:col-span-3 space-y-6">
            <div className="p-6 rounded-2xl border border-border bg-card space-y-5 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border">
                <div>
                  <h3 className="font-bold text-base text-foreground capitalize">
                    {chartType} Visualization: {xAxisCol} {yAxisCol ? `vs ${yAxisCol} (${aggregation.toUpperCase()})` : "(Frequency Count)"}
                  </h3>
                  <div className="text-xs font-mono text-muted-foreground mt-0.5">
                    Showing top {computedChartData.length} records computed over sample space
                  </div>
                </div>

                <div className="flex items-center space-x-2 text-xs font-mono text-emerald-600 dark:text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Interactive Engine</span>
                </div>
              </div>

              {/* Chart Body */}
              <div className="h-96 w-full pt-2">
                {computedChartData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs font-mono text-muted-foreground">
                    Select valid axes dimensions to render chart
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    {chartType === "bar" ? (
                      <BarChart data={computedChartData} margin={{ top: 10, right: 20, left: 0, bottom: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="opacity-10" vertical={false} />
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
                        <Bar dataKey="value" fill="#10B981" radius={[4, 4, 0, 0]}>
                          {computedChartData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={PALETTE[index % PALETTE.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    ) : chartType === "line" ? (
                      <LineChart data={computedChartData} margin={{ top: 10, right: 20, left: 0, bottom: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="opacity-10" />
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
                        <Line type="monotone" dataKey="value" stroke="#10B981" strokeWidth={2.5} dot={{ fill: "#10B981", r: 4 }} activeDot={{ r: 6 }} />
                      </LineChart>
                    ) : chartType === "area" ? (
                      <AreaChart data={computedChartData} margin={{ top: 10, right: 20, left: 0, bottom: 40 }}>
                        <defs>
                          <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="opacity-10" />
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
                        <Area type="monotone" dataKey="value" stroke="#10B981" strokeWidth={2} fillOpacity={1} fill="url(#colorValue)" />
                      </AreaChart>
                    ) : chartType === "scatter" ? (
                      <ScatterChart margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="opacity-10" />
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
                        <Scatter name="Data Points" data={computedChartData} fill="#10B981" />
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
                        <Legend verticalAlign="bottom" height={36} />
                        <Pie
                          data={computedChartData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={65}
                          outerRadius={95}
                          paddingAngle={3}
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
              <div className="border-t border-border pt-4">
                <div className="flex items-center justify-between text-xs mb-3">
                  <span className="font-semibold text-foreground">Underlying Aggregation Table</span>
                  <span className="font-mono text-muted-foreground">{computedChartData.length} records</span>
                </div>
                <div className="max-h-48 overflow-y-auto rounded-xl border border-border">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-muted text-muted-foreground uppercase text-[10px]">
                      <tr>
                        <th className="p-2.5">Category ({xAxisCol})</th>
                        <th className="p-2.5 text-right">Value ({aggregation.toUpperCase()})</th>
                        <th className="p-2.5 text-right">Sample Count</th>
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
            </div>
          </div>
        </div>
      </div>

      {/* Floating Command Dock */}
      <RetroDock />
    </div>
  );
}
