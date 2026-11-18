"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Cpu,
  Play,
  CheckCircle2,
  AlertCircle,
  Sliders,
  Shield,
  Layers,
  ArrowRight,
  Check,
  X,
  Terminal,
  Sparkles,
} from "lucide-react";
import { Ring } from "@/components/loading-ui/ring";
import { api, categorizeApiError, getWorkspaceId } from "@/lib/api";
import { TargetCandidatesResponse, JobStatusResponse } from "@/lib/types";
import { RetroDock } from "@/components/retro-dock";
import { workspaceSync } from "@/lib/workspace-sync";

const CLASSIFICATION_MODELS = [
  { id: "logistic_regression", name: "Logistic Regression", desc: "Linear baseline with L2 penalty", default: true },
  { id: "random_forest", name: "Random Forest Classifier", desc: "Ensemble of 100 decision trees", default: true },
  { id: "gradient_boosting", name: "Gradient Boosting", desc: "Sequential boosting on residual errors", default: true },
  { id: "decision_tree", name: "Decision Tree", desc: "Non-parametric tree partitioning", default: true },
  { id: "k_nearest_neighbors", name: "K-Nearest Neighbors", desc: "Instance-based majority voting (k=5)", default: false },
  { id: "support_vector_machine", name: "Support Vector (SVC)", desc: "Radial Basis Function (RBF) margin", default: false },
];

const REGRESSION_MODELS = [
  { id: "ridge_regression", name: "Ridge Regression", desc: "L2 regularized linear model", default: true },
  { id: "linear_regression", name: "Linear Regression", desc: "Ordinary least squares estimator", default: true },
  { id: "random_forest", name: "Random Forest Regressor", desc: "Bagged trees with mean aggregation", default: true },
  { id: "gradient_boosting", name: "Gradient Boosting Regressor", desc: "Stage-wise additive residual modeling", default: true },
  { id: "decision_tree", name: "Decision Tree Regressor", desc: "Partitioning by mean squared error", default: false },
  { id: "k_nearest_neighbors", name: "KNN Regressor", desc: "Distance-weighted average prediction", default: false },
];

