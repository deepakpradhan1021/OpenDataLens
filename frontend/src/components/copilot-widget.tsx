"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Sparkles,
  X,
  Send,
  Bot,
  User,
  ArrowRight,
  Maximize2,
  Minimize2,
  Loader2,
  Copy,
  Check,
  Shield,
  ShieldAlert,
  Settings,
  RotateCcw,
  Key,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  Play
} from "lucide-react";
import { api, categorizeApiError } from "@/lib/api";
import { Ring } from "@/components/loading-ui/ring";
import { CopilotProposedAction } from "@/lib/types";

interface Message {
  role: "assistant" | "user";
  content: string;
  providerUsed?: string;
  suggestedFollowups?: string[];
  proposedAction?: CopilotProposedAction | null;
  technicalDetails?: Record<string, any> | null;
  executed?: boolean;
}

export function CopilotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  // Privacy & BYOK State (held only in component state, never persisted to disk)
  const [shareSampleRows, setShareSampleRows] = useState(false);
  const [customKey, setCustomKey] = useState("");
  const [customProvider, setCustomProvider] = useState("openai");
  const [activeDatasetName, setActiveDatasetName] = useState<string>("");

  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hello! I am your **OpenDataLens AI Analyst & Intelligent Data Agent**.\n\n" +
        "I analyze verified dataset metadata, compute exact correlations, recommend leak-free ML architectures, and propose safe data cleaning recipes.",
      providerUsed: "local_heuristic",
      suggestedFollowups: [
        "Explain this dataset in simple words",
        "Which columns contain the most missing values?",
        "What are the strongest relationships between variables?",
        "Which chart would best explain this dataset?",
        "Recommend suitable machine learning models",
      ],
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen, isExpanded]);

  const handleCopy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const handleSend = async (queryText?: string) => {
    const text = (queryText || input).trim();
    if (!text || loading) return;

    const userMsg: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const history = messages.slice(-6).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await api.queryCopilot(
        text,
        undefined,
        history,
        shareSampleRows,
        customKey || undefined,
        customProvider
      );

      if (res.metadata_snapshot?.name) {
        setActiveDatasetName(
          `${res.metadata_snapshot.name} (${res.metadata_snapshot.rows}r x ${res.metadata_snapshot.cols}c)`
        );
      }

      const assistantMsg: Message = {
        role: "assistant",
        content: res.answer,
        providerUsed: res.provider_used,
        suggestedFollowups: res.suggested_followups,
        proposedAction: res.proposed_action,
        technicalDetails: res.technical_details,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const cat = categorizeApiError(err);
      let errMsg = "An error occurred while contacting the AI Analyst.";
      if (cat.type === "cold_start") {
        errMsg = "The backend is spinning up on Render's free tier. Please retry in a few seconds.";
      } else if (cat.message) {
        errMsg = cat.message;
      }
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `⚠️ **Notice:** ${errMsg}`,
          providerUsed: "local_heuristic",
          suggestedFollowups: [
            "Explain this dataset in simple words",
            "Which columns contain the most missing values?",
          ],
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteAction = async (msgIdx: number, action: CopilotProposedAction) => {
    setActionLoading(true);
    try {
      const res = await api.executeCopilotAction(action.action_type, action.params);
      setMessages((prev) =>
        prev.map((m, idx) => (idx === msgIdx ? { ...m, executed: true } : m))
      );

      const confirmMsg: Message = {
        role: "assistant",
        content: `✅ **Operation Approved & Executed Successfully!**\n\n- **Applied Action:** ${res.action}\n- **Updated Dimensions:** ${res.rows} rows x ${res.cols} columns\n- **Safety:** Undo snapshot saved to checkpoint stack.`,
        providerUsed: "local_heuristic",
        suggestedFollowups: [
          "Explain this dataset in simple words",
          "What should I clean first?",
          "Recommend suitable machine learning models",
        ],
      };
      setMessages((prev) => [...prev, confirmMsg]);
    } catch (err: any) {
      const cat = categorizeApiError(err);
      const errorMsg: Message = {
        role: "assistant",
        content: `❌ **Action Execution Failed:** ${cat.message || "Failed to execute approved action."}`,
        providerUsed: "local_heuristic",
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setActionLoading(false);
    }
  };

  const handleClearHistory = () => {
    setMessages([
      {
        role: "assistant",
        content: "Conversation history cleared. How can I assist with your dataset analysis?",
        providerUsed: "local_heuristic",
        suggestedFollowups: [
          "Explain this dataset in simple words",
          "Which columns contain the most missing values?",
          "What are the strongest relationships between variables?",
        ],
      },
    ]);
  };

  return (
    <>
      {/* Floating Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Toggle AI Analyst Copilot"
        className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-50 p-3 sm:px-4 sm:py-3 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-xl shadow-indigo-600/30 flex items-center space-x-2 transition-all active:scale-95 group border border-violet-400/40"
      >
        <Sparkles className="w-4 h-4 animate-pulse group-hover:rotate-12 transition-transform text-violet-200" />
        <span className="hidden sm:inline">AI Copilot</span>
      </button>

      {/* Floating Chat Drawer */}
      {isOpen && (
        <div
          className={`fixed bottom-24 sm:bottom-20 right-4 sm:right-6 z-50 rounded-2xl border border-violet-500/30 dark:border-violet-500/40 bg-card shadow-2xl shadow-indigo-950/25 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200 transition-all ${
            isExpanded
              ? "w-[calc(100vw-2rem)] sm:w-[580px] h-[680px] max-h-[85vh]"
              : "w-[calc(100vw-2rem)] sm:w-[420px] h-[520px] max-h-[75vh]"
          }`}
        >
          {/* Header */}
          <div className="p-3 px-4 bg-violet-50/80 dark:bg-violet-950/30 border-b border-violet-200/60 dark:border-violet-800/40 flex items-center justify-between">
            <div className="flex items-center space-x-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-violet-600 to-indigo-600 text-white flex items-center justify-center font-bold shrink-0 shadow-sm shadow-violet-500/25">
                <Bot className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold text-foreground truncate">
                    AI Data Analyst Copilot
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-500/10 text-violet-700 dark:text-violet-300 border border-violet-500/30 font-mono flex items-center space-x-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" />
                    <span>Agent Active</span>
                  </span>
                </div>
                {activeDatasetName && (
                  <div className="text-[10px] text-muted-foreground truncate">
                    Active: {activeDatasetName}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-1">
              <button
                type="button"
                onClick={() => setShowSettings(!showSettings)}
                title="Privacy & AI Provider Settings"
                className={`p-1.5 rounded-lg transition-colors ${
                  showSettings
                    ? "bg-violet-500/15 text-violet-700 dark:text-violet-300"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <Settings className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={handleClearHistory}
                title="Clear Chat History"
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                title={isExpanded ? "Collapse View" : "Expand View"}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors hidden sm:inline-flex"
              >
                {isExpanded ? (
                  <Minimize2 className="w-3.5 h-3.5" />
                ) : (
                  <Maximize2 className="w-3.5 h-3.5" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Privacy & BYOK Settings Subpanel */}
          {showSettings && (
            <div className="p-3 bg-violet-50/60 dark:bg-violet-950/20 border-b border-violet-200/50 dark:border-violet-800/30 space-y-2.5 text-xs animate-in slide-in-from-top-2 duration-150">
              <div className="flex items-center justify-between pb-1 border-b border-violet-200/40 dark:border-violet-800/30">
                <span className="font-semibold text-foreground flex items-center space-x-1">
                  <Shield className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
                  <span>Privacy & Model Settings</span>
                </span>
                <span className="text-[10px] text-muted-foreground">In-Memory Only</span>
              </div>

              {/* Sample Rows Toggle */}
              <div className="flex items-start justify-between space-x-2">
                <div className="space-y-0.5">
                  <label htmlFor="sample-rows-toggle" className="text-[11px] font-medium text-foreground cursor-pointer">
                    Share 3 Sample Rows with AI
                  </label>
                  <p className="text-[10px] text-muted-foreground leading-snug">
                    Defaults to metadata only. When enabled, 3 sanitized sample rows are included for schema illustration.
                  </p>
                </div>
                <input
                  id="sample-rows-toggle"
                  type="checkbox"
                  checked={shareSampleRows}
                  onChange={(e) => setShareSampleRows(e.target.checked)}
                  className="rounded border-border text-violet-600 focus:ring-violet-500 h-4 w-4 mt-0.5 accent-violet-600"
                />
              </div>

              {/* Optional BYOK Key */}
              <div className="space-y-1 pt-1 border-t border-violet-200/40 dark:border-violet-800/30">
                <div className="flex items-center justify-between">
                  <label htmlFor="byok-key-input" className="text-[11px] font-medium text-foreground flex items-center space-x-1">
                    <Key className="w-3 h-3 text-violet-600 dark:text-violet-400" />
                    <span>Custom API Key (BYOK)</span>
                  </label>
                  <select
                    value={customProvider}
                    onChange={(e) => setCustomProvider(e.target.value)}
                    className="text-[10px] bg-background border border-border rounded px-1.5 py-0.5 text-foreground"
                  >
                    <option value="openai">OpenAI</option>
                    <option value="groq">Groq</option>
                    <option value="gemini">Gemini</option>
                  </select>
                </div>
                <input
                  id="byok-key-input"
                  type="password"
                  value={customKey}
                  onChange={(e) => setCustomKey(e.target.value)}
                  placeholder="sk-... (held only in memory)"
                  className="w-full bg-background border border-border rounded px-2.5 py-1 text-[11px] text-foreground focus:outline-none focus:border-violet-500 font-mono"
                />
              </div>
            </div>
          )}

          {/* Messages Body */}
          <div className="flex-1 p-3.5 overflow-y-auto space-y-3.5 text-xs">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex flex-col space-y-1.5 ${
                  m.role === "user" ? "items-end" : "items-start"
                }`}
              >
                <div
                  className={`p-3 rounded-2xl max-w-[90%] leading-relaxed ${
                    m.role === "user"
                      ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-br-none shadow-sm"
                      : "bg-violet-50/70 dark:bg-violet-950/25 text-foreground border border-violet-200/70 dark:border-violet-800/40 rounded-bl-none shadow-sm space-y-2"
                  }`}
                >
                  {m.role === "assistant" && (
                    <div className="flex items-center space-x-1.5 text-[10px] font-semibold text-violet-700 dark:text-violet-300 pb-1 border-b border-violet-200/50 dark:border-violet-800/30">
                      <Bot className="w-3 h-3 text-violet-600 dark:text-violet-400" />
                      <span>Copilot Assistant</span>
                    </div>
                  )}

                  <div className="whitespace-pre-wrap">{m.content}</div>

                  {/* Proposed Action Card */}
                  {m.proposedAction && !m.executed && (
                    <div className="mt-2 p-2.5 rounded-xl border border-indigo-500/30 bg-indigo-500/5 space-y-2">
                      <div className="flex items-center space-x-1.5 text-indigo-700 dark:text-indigo-300 font-semibold text-[11px]">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Proposed Action (Requires Confirmation)</span>
                      </div>
                      <p className="text-[11px] text-foreground/90 leading-tight">
                        {m.proposedAction.description}
                      </p>
                      {m.proposedAction.impact && (
                        <p className="text-[10px] text-muted-foreground font-mono">
                          Impact: {m.proposedAction.impact}
                        </p>
                      )}
                      <div className="flex items-center space-x-2 pt-1">
                        <button
                          type="button"
                          disabled={actionLoading}
                          onClick={() => handleExecuteAction(idx, m.proposedAction!)}
                          className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-medium text-[10px] flex items-center space-x-1 shadow-sm transition-all disabled:opacity-50"
                        >
                          {actionLoading ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Play className="w-3 h-3 fill-white" />
                          )}
                          <span>Approve & Execute</span>
                        </button>
                        <span className="text-[10px] text-muted-foreground">
                          Safe & Reversible
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Executed Action Badge */}
                  {m.executed && (
                    <div className="mt-1 px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 text-[10px] flex items-center space-x-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      <span>Action executed and saved to workspace history</span>
                    </div>
                  )}

                  {/* Assistant Footer Info (Copy & Engine Indicator) */}
                  {m.role === "assistant" && (
                    <div className="flex items-center justify-between pt-1 border-t border-violet-200/50 dark:border-violet-800/30 text-[10px] text-muted-foreground">
                      <span className="font-mono text-[9px]">
                        {m.providerUsed === "local_heuristic"
                          ? "⚡ Calculated locally (pandas facts)"
                          : `✨ Generated by ${m.providerUsed || "AI"}`}
                      </span>

                      <button
                        type="button"
                        onClick={() => handleCopy(m.content, idx)}
                        title="Copy to clipboard"
                        className="p-1 hover:text-violet-600 dark:hover:text-violet-400 transition-colors flex items-center space-x-1"
                      >
                        {copiedIdx === idx ? (
                          <>
                            <Check className="w-3 h-3 text-violet-600 dark:text-violet-400" />
                            <span className="text-violet-600 dark:text-violet-400 text-[9px]">Copied</span>
                          </>
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {/* Suggested follow-up prompt chips */}
                {m.suggestedFollowups && m.suggestedFollowups.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1 max-w-[95%]">
                    {m.suggestedFollowups.map((chip, cIdx) => (
                      <button
                        key={cIdx}
                        type="button"
                        onClick={() => handleSend(chip)}
                        className="text-[10px] px-2.5 py-1 rounded-full border border-violet-200/80 dark:border-violet-800/60 bg-violet-50/50 dark:bg-violet-900/15 hover:bg-violet-100/70 dark:hover:bg-violet-900/30 text-foreground hover:border-violet-400 transition-all flex items-center space-x-1 group"
                      >
                        <span>{chip}</span>
                        <ArrowRight className="w-2.5 h-2.5 text-muted-foreground group-hover:translate-x-0.5 group-hover:text-violet-600 transition-transform" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex items-center space-x-2 text-xs text-muted-foreground font-mono p-2.5 rounded-xl bg-violet-50/40 dark:bg-violet-950/20 border border-violet-200/50 dark:border-violet-800/30 animate-pulse">
                <Ring className="size-3.5 text-violet-600 dark:text-violet-400" />
                <span className="text-violet-700 dark:text-violet-300">AI Copilot is synthesizing dataset telemetry and calculating insights...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Footer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="p-3 bg-violet-50/30 dark:bg-violet-950/15 border-t border-violet-200/60 dark:border-violet-800/40 flex items-center space-x-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Copilot about datasets, anomalies, charts, or models..."
              className="flex-1 bg-background border border-violet-200/80 dark:border-violet-800/60 rounded-xl px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/25"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="p-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white transition-all disabled:opacity-50 shadow-sm shadow-violet-500/25"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}

    </>
  );
}
