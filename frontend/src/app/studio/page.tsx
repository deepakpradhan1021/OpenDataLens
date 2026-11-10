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
  Loader2,
  Check,
  X,
  Terminal,
} from "lucide-react";
import { api } from "@/lib/api";
import { TargetCandidatesResponse, JobStatusResponse } from "@/lib/types";
import { EmptyState } from "@/components/empty-state";
import { RetroDock } from "@/components/retro-dock";
import { RetroRobotIcon } from "@/components/retro-icons";

const CLASSIFICATION_MODELS = [
  { id: "logistic_regression", name: "Logistic Regression", default: true },
  { id: "random_forest", name: "Random Forest Classifier", default: true },
  { id: "gradient_boosting", name: "Gradient Boosting Classifier", default: true },
  { id: "decision_tree", name: "Decision Tree Classifier", default: true },
  { id: "k_nearest_neighbors", name: "K-Nearest Neighbors", default: false },
  { id: "support_vector_machine", name: "Support Vector Classifier (SVC)", default: false },
];

const REGRESSION_MODELS = [
  { id: "ridge_regression", name: "Ridge Regression", default: true },
  { id: "linear_regression", name: "Linear Regression", default: true },
  { id: "random_forest", name: "Random Forest Regressor", default: true },
  { id: "gradient_boosting", name: "Gradient Boosting Regressor", default: true },
  { id: "decision_tree", name: "Decision Tree Regressor", default: false },
  { id: "k_nearest_neighbors", name: "K-Nearest Neighbors Regressor", default: false },
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

  // Job Polling State
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatusResponse | null>(null);
  const [isTraining, setIsTraining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      try {
        const c = await api.getTargetCandidates("default");
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
        session_id: "default",
        problem_type: problemType,
        target_col: targetCol,
        feature_cols: featureCols,
        selected_models: selectedModels,
        scaler_type: scalerType,
        test_size: testSize,
        random_state: randomSeed,
      });

      setJobId(resp.job_id);

      // Poll job status every 750ms
      const interval = setInterval(async () => {
        try {
          const status = await api.getJobStatus(resp.job_id);
          setJobStatus(status);

          if (status.status === "completed") {
            clearInterval(interval);
            setIsTraining(false);
            // Brief delay then route to comparison leaderboard
            setTimeout(() => {
              router.push("/comparison");
            }, 1200);
          } else if (status.status === "failed") {
            clearInterval(interval);
            setIsTraining(false);
            setError(status.error || "Training job encountered an engine error.");
          }
        } catch (pollErr: any) {
          clearInterval(interval);
          setIsTraining(false);
          setError("Failed to query background worker status.");
        }
      }, 750);
    } catch (trainErr: any) {
      setIsTraining(false);
      setError(trainErr?.response?.data?.detail || trainErr.message || "Failed to dispatch training job.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0C0C0E] text-white flex items-center justify-center p-8 bg-retro-grid">
        <div className="retro-window-dark p-8 text-center space-y-3 border border-zinc-800">
          <Loader2 className="w-6 h-6 animate-spin text-[#1864FF] mx-auto" />
          <div className="font-mono text-xs uppercase tracking-wider text-zinc-300">
            INTERROGATING DATA SCHEMA & COMPUTING TARGET CANDIDATES...
          </div>
        </div>
      </div>
    );
  }

  if (!candidates) {
    return (
      <div className="min-h-screen bg-[#0C0C0E] text-white p-8 bg-retro-grid">
        <div className="max-w-xl mx-auto retro-window-dark p-8 text-center space-y-6 border border-zinc-800">
          <RetroRobotIcon size={48} className="mx-auto" />
          <div className="space-y-2">
            <h3 className="font-mono text-base font-bold uppercase">NO DATASET LOADED FOR TRAINING</h3>
            <p className="font-mono text-xs text-zinc-400">
              Please mount a dataset into workspace memory before configuring machine learning pipelines.
            </p>
          </div>
          <Link href="/explorer" className="btn-retro btn-retro-blue text-xs py-2 px-4">
            GO TO DATASET EXPLORER ↗
          </Link>
        </div>
      </div>
    );
  }

  const currentModels = problemType === "classification" ? CLASSIFICATION_MODELS : REGRESSION_MODELS;

  return (
    <div className="min-h-screen bg-[#0C0C0E] text-white p-4 sm:p-6 lg:p-8 bg-retro-grid selection:bg-[#1864FF] selection:text-white">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Workstation Title Header */}
        <div className="retro-window-dark p-4 border border-zinc-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-[#FBBF24] font-mono text-xs font-bold uppercase tracking-wider">
                <span className="w-2 h-2 bg-[#FBBF24] inline-block" />
                <span>MODULE_04 // MULTI-MODEL COMPILER & BACKGROUND WORKER</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-mono font-bold tracking-tight text-white uppercase">
                MACHINE LEARNING STUDIO
              </h1>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleStartTraining}
                disabled={isTraining}
                className="btn-retro btn-retro-blue text-xs flex items-center gap-2 py-2 px-4 shadow-[3px_3px_0px_0px_#002B99]"
              >
                {isTraining ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-white" />}
                <span>{isTraining ? "COMPILING PIPELINES..." : "EXECUTE TRAINING RUN"}</span>
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-3 font-mono text-xs text-zinc-400">
            <div>
              SUGGESTED PROBLEM TYPE: <span className="text-[#1864FF] font-bold uppercase">{candidates.suggested_task}</span>
            </div>
            <div>
              TOTAL ELIGIBLE COLUMNS: {candidates.columns.length}
            </div>
          </div>
        </div>

        {/* Notifications / Errors */}
        {error && (
          <div className="p-3 bg-red-950/80 border border-red-500 text-red-200 font-mono text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>ERROR: {error}</span>
          </div>
        )}

        {/* Real-time Training Progress Console (Mainframe Style) */}
        {isTraining && jobStatus && (
          <div className="retro-window-light border border-black p-4 space-y-3 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
            <div className="flex items-center justify-between pb-2 border-b border-black font-mono text-xs font-bold uppercase text-black">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-[#1864FF]" />
                <span>TRAINING_WORKER_THREAD: ACTIVE (JOB ID: {jobId?.slice(0, 8)})</span>
              </div>
              <span className="text-[#1864FF]">
                {Math.round((jobStatus.progress || 0) * 100)}% COMPLETE
              </span>
            </div>

            {/* ASCII Progress Bar */}
            <div className="space-y-1">
              <div className="flex justify-between font-mono text-[11px] text-zinc-600 font-bold">
                <span>{jobStatus.current_model || "INITIALIZING PREPROCESSING"}</span>
                <span>STEP {jobStatus.completed_models?.length || 0} / {jobStatus.total_models || selectedModels.length}</span>
              </div>
              <div className="w-full bg-zinc-300 h-3 border border-black overflow-hidden">
                <div
                  className="bg-[#1864FF] h-full transition-all duration-300"
                  style={{ width: `${Math.round((jobStatus.progress || 0) * 100)}%` }}
                />
              </div>
            </div>

            {/* Console Log Stream */}
            <div className="p-3 bg-black text-[#9AE6B4] font-mono text-[11px] space-y-0.5 border border-black max-h-36 overflow-y-auto">
              <div>&gt; [PIPELINE] Data split executed: {(1 - testSize) * 100}% train, {testSize * 100}% test</div>
              <div>&gt; [PREPROCESSING] Scaler configured: {scalerType.toUpperCase()}</div>
              {jobStatus.completed_models?.map((m: string) => (
                <div key={m} className="text-white">
                  &gt; [TRAINED] Algorithm `{m}` fitted and scored successfully.
                </div>
              ))}
              {jobStatus.current_model && (
                <div className="text-[#FBBF24] animate-pulse">
                  &gt; [TRAINING] Fitting `{jobStatus.current_model}` with hyperparameter validation...
                </div>
              )}
            </div>
          </div>
        )}

        {/* 2-Column Studio Workbench */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Task & Target Selection */}
          <div className="space-y-6 lg:col-span-1">
            {/* 1. Problem Type Selector */}
            <div className="retro-window-dark p-4 border border-zinc-800 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-800 font-mono text-xs font-bold text-white uppercase">
                <span>01. PROBLEM FORMULATION</span>
                <span className="w-2 h-2 bg-[#1864FF] inline-block" />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleTaskChange("classification")}
                  className={`p-3 font-mono text-xs font-bold uppercase tracking-wider border text-center transition-all ${
                    problemType === "classification"
                      ? "bg-[#1864FF] text-white border-white shadow-[2px_2px_0px_0px_#FFF]"
                      : "bg-zinc-900 text-zinc-400 border-zinc-700 hover:text-white"
                  }`}
                >
                  CLASSIFICATION
                </button>
                <button
                  type="button"
                  onClick={() => handleTaskChange("regression")}
                  className={`p-3 font-mono text-xs font-bold uppercase tracking-wider border text-center transition-all ${
                    problemType === "regression"
                      ? "bg-[#1864FF] text-white border-white shadow-[2px_2px_0px_0px_#FFF]"
                      : "bg-zinc-900 text-zinc-400 border-zinc-700 hover:text-white"
                  }`}
                >
                  REGRESSION
                </button>
              </div>
            </div>

            {/* 2. Target Column Picker */}
            <div className="retro-window-dark p-4 border border-zinc-800 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-800 font-mono text-xs font-bold text-white uppercase">
                <span>02. TARGET VARIABLE (Y)</span>
                <span className="w-2 h-2 bg-[#9AE6B4] inline-block" />
              </div>

              <div className="space-y-2">
                <select
                  value={targetCol}
                  onChange={(e) => {
                    const newTarget = e.target.value;
                    setTargetCol(newTarget);
                    setFeatureCols((prev) => prev.filter((c) => c !== newTarget));
                  }}
                  className="w-full bg-zinc-900 border border-zinc-700 p-2.5 font-mono text-xs text-white uppercase focus:outline-none focus:border-[#1864FF]"
                >
                  {candidates[problemType].map((col) => (
                    <option key={col} value={col}>
                      {col} (AUTO-DETECTED CANDIDATE)
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

                <div className="p-2 bg-zinc-950 border border-zinc-800 font-mono text-[10px] text-zinc-400">
                  Target candidate selected based on cardinality and entropy analysis.
                </div>
              </div>
            </div>

            {/* 3. Preprocessing Config */}
            <div className="retro-window-dark p-4 border border-zinc-800 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-800 font-mono text-xs font-bold text-white uppercase">
                <span>03. PREPROCESSING PIPELINE</span>
                <span className="w-2 h-2 bg-[#FBBF24] inline-block" />
              </div>

              {/* Scaler Options */}
              <div className="space-y-1.5">
                <label className="font-mono text-xs text-zinc-400 uppercase">NUMERIC SCALER</label>
                <div className="grid grid-cols-3 gap-1.5 font-mono text-[11px]">
                  {(["standard", "robust", "minmax"] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setScalerType(s)}
                      className={`p-2 border uppercase font-bold text-center ${
                        scalerType === s
                          ? "bg-[#1864FF] text-white border-white"
                          : "bg-zinc-900 text-zinc-400 border-zinc-700 hover:text-white"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Train / Test Split Slider */}
              <div className="space-y-1.5 pt-2">
                <div className="flex justify-between font-mono text-xs text-zinc-400 uppercase">
                  <span>TEST RATIO</span>
                  <span className="text-[#1864FF] font-bold">
                    {Math.round(testSize * 100)}% TEST ({(1 - testSize) * 100}% TRAIN)
                  </span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="0.4"
                  step="0.05"
                  value={testSize}
                  onChange={(e) => setTestSize(parseFloat(e.target.value))}
                  className="w-full h-2 bg-zinc-800 appearance-none cursor-pointer accent-[#1864FF]"
                />
              </div>
            </div>
          </div>

          {/* Right Column: Features & Model Selection */}
          <div className="space-y-6 lg:col-span-2">
            {/* Features Matrix Checklist */}
            <div className="retro-window-dark p-4 border border-zinc-800 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                <div className="font-mono text-xs font-bold text-white uppercase flex items-center gap-2">
                  <span>04. INPUT FEATURES MATRIX (X)</span>
                  <span className="text-[#1864FF]">
                    [{featureCols.length} OF {candidates.columns.length - 1} SELECTED]
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleSelectAllFeatures}
                    className="text-[10px] font-mono font-bold text-[#1864FF] hover:underline uppercase"
                  >
                    SELECT ALL
                  </button>
                  <span className="text-zinc-600">|</span>
                  <button
                    onClick={handleClearFeatures}
                    className="text-[10px] font-mono font-bold text-zinc-400 hover:underline uppercase"
                  >
                    DESELECT
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 pt-1 max-h-56 overflow-y-auto">
                {candidates.columns
                  .filter((col) => col !== targetCol)
                  .map((col) => {
                    const isSelected = featureCols.includes(col);
                    return (
                      <button
                        key={col}
                        type="button"
                        onClick={() => toggleFeature(col)}
                        className={`retro-pill justify-between text-left text-[11px] truncate ${
                          isSelected ? "active" : ""
                        }`}
                      >
                        <span className="truncate">{col}</span>
                        {isSelected ? <X className="w-3 h-3 ml-1 shrink-0" /> : null}
                      </button>
                    );
                  })}
              </div>
            </div>

            {/* Model Selection Matrix */}
            <div className="retro-window-dark p-4 border border-zinc-800 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-800 font-mono text-xs font-bold text-white uppercase">
                <div className="flex items-center gap-2">
                  <span>05. MODEL ARCHITECTURES TO COMPILE</span>
                  <span className="text-[#9AE6B4]">[{selectedModels.length} SELECTED]</span>
                </div>
                <span className="text-zinc-500 text-[10px]">PARALLEL FITTING</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {currentModels.map((m) => {
                  const isChecked = selectedModels.includes(m.id);
                  return (
                    <div
                      key={m.id}
                      onClick={() => toggleModel(m.id)}
                      className={`p-3 border cursor-pointer select-none transition-colors flex items-center justify-between ${
                        isChecked
                          ? "bg-zinc-900 border-[#1864FF]"
                          : "bg-zinc-950 border-zinc-800 hover:border-zinc-700"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-4 h-4 border border-black flex items-center justify-center ${
                            isChecked ? "bg-[#1864FF] text-white" : "bg-zinc-800"
                          }`}
                        >
                          {isChecked && <Check className="w-3 h-3" />}
                        </div>
                        <span className="font-mono text-xs font-bold text-white">{m.name}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Action Button at bottom */}
              <div className="pt-4 border-t border-zinc-800 flex justify-end">
                <button
                  type="button"
                  onClick={handleStartTraining}
                  disabled={isTraining}
                  className="btn-retro btn-retro-blue text-xs py-3 px-6 shadow-[4px_4px_0px_0px_#002B99]"
                >
                  {isTraining ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-white" />}
                  <span>DISPATCH TRAINING JOB TO FASTAPI WORKER</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Retro Dock */}
      <RetroDock />
    </div>
  );
}