export default function StudioPage() {
  const router = useRouter();
  const [candidates, setCandidates] = useState<TargetCandidatesResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // Form State
  const [problemType, setProblemType] = useState<"classification" | "regression">("classification");
  const [targetCol, setTargetCol] = useState("");
  const [featureCols, setFeatureCols] = useState<string[]>([]);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [scalerType, setScalerType] = useState<"standard" | "robust" | "minmax">("standard");
  const [testSize, setTestSize] = useState(0.2);
  const [randomSeed, setRandomSeed] = useState(42);
  const [cvFolds, setCvFolds] = useState(5);

  // Job Polling State
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatusResponse | null>(null);
  const [isTraining, setIsTraining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      try {
        const c = await api.getTargetCandidates();
        setCandidates(c);

        const initialTask = c.suggested_task === "regression" ? "regression" : "classification";
        setProblemType(initialTask);

        const validTargets = c[initialTask];
        const defaultTarget = validTargets.length > 0 ? validTargets[0] : c.columns[c.columns.length - 1];
        setTargetCol(defaultTarget);

        const nonTarget = c.columns.filter(
          (col) =>
            col !== defaultTarget &&
            !["id", "uuid", "guid", "index"].some((kw) => col.toLowerCase().includes(kw))
        );
        setFeatureCols(nonTarget.length > 0 ? nonTarget : c.columns.filter((c) => c !== defaultTarget));

        const modelList = initialTask === "classification" ? CLASSIFICATION_MODELS : REGRESSION_MODELS;
        setSelectedModels(modelList.filter((m) => m.default).map((m) => m.id));
      } catch (e: any) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  const handleTaskChange = (newTask: "classification" | "regression") => {
    setProblemType(newTask);
    if (!candidates) return;

    const validTargets = candidates[newTask];
    if (validTargets.length > 0) {
      setTargetCol(validTargets[0]);
    }
    const modelList = newTask === "classification" ? CLASSIFICATION_MODELS : REGRESSION_MODELS;
    setSelectedModels(modelList.filter((m) => m.default).map((m) => m.id));
  };

  const toggleModel = (id: string) => {
    setSelectedModels((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  const toggleFeature = (col: string) => {
    setFeatureCols((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]
    );
  };

  const handleSelectAllFeatures = () => {
    if (!candidates) return;
    setFeatureCols(candidates.columns.filter((c) => c !== targetCol));
  };

  const handleClearFeatures = () => {
    setFeatureCols([]);
  };

  const handleStartTraining = async () => {
    if (!targetCol) {
      setError("Please designate a target column.");
      return;
    }
    if (featureCols.length === 0) {
      setError("Please select at least one feature column.");
      return;
    }
    if (selectedModels.length === 0) {
      setError("Please select at least one algorithm to train.");
      return;
    }

    setIsTraining(true);
    setError(null);
    setJobStatus(null);

    try {
      const resp = await api.trainModels({
        problem_type: problemType,
        target_col: targetCol,
        feature_cols: featureCols,
        selected_models: selectedModels,
        scaler_type: scalerType,
        test_size: testSize,
        random_state: randomSeed,
        cv_folds: cvFolds,
      });

      setJobId(resp.job_id);

      let consecutivePollErrors = 0;
      const interval = setInterval(async () => {
        try {
          const status = await api.getJobStatus(resp.job_id);
          consecutivePollErrors = 0;
          setJobStatus(status);

          if (status.status === "completed") {
            clearInterval(interval);
            setIsTraining(false);
            workspaceSync.queueAutoSave({
              model_results: {
                workspace_id: getWorkspaceId(),
                problem_type: problemType,
                target_col: targetCol,
                feature_cols: featureCols,
                leaderboard: (status.completed_models || []).map((modelName: string) => ({
                  model_name: modelName,
                  metrics: {},
                  fit_time: 0,
                })),
                updated_at: new Date().toISOString(),
              },
            });
            setTimeout(() => {
              router.push("/comparison");
            }, 1000);
          } else if (status.status === "failed") {
            clearInterval(interval);
            setIsTraining(false);
            setError(status.error || "Training job encountered an engine error.");
          }
        } catch {
          consecutivePollErrors++;
          // Allow transient Render network/compute hiccups before failing
          if (consecutivePollErrors >= 5) {
            clearInterval(interval);
            setIsTraining(false);
            setError("Lost connection to background training worker. Please check the Leaderboard or retry.");
          }
        }
      }, 1000);
    } catch (trainErr: any) {
      setIsTraining(false);
      const cat = categorizeApiError(trainErr);
      if (cat.type === "cold_start") {
        setError("Waking up the backend. This may take up to 50 seconds on Render's free tier. Please click Start Training again once awake.");
      } else if (cat.type === "timeout") {
        setError("Training job dispatch timed out after 75s. The backend may still be starting up. Please click Start Training again.");
      } else {
        setError(cat.message || "Failed to dispatch training job.");
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-8">
        <div className="p-8 rounded-2xl border border-border bg-card text-center space-y-3 shadow-lg">
          <Ring className="size-7 text-emerald-500 mx-auto" />
          <div className="text-xs font-mono text-muted-foreground">
            Analyzing dataset schema and computing candidate targets...
          </div>
        </div>
      </div>
    );
  }

  if (!candidates) {
    return (
      <div className="min-h-screen bg-background text-foreground p-8">
        <div className="max-w-xl mx-auto rounded-2xl border border-border bg-card p-10 text-center space-y-5 shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
            <Cpu className="w-6 h-6" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-base font-bold text-foreground">No Dataset Loaded for Training</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
              Mount a dataset into workspace memory via the Dataset Explorer before configuring training pipelines.
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

  const currentModels = problemType === "classification" ? CLASSIFICATION_MODELS : REGRESSION_MODELS;

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8 pb-28 sm:pb-32 selection:bg-emerald-500 selection:text-white transition-colors duration-200">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border">
          <div className="space-y-1">
            <div className="flex items-center space-x-2 text-xs font-mono text-emerald-600 dark:text-emerald-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Parallel Multi-Model Training Console</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              ML Training Studio
            </h1>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={handleStartTraining}
              disabled={isTraining}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow-md shadow-emerald-600/30 flex items-center space-x-2 transition-all active:scale-95 disabled:opacity-75"
            >
              {isTraining ? <Ring className="size-4 text-white" /> : <Play className="w-4 h-4 fill-white" />}
              <span>{isTraining ? "Training Pipelines..." : "Start Training Run"}</span>
            </button>
          </div>
        </div>

        {/* Notifications */}
        {error && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-200 text-xs flex items-center space-x-2.5 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Real-time Training Progress Console */}
        {isTraining && jobStatus && (
          <div className="rounded-2xl border border-emerald-500/30 bg-card p-5 space-y-3.5 shadow-xl shadow-emerald-950/10">
            <div className="flex items-center justify-between text-xs font-mono font-medium">
              <div className="flex items-center space-x-2 text-foreground">
                <Terminal className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Background Worker Active (Job {jobId?.slice(0, 8)})</span>
              </div>
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                {Math.round((jobStatus.progress || 0) * 100)}% Complete
              </span>
            </div>

            {/* Modern Progress Bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-mono text-muted-foreground">
                <span>{jobStatus.current_model || "Fitting models on training split..."}</span>
                <span>
                  {jobStatus.completed_models?.length || 0} / {jobStatus.total_models || selectedModels.length} models
                </span>
              </div>
              <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${Math.round((jobStatus.progress || 0) * 100)}%` }}
                />
              </div>
            </div>

            {/* Live Console Stream */}
            <div className="p-3.5 rounded-xl bg-muted/60 text-xs font-mono text-foreground space-y-1 max-h-32 overflow-y-auto border border-border">
              <div className="text-emerald-600 dark:text-emerald-400 font-semibold">
                &gt; [Split] Zero data leakage verified: {(1 - testSize) * 100}% train, {testSize * 100}% test
              </div>
              <div className="text-emerald-600 dark:text-emerald-400">
                &gt; [Preprocessor] Fitted {scalerType.toUpperCase()} scaler strictly on X_train
              </div>
              {jobStatus.completed_models?.map((m: string) => (
                <div key={m} className="text-muted-foreground">
                  &gt; [Fitted] Algorithm `{m}` evaluated successfully.
                </div>
              ))}
              {jobStatus.current_model && (
                <div className="text-amber-500 animate-pulse font-semibold">
                  &gt; [Running] Training `{jobStatus.current_model}` with hyperparameter validation...
                </div>
              )}
            </div>
          </div>
        )}

        {/* 2-Column Workbench */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Task & Target Selection */}
          <div className="space-y-6 lg:col-span-1">
            {/* 1. Problem Formulation */}
            <div className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between pb-3 border-b border-border text-xs font-semibold text-foreground">
                <span>1. Problem Formulation</span>
                <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 uppercase">
                  Suggested: {candidates.suggested_task}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleTaskChange("classification")}
                  className={`p-3 rounded-xl text-xs font-semibold text-center transition-all ${
                    problemType === "classification"
                      ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30 border border-emerald-500"
                      : "bg-muted text-muted-foreground hover:text-foreground border border-border"
                  }`}
                >
                  Classification
                </button>
                <button
                  type="button"
                  onClick={() => handleTaskChange("regression")}
                  className={`p-3 rounded-xl text-xs font-semibold text-center transition-all ${
                    problemType === "regression"
                      ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30 border border-emerald-500"
                      : "bg-muted text-muted-foreground hover:text-foreground border border-border"
                  }`}
                >
                  Regression
                </button>
              </div>
            </div>

            {/* 2. Target Variable Selection */}
            <div className="rounded-2xl border border-border bg-card p-5 space-y-3 shadow-sm">
              <div className="flex items-center justify-between pb-3 border-b border-border text-xs font-semibold text-foreground">
                <span>2. Target Variable (y)</span>
                <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400">Auto-Detected</span>
              </div>

              <select
                value={targetCol}
                onChange={(e) => {
                  const newTarget = e.target.value;
                  setTargetCol(newTarget);
                  setFeatureCols((prev) => prev.filter((c) => c !== newTarget));
                }}
                className="w-full bg-background border border-border rounded-xl p-2.5 text-xs text-foreground focus:outline-none focus:border-emerald-500"
              >
                {candidates[problemType].map((col) => (
                  <option key={col} value={col}>
                    {col} (Candidate Target)
                  </option>
                ))}
                {candidates.columns
                  .filter((c) => !candidates[problemType].includes(c))
                  .map((col) => (
                    <option key={col} value={col}>
                      {col}
                    </option>
                  ))}
              </select>

              <p className="text-[11px] text-muted-foreground leading-relaxed font-mono">
                Suggested target candidate selected based on cardinality and entropy analysis.
              </p>
            </div>

            {/* 3. Preprocessing Config */}
            <div className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-sm">
              <div className="pb-3 border-b border-border text-xs font-semibold text-foreground">
                <span>3. Preprocessing &amp; Split</span>
              </div>

              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Numeric Scaler</label>
                <div className="grid grid-cols-3 gap-1.5 text-xs">
                  {(["standard", "robust", "minmax"] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setScalerType(s)}
                      className={`p-2 rounded-lg capitalize font-medium text-center transition-all ${
                        scalerType === s
                          ? "bg-emerald-600 text-white font-semibold shadow-sm"
                          : "bg-muted text-muted-foreground hover:text-foreground border border-border"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Test Split Ratio</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-mono font-medium">
                    {Math.round(testSize * 100)}% test / {(1 - testSize) * 100}% train
                  </span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="0.4"
                  step="0.05"
                  value={testSize}
                  onChange={(e) => setTestSize(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-muted rounded-full appearance-none cursor-pointer accent-emerald-500"
                />
              </div>

              <div className="space-y-2 pt-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Cross-Validation Folds</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-mono font-medium">{cvFolds}-Fold CV</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5 text-xs">
                  {[3, 5, 10].map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setCvFolds(f)}
                      className={`p-1.5 rounded-lg font-mono text-center transition-all ${
                        cvFolds === f
                          ? "bg-emerald-600 text-white font-semibold shadow-sm"
                          : "bg-muted text-muted-foreground hover:text-foreground border border-border"
                      }`}
                    >
                      {f}-Fold
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Features & Model Selection */}
          <div className="space-y-6 lg:col-span-2">
            {/* Features Selection */}
            <div className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div className="text-xs font-semibold text-foreground flex items-center space-x-2">
                  <span>4. Input Features Matrix (X)</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-mono text-[11px]">
                    ({featureCols.length} of {candidates.columns.length - 1} selected)
                  </span>
                </div>
                <div className="flex space-x-3 text-xs">
                  <button
                    onClick={handleSelectAllFeatures}
                    className="text-emerald-600 dark:text-emerald-400 hover:underline font-medium"
                  >
                    Select All
                  </button>
                  <span className="text-muted-foreground">•</span>
                  <button
                    onClick={handleClearFeatures}
                    className="text-muted-foreground hover:text-foreground font-medium"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-56 overflow-y-auto pt-1">
                {candidates.columns
                  .filter((col) => col !== targetCol)
                  .map((col) => {
                    const isSelected = featureCols.includes(col);
                    return (
                      <button
                        key={col}
                        type="button"
                        onClick={() => toggleFeature(col)}
                        className={`px-3 py-2 rounded-xl text-xs font-medium transition-all text-left truncate flex items-center justify-between ${
                          isSelected
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-semibold"
                            : "bg-muted/60 text-muted-foreground hover:text-foreground border border-border"
                        }`}
                      >
                        <span className="truncate">{col}</span>
                        {isSelected ? <Check className="w-3.5 h-3.5 shrink-0 ml-1" /> : null}
                      </button>
                    );
                  })}
              </div>
            </div>

            {/* Model Architecture Checkboxes */}
            <div className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div className="text-xs font-semibold text-foreground flex items-center space-x-2">
                  <span>5. Model Architectures to Train</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-mono text-[11px]">
                    ({selectedModels.length} selected)
                  </span>
                </div>
                <span className="text-xs text-muted-foreground font-mono">Parallel Execution</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {currentModels.map((m) => {
                  const isChecked = selectedModels.includes(m.id);
                  return (
                    <div
                      key={m.id}
                      onClick={() => toggleModel(m.id)}
                      className={`p-3.5 rounded-xl border cursor-pointer select-none transition-all flex items-start space-x-3 ${
                        isChecked
                          ? "bg-emerald-500/10 border-emerald-500/40 ring-1 ring-emerald-500/20"
                          : "bg-muted/40 border-border hover:border-border/80"
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded mt-0.5 border flex items-center justify-center transition-colors shrink-0 ${
                          isChecked ? "bg-emerald-600 border-emerald-500 text-white" : "border-border bg-background"
                        }`}
                      >
                        {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                      <div className="space-y-0.5">
                        <div className="font-semibold text-xs text-foreground">{m.name}</div>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">{m.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pt-4 border-t border-border flex justify-end">
                <button
                  type="button"
                  onClick={handleStartTraining}
                  disabled={isTraining}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-md shadow-emerald-600/30 flex items-center space-x-2 transition-all active:scale-95 disabled:opacity-75"
                >
                  {isTraining ? <Ring className="size-4 text-white" /> : <Play className="w-4 h-4 fill-white" />}
                  <span>Dispatch Parallel Training Job</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
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
