"use client";

import { useEffect, useState, useId } from "react";
import Link from "next/link";
import {
  FileText,
  Download,
  Code,
  Layers,
  Database,
  Cpu,
  CheckCircle2,
  ExternalLink,
  ArrowRight,
  FileSpreadsheet,
  FileArchive,
  Sparkles,
  Share2,
  Bookmark,
  Eye,
  Lock,
  Calendar,
  Clock,
  Trash2,
  Copy,
  Check,
  X,
  Printer,
  ChevronRight,
  ShieldCheck,
  AlertCircle,
  Upload
} from "lucide-react";
import { Ring } from "@/components/loading-ui/ring";
import { api } from "@/lib/api";
import { loadActiveWorkspace } from "@/lib/workspace-restore";
import {
  ModelComparisonResponse,
  DatasetPreviewResponse,
  ReportPreviewResponse,
  SavedProject,
  ShareInfo
} from "@/lib/types";
import { RetroDock } from "@/components/retro-dock";

export default function ReportsPage() {
  const [activeDataset, setActiveDataset] = useState<DatasetPreviewResponse | null>(null);
  const [comparison, setComparison] = useState<ModelComparisonResponse | null>(null);
  const [previewData, setPreviewData] = useState<ReportPreviewResponse | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [loading, setLoading] = useState(true);

  // Section Filters
  const [includedSections, setIncludedSections] = useState<string[]>([
    "summary",
    "quality",
    "cleaning",
    "ml",
    "dictionary",
    "sample"
  ]);

  // Modals & Drawers State
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showProjectsDrawer, setShowProjectsDrawer] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  // Projects State
  const [projectsList, setProjectsList] = useState<SavedProject[]>([]);
  const [projectName, setProjectName] = useState("");
  const [projectDesc, setProjectDesc] = useState("");
  const [isSavingProject, setIsSavingProject] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState("");

  // Share State
  const [shareTitle, setShareTitle] = useState("");
  const [sharePassword, setSharePassword] = useState("");
  const [shareExpiryHours, setShareExpiryHours] = useState<number>(168); // 7 days default
  const [isGeneratingShare, setIsGeneratingShare] = useState(false);
  const [generatedShare, setGeneratedShare] = useState<ShareInfo | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    async function init() {
      try {
        // Fetch active dataset
        try {
          const ds = await api.getActiveDataset();
          setActiveDataset(ds);
          setProjectName(ds.metadata.name ? `${ds.metadata.name} Analysis` : "Dataset Analysis");
          setShareTitle(ds.metadata.name ? `${ds.metadata.name} Executive Report` : "Executive Report");
        } catch {
          try {
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
              setProjectName(restored.dataset.metadata?.name ? `${restored.dataset.metadata.name} Analysis` : "Dataset Analysis");
              setShareTitle(restored.dataset.metadata?.name ? `${restored.dataset.metadata.name} Executive Report` : "Executive Report");
            }
          } catch {
            // No local cached workspace
          }
        }

        // Fetch model comparison if available
        try {
          const comp = await api.getModelComparison();
          setComparison(comp);
          if (comp.available_models.length > 0) {
            setSelectedModel(comp.champion.name || comp.available_models[0]);
          }
        } catch {
          // ML models not trained yet
        }

        // Fetch saved projects list
        try {
          const projs = await api.listProjects();
          setProjectsList(projs.projects || []);
        } catch {
          // Silent catch
        }
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  const toggleSection = (sec: string) => {
    setIncludedSections((prev) =>
      prev.includes(sec) ? prev.filter((s) => s !== sec) : [...prev, sec]
    );
  };

  const handleOpenPreview = async () => {
    setShowPreviewModal(true);
    if (!previewData) {
      try {
        const data = await api.getReportPreview();
        setPreviewData(data);
      } catch (err) {
        console.error("Failed to load preview data", err);
      }
    }
  };

  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) return;
    setIsSavingProject(true);
    setSaveSuccessMsg("");
    try {
      const res = await api.saveProject(projectName, projectDesc);
      setSaveSuccessMsg("Project saved successfully!");
      const projs = await api.listProjects();
      setProjectsList(projs.projects || []);
      setTimeout(() => {
        setShowSaveModal(false);
        setSaveSuccessMsg("");
      }, 1200);
    } catch (err: any) {
      alert("Failed to save project: " + (err.response?.data?.detail || err.message));
    } finally {
      setIsSavingProject(false);
    }
  };

  const handleRestoreProject = async (projectId: string) => {
    if (!confirm("Restoring this project will overwrite the current active workspace. Proceed?")) return;
    try {
      setLoading(true);
      await api.loadProject(projectId);
      window.location.reload();
    } catch (err: any) {
      alert("Failed to restore project: " + (err.response?.data?.detail || err.message));
      setLoading(false);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    if (!confirm("Are you sure you want to permanently delete this saved project?")) return;
    try {
      await api.deleteProject(projectId);
      setProjectsList((prev) => prev.filter((p) => p.id !== projectId));
    } catch (err: any) {
      alert("Failed to delete project: " + (err.response?.data?.detail || err.message));
    }
  };

  const handleImportBundle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setLoading(true);
      const res = await api.importProjectBundle(file);
      if (res.status === "success") {
        alert(`Project "${res.project?.name || "Bundle"}" imported successfully!`);
        const updated = await api.listProjects();
        setProjectsList(updated.projects || []);
      }
    } catch (err: any) {
      alert("Failed to import project bundle: " + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  };

  const handleCreateShare = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGeneratingShare(true);
    try {
      const res = await api.createShare({
        title: shareTitle,
        sections: includedSections,
        password: sharePassword || undefined,
        expires_in_hours: shareExpiryHours > 0 ? shareExpiryHours : undefined,
      });
      setGeneratedShare(res.share);
    } catch (err: any) {
      alert("Failed to create share link: " + (err.response?.data?.detail || err.message));
    } finally {
      setIsGeneratingShare(false);
    }
  };

  const handleCopyShareLink = () => {
    if (!generatedShare) return;
    const fullUrl = `${window.location.origin}${generatedShare.share_url}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-8">
        <div className="p-8 rounded-2xl border border-border bg-card text-center space-y-3 shadow-lg">
          <Ring className="size-7 text-emerald-500 mx-auto" />
          <div className="text-xs font-mono text-muted-foreground">
            Compiling evaluation reports, dossiers and saved project lineage...
          </div>
        </div>
      </div>
    );
  }

  if (!activeDataset && !comparison) {
    return (
      <div className="min-h-screen bg-background text-foreground p-8">
        <div className="max-w-xl mx-auto rounded-2xl border border-border bg-card p-10 text-center space-y-5 shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
            <FileText className="w-6 h-6" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-base font-bold text-foreground">No Dataset or Workspace Found</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
              Load a curated benchmark or upload a dataset in Dataset Explorer to generate executive reports, export clean CSV/Excel files, and save analysis projects.
            </p>
          </div>
          <div className="flex justify-center gap-3 pt-2">
            <Link
              href="/explorer"
              className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition-all"
            >
              <span>Explore Datasets</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const pdfUrl = api.getPdfReportUrl(includedSections);
  const htmlUrl = api.getHtmlReportUrl(includedSections);
  const jsonUrl = api.getJsonReportUrl();
  const mdUrl = api.getMarkdownReportUrl();
  const csvUrl = api.getCsvReportUrl();
  const excelUrl = api.getExcelReportUrl();
  const projectStateUrl = api.getProjectStateUrl();
  const modelUrl = selectedModel ? api.getModelDownloadUrl(selectedModel) : "";

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8 pb-28 sm:pb-32 selection:bg-emerald-500 selection:text-white transition-colors duration-200">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Top Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-border">
          <div className="space-y-1">
            <div className="flex items-center space-x-2 text-xs font-mono text-emerald-600 dark:text-emerald-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Executive Reporting, Saved Projects &amp; Sharing</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Analytics Reports &amp; Export Depot
            </h1>
            <p className="text-xs text-muted-foreground">
              Dataset: <strong className="text-foreground">{activeDataset?.metadata.name || "Active Workspace"}</strong> &bull; {activeDataset?.total_rows.toLocaleString()} rows &times; {activeDataset?.total_cols} columns
            </p>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleOpenPreview}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-card hover:bg-muted text-foreground border border-border text-xs font-semibold shadow-sm transition-all"
            >
              <Eye className="w-3.5 h-3.5 text-emerald-500" />
              <span>Preview Report</span>
            </button>

            <button
              onClick={() => setShowSaveModal(true)}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-card hover:bg-muted text-foreground border border-border text-xs font-semibold shadow-sm transition-all"
            >
              <Bookmark className="w-3.5 h-3.5 text-emerald-500" />
              <span>Save Project</span>
            </button>

            <button
              onClick={() => setShowProjectsDrawer(true)}
              className="relative inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-card hover:bg-muted text-foreground border border-border text-xs font-semibold shadow-sm transition-all"
            >
              <FileArchive className="w-3.5 h-3.5 text-emerald-500" />
              <span>Saved Projects</span>
              {projectsList.length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold border border-emerald-500/30">
                  {projectsList.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setShowShareModal(true)}
              className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm shadow-emerald-600/30 transition-all active:scale-95"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Share Analysis</span>
            </button>
          </div>
        </div>

        {/* Section Customization Selector */}
        <div className="p-4 rounded-2xl border border-border bg-card/70 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-emerald-500" />
              <span className="text-xs font-semibold text-foreground">Customize Export Sections</span>
            </div>
            <span className="text-[11px] text-muted-foreground font-mono">
              Applies to PDF &amp; HTML downloads
            </span>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            {[
              { id: "summary", label: "Executive Summary" },
              { id: "quality", label: "Data Quality Audit" },
              { id: "cleaning", label: "Cleaning Lineage" },
              { id: "ml", label: "Machine Learning Scoreboard" },
              { id: "dictionary", label: "Feature Dictionary" },
              { id: "sample", label: "Data Sample Preview" },
            ].map((sec) => {
              const active = includedSections.includes(sec.id);
              return (
                <button
                  key={sec.id}
                  onClick={() => toggleSection(sec.id)}
                  className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    active
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                      : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      active ? "bg-emerald-500" : "bg-muted-foreground/40"
                    }`}
                  />
                  <span>{sec.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Primary Export Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Card 1: Executive PDF Dossier */}
          <div className="rounded-2xl border border-border bg-card p-6 flex flex-col justify-between space-y-5 hover:border-emerald-500/50 hover:shadow-md transition-all duration-200">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  Publication-Ready PDF
                </span>
                <h3 className="font-semibold text-base text-foreground mt-2">Executive PDF Report (.pdf)</h3>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Multi-page PDF featuring executive KPI cards, quality health audit, data cleaning trail, and ML scoreboard.
              </p>
            </div>
            <div className="flex gap-2">
              <a
                href={pdfUrl}
                download
                className="flex-1 inline-flex items-center justify-center space-x-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-sm shadow-emerald-600/30 transition-all active:scale-95"
              >
                <Download className="w-4 h-4" />
                <span>Download PDF</span>
              </a>
              <button
                onClick={handleOpenPreview}
                className="px-3 py-2.5 rounded-xl bg-muted hover:bg-muted/80 text-foreground border border-border text-xs transition-colors"
                title="Preview before download"
              >
                <Eye className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Card 2: Multi-Sheet Excel Dossier */}
          <div className="rounded-2xl border border-border bg-card p-6 flex flex-col justify-between space-y-5 hover:border-emerald-500/50 hover:shadow-md transition-all duration-200">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  Multi-Sheet Workbook
                </span>
                <h3 className="font-semibold text-base text-foreground mt-2">Executive Excel Dossier (.xlsx)</h3>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Comprehensive 6-sheet workbook with Overview, Data Dictionary, Quality Audit, Cleaning Lineage, and Top Records.
              </p>
            </div>
            <a
              href={excelUrl}
              download
              className="w-full inline-flex items-center justify-center space-x-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-sm shadow-emerald-600/30 transition-all active:scale-95"
            >
              <Download className="w-4 h-4" />
              <span>Download Excel (.xlsx)</span>
            </a>
          </div>

          {/* Card 3: Cleaned Dataset CSV */}
          <div className="rounded-2xl border border-border bg-card p-6 flex flex-col justify-between space-y-5 hover:border-emerald-500/50 hover:shadow-md transition-all duration-200">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">
                  Clean Data Export
                </span>
                <h3 className="font-semibold text-base text-foreground mt-2">Cleaned Dataset (.csv)</h3>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Download the transformed dataset with imputed values, cleaned duplicates, and standard headers for Jupyter/Pandas.
              </p>
            </div>
            <a
              href={csvUrl}
              download
              className="w-full inline-flex items-center justify-center space-x-2 py-2.5 rounded-xl bg-muted hover:bg-muted/80 text-foreground border border-border font-semibold text-xs transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Download Cleaned CSV</span>
            </a>
          </div>

          {/* Card 4: Interactive HTML Dossier */}
          <div className="rounded-2xl border border-border bg-card p-6 flex flex-col justify-between space-y-5 hover:border-emerald-500/50 hover:shadow-md transition-all duration-200">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  Stand-alone Webpage
                </span>
                <h3 className="font-semibold text-base text-foreground mt-2">Interactive HTML Dossier</h3>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Self-contained, responsive report featuring metadata, data quality health scores, model scoreboard, and lineage.
              </p>
            </div>
            <a
              href={htmlUrl}
              download
              className="w-full inline-flex items-center justify-center space-x-2 py-2.5 rounded-xl bg-muted hover:bg-muted/80 text-foreground border border-border font-semibold text-xs transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Download HTML Dossier</span>
            </a>
          </div>

          {/* Card 5: Machine-Readable JSON Snapshot */}
          <div className="rounded-2xl border border-border bg-card p-6 flex flex-col justify-between space-y-5 hover:border-emerald-500/50 hover:shadow-md transition-all duration-200">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-600 dark:text-violet-400 flex items-center justify-center">
                <Code className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20">
                  Workspace Archive
                </span>
                <h3 className="font-semibold text-base text-foreground mt-2">Machine-Readable JSON (.json)</h3>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Complete reproducible session snapshot including cleaning lineage, model configurations, and telemetry.
              </p>
            </div>
            <a
              href={projectStateUrl}
              download
              className="w-full inline-flex items-center justify-center space-x-2 py-2.5 rounded-xl bg-muted hover:bg-muted/80 text-foreground border border-border font-semibold text-xs transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Download Project JSON</span>
            </a>
          </div>

          {/* Card 6: GitHub README Markdown */}
          <div className="rounded-2xl border border-border bg-card p-6 flex flex-col justify-between space-y-5 hover:border-emerald-500/50 hover:shadow-md transition-all duration-200">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  Documentation
                </span>
                <h3 className="font-semibold text-base text-foreground mt-2">GitHub README Summary (.md)</h3>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Pre-formatted GitHub Flavored Markdown summary ready for pull request descriptions, model cards, or research papers.
              </p>
            </div>
            <a
              href={mdUrl}
              download
              className="w-full inline-flex items-center justify-center space-x-2 py-2.5 rounded-xl bg-muted hover:bg-muted/80 text-foreground border border-border font-semibold text-xs transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Download Markdown</span>
            </a>
          </div>
        </div>

        {/* Scikit-learn Pipeline Serializer Bay (.joblib) */}
        {comparison && comparison.available_models.length > 0 ? (
          <div className="rounded-2xl border border-border bg-card p-6 space-y-5 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="space-y-0.5">
                <h3 className="font-semibold text-sm text-foreground">
                  Export Serialized Scikit-learn Pipeline (.joblib)
                </h3>
                <p className="text-xs text-muted-foreground">
                  Exports the complete end-to-end Pipeline (imputer, scaler, and fitted estimator) for zero-latency inference.
                </p>
              </div>
              <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 font-medium">Inference-Ready</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
              <div className="md:col-span-2 space-y-1.5">
                <label className="text-xs text-foreground font-medium">Select Model Architecture:</label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full max-w-md bg-background border border-border rounded-xl p-2.5 text-xs text-foreground focus:outline-none focus:border-emerald-500"
                >
                  {comparison.available_models.map((m) => (
                    <option key={m} value={m}>
                      {m} {m === comparison.champion.name ? "★ (Champion)" : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-start md:justify-end">
                <a
                  href={modelUrl}
                  download
                  className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-md shadow-emerald-600/30 transition-all active:scale-95"
                >
                  <Download className="w-4 h-4" />
                  <span>Export {selectedModel} .joblib</span>
                </a>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card p-6 flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="font-semibold text-sm text-foreground">Machine Learning Inference Artifacts</h3>
              <p className="text-xs text-muted-foreground">
                Train baseline models in ML Studio to export serialized Scikit-learn (.joblib) pipelines.
              </p>
            </div>
            <Link
              href="/studio"
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground border border-border text-xs font-semibold transition-all"
            >
              <Cpu className="w-3.5 h-3.5 text-emerald-500" />
              <span>Open ML Studio</span>
            </Link>
          </div>
        )}
      </div>

      {/* MODAL 1: REPORT PREVIEW MODAL */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="bg-card border border-border rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-border bg-muted/30">
              <div className="flex items-center space-x-2">
                <Eye className="w-5 h-5 text-emerald-500" />
                <h3 className="text-base font-bold text-foreground">Interactive Report Preview</h3>
              </div>
              <div className="flex items-center space-x-2">
                <a
                  href={pdfUrl}
                  download
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download PDF</span>
                </a>
                <button
                  onClick={() => setShowPreviewModal(false)}
                  className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Executive Header Banner */}
              <div className="p-6 rounded-xl bg-gradient-to-r from-emerald-900 to-emerald-700 text-white space-y-2">
                <span className="text-[10px] uppercase font-mono tracking-wider px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-200 border border-emerald-400/30">
                  OpenDataLens Executive Dossier
                </span>
                <h2 className="text-2xl font-bold tracking-tight">
                  {activeDataset?.metadata.name || "Dataset"} Evaluation Report
                </h2>
                <p className="text-xs text-emerald-100">
                  Generated autonomously &bull; {new Date().toLocaleDateString()}
                </p>
              </div>

              {/* KPI Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-center">
                  <span className="text-[10px] font-mono uppercase text-muted-foreground">Dimensions</span>
                  <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                    {activeDataset?.total_rows.toLocaleString()} &times; {activeDataset?.total_cols}
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-center">
                  <span className="text-[10px] font-mono uppercase text-muted-foreground">Quality Score</span>
                  <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                    {previewData?.quality_summary?.overview?.completeness_score
                      ? `${previewData.quality_summary.overview.completeness_score.toFixed(1)}%`
                      : "100.0%"}
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-center">
                  <span className="text-[10px] font-mono uppercase text-muted-foreground">Clean Steps</span>
                  <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                    {previewData?.clean_history?.length || 0}
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-center">
                  <span className="text-[10px] font-mono uppercase text-muted-foreground">Champion Model</span>
                  <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-1 truncate">
                    {previewData?.best_model_info?.name || (comparison?.champion.name ? comparison.champion.name : "N/A")}
                  </div>
                </div>
              </div>

              {/* Sample Data Table */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-foreground">Dataset Records Preview</h4>
                <div className="overflow-x-auto border border-border rounded-xl">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-muted/50 text-muted-foreground font-medium border-b border-border">
                      <tr>
                        {activeDataset?.columns.slice(0, 6).map((col) => (
                          <th key={col.name} className="p-2.5">
                            {col.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {activeDataset?.records.slice(0, 5).map((row, idx) => (
                        <tr key={idx} className="hover:bg-muted/30">
                          {activeDataset.columns.slice(0, 6).map((col) => (
                            <td key={col.name} className="p-2.5 text-foreground">
                              {String(row[col.name] ?? "-")}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: SAVE PROJECT MODAL */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center space-x-2">
                <Bookmark className="w-5 h-5 text-emerald-500" />
                <h3 className="font-bold text-base text-foreground">Save Analysis Project</h3>
              </div>
              <button
                onClick={() => setShowSaveModal(false)}
                className="p-1 rounded-lg hover:bg-muted text-muted-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProject} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Project Name</label>
                <input
                  type="text"
                  required
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="e.g. Q4 Customer Churn Audit"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-foreground text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Description &amp; Notes (Optional)</label>
                <textarea
                  rows={3}
                  value={projectDesc}
                  onChange={(e) => setProjectDesc(e.target.value)}
                  placeholder="Notes on methodology, data cleaning decisions, or baseline models..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-foreground text-xs focus:outline-none focus:border-emerald-500 resize-none"
                />
              </div>

              {saveSuccessMsg && (
                <div className="flex items-center space-x-2 p-2.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs border border-emerald-500/20">
                  <Check className="w-4 h-4" />
                  <span>{saveSuccessMsg}</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSaveModal(false)}
                  className="px-4 py-2 rounded-xl border border-border hover:bg-muted text-xs font-medium text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingProject}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
                >
                  {isSavingProject ? <Ring className="size-3.5 text-white" /> : <Bookmark className="w-3.5 h-3.5" />}
                  <span>Save Project</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DRAWER: SAVED PROJECTS DRAWER */}
      {showProjectsDrawer && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end">
          <div className="bg-card border-l border-border w-full max-w-lg h-full flex flex-col shadow-2xl p-6 space-y-6 overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div className="flex items-center space-x-2">
                <FileArchive className="w-5 h-5 text-emerald-500" />
                <h3 className="font-bold text-base text-foreground">Saved Projects ({projectsList.length})</h3>
              </div>
              <button
                onClick={() => setShowProjectsDrawer(false)}
                className="p-1 rounded-lg hover:bg-muted text-muted-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Ephemeral Storage Disclosure */}
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs flex items-start space-x-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <div className="space-y-0.5">
                <span className="font-semibold text-[11px]">Free-Tier Ephemeral Storage Notice:</span>
                <p className="text-[11px] leading-relaxed opacity-90">
                  Render containers sleep when inactive and wipe ephemeral disks upon restart. To keep your work permanently without cost, download the portable <strong>.odl bundle</strong> to your machine.
                </p>
              </div>
            </div>

            {/* Import Button */}
            <div>
              <label
                htmlFor="bundle-import-input"
                className="w-full inline-flex items-center justify-center space-x-2 py-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25 text-xs font-semibold cursor-pointer transition-colors shadow-sm"
              >
                <Upload className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Import Portable .odl Bundle</span>
              </label>
              <input
                id="bundle-import-input"
                type="file"
                accept=".odl,.zip"
                className="hidden"
                onChange={handleImportBundle}
              />
            </div>

            {projectsList.length === 0 ? (
              <div className="py-12 text-center space-y-3">
                <Bookmark className="w-8 h-8 text-muted-foreground mx-auto opacity-40" />
                <p className="text-xs text-muted-foreground">No saved projects found in store.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {projectsList.map((p) => (
                  <div
                    key={p.id}
                    className="p-4 rounded-xl border border-border bg-muted/20 space-y-3 hover:border-emerald-500/40 transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-0.5">
                        <h4 className="font-semibold text-sm text-foreground">{p.name}</h4>
                        <p className="text-[11px] text-muted-foreground">{p.dataset_name} &bull; {p.total_rows.toLocaleString()} rows</p>
                      </div>
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {new Date(p.updated_at).toLocaleDateString()}
                      </span>
                    </div>

                    {p.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{p.description}</p>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-border/60">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleRestoreProject(p.id)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors"
                        >
                          Restore
                        </button>
                        <a
                          href={api.getProjectBundleUrl(p.id)}
                          download
                          className="px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 text-foreground border border-border text-xs font-medium transition-colors"
                          title="Download .odl archive"
                        >
                          Bundle (.odl)
                        </a>
                      </div>
                      <button
                        onClick={() => handleDeleteProject(p.id)}
                        className="p-1.5 text-muted-foreground hover:text-red-500 transition-colors"
                        title="Delete project"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 3: SHARE MODAL */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center space-x-2">
                <Share2 className="w-5 h-5 text-emerald-500" />
                <h3 className="font-bold text-base text-foreground">Share Report Link</h3>
              </div>
              <button
                onClick={() => {
                  setShowShareModal(false);
                  setGeneratedShare(null);
                }}
                className="p-1 rounded-lg hover:bg-muted text-muted-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {!generatedShare ? (
              <form onSubmit={handleCreateShare} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Report Title</label>
                  <input
                    type="text"
                    value={shareTitle}
                    onChange={(e) => setShareTitle(e.target.value)}
                    placeholder="Executive Analytics Report"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-foreground text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Link Expiration (TTL)</label>
                  <select
                    value={shareExpiryHours}
                    onChange={(e) => setShareExpiryHours(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-foreground text-xs focus:outline-none focus:border-emerald-500"
                  >
                    <option value={24}>24 Hours</option>
                    <option value={168}>7 Days (Recommended)</option>
                    <option value={720}>30 Days</option>
                    <option value={0}>Permanent (No Expiration)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                    <span>Password Protection (Optional)</span>
                    <Lock className="w-3 h-3 text-muted-foreground" />
                  </label>
                  <input
                    type="password"
                    value={sharePassword}
                    onChange={(e) => setSharePassword(e.target.value)}
                    placeholder="Enter passphrase to lock report"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-foreground text-xs focus:outline-none focus:border-emerald-500"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    If set, visitors must enter this password to view findings.
                  </p>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowShareModal(false)}
                    className="px-4 py-2 rounded-xl border border-border hover:bg-muted text-xs font-medium text-foreground transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isGeneratingShare}
                    className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
                  >
                    {isGeneratingShare ? <Ring className="size-3.5 text-white" /> : <Share2 className="w-3.5 h-3.5" />}
                    <span>Generate Secure Link</span>
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs flex items-center space-x-2">
                  <ShieldCheck className="w-5 h-5 flex-shrink-0" />
                  <span>Secure share link active! Sanitized report snapshot ready to distribute.</span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Share URL</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={`${typeof window !== "undefined" ? window.location.origin : ""}${generatedShare.share_url}`}
                      className="w-full px-3 py-2 rounded-xl border border-border bg-muted/40 text-foreground font-mono text-[11px] select-all"
                    />
                    <button
                      onClick={handleCopyShareLink}
                      className="inline-flex items-center space-x-1 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition-all flex-shrink-0"
                    >
                      {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      <span>{copiedLink ? "Copied" : "Copy"}</span>
                    </button>
                  </div>
                </div>

                <div className="pt-2 text-center">
                  <Link
                    href={generatedShare.share_url}
                    target="_blank"
                    className="inline-flex items-center space-x-1.5 text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-semibold"
                  >
                    <span>Open Public View</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Floating Retro Dock */}
      <RetroDock />
    </div>
  );
}
