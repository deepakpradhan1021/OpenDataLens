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
  HelpCircle,
} from "lucide-react";
import Link from "next/link";
import { api, categorizeApiError } from "@/lib/api";
import { Ring } from "@/components/loading-ui/ring";

interface Message {
  role: "assistant" | "user";
  content: string;
  suggestedFollowups?: string[];
}

export function CopilotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hello! I am your **OpenDataLens AI Analyst Copilot**. Ask me to analyze dataset quality, diagnose outliers, recommend cleaning recipes, or explain trained ML models.",
      suggestedFollowups: [
        "Explain my dataset",
        "Which columns have missing values?",
        "What should I clean first?",
        "Are there any outliers?",
      ],
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  const handleSend = async (queryText?: string) => {
    const text = (queryText || input).trim();
    if (!text || loading) return;

    const userMsg: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await api.queryCopilot(text);
      const assistantMsg: Message = {
        role: "assistant",
        content: res.answer,
        suggestedFollowups: res.suggested_followups,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const cat = categorizeApiError(err);
      let errMsg = "An error occurred while contacting the Copilot engine.";
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
          suggestedFollowups: ["Explain my dataset", "Open Dataset Explorer"],
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Toggle AI Analyst Copilot"
        className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-50 p-3 sm:px-4 sm:py-3 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-xl shadow-emerald-600/30 flex items-center space-x-2 transition-all active:scale-95 group border border-emerald-400/30"
      >
        <Sparkles className="w-4 h-4 animate-pulse group-hover:rotate-12 transition-transform" />
        <span className="hidden sm:inline">AI Analyst</span>
      </button>

      {/* Floating Chat Drawer */}
      {isOpen && (
        <div className="fixed bottom-24 sm:bottom-20 right-4 sm:right-6 z-50 w-[calc(100vw-2rem)] sm:w-96 max-h-[540px] rounded-2xl border border-border bg-card shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
          {/* Header */}
          <div className="p-3.5 px-4 bg-muted/60 border-b border-border flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-foreground">AI Analyst Copilot</div>
                <div className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>Verified Workspace Telemetry</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages Body */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3.5 text-xs">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex flex-col space-y-1.5 ${
                  m.role === "user" ? "items-end" : "items-start"
                }`}
              >
                <div
                  className={`p-3 rounded-2xl max-w-[85%] leading-relaxed ${
                    m.role === "user"
                      ? "bg-emerald-600 text-white rounded-br-none shadow-sm"
                      : "bg-muted/70 text-foreground border border-border rounded-bl-none shadow-sm"
                  }`}
                >
                  <div className="whitespace-pre-wrap">{m.content}</div>
                </div>

                {/* Suggested follow-up prompt chips */}
                {m.suggestedFollowups && m.suggestedFollowups.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1 max-w-[90%]">
                    {m.suggestedFollowups.map((chip, cIdx) => (
                      <button
                        key={cIdx}
                        type="button"
                        onClick={() => handleSend(chip)}
                        className="text-[10px] px-2 py-1 rounded-full border border-border bg-card hover:bg-muted text-foreground transition-colors"
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex items-center space-x-2 text-xs text-muted-foreground font-mono p-2">
                <Ring className="size-3.5 text-emerald-500" />
                <span>Auditing workspace telemetry...</span>
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
            className="p-3 bg-muted/30 border-t border-border flex items-center space-x-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Copilot about your data..."
              className="flex-1 bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-emerald-500"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition-all disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
