"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Loader2, CheckSquare, Square, RotateCcw, Check, X, ChevronRight, FileCode2, Sparkles } from "lucide-react";
import type { EveQuestion, EveAnswer } from "@/app/api/eve/analyze/route";

// ─── Types ──────────────────────────────────────────────────────────────────

type Phase =
  | "idle"
  | "analyzing"
  | "questions"
  | "synthesizing"
  | "needs_enrichment"
  | "synthesis_review"
  | "implementing"
  | "done";

interface FileChange {
  path: string;
  action: "create" | "update";
  preview: string;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function EveBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 items-start">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-purple-500 flex-shrink-0 flex items-center justify-center shadow-lg shadow-primary/20 mt-0.5">
        <span className="text-xs font-bold text-white">E</span>
      </div>
      <div className="flex-1 bg-white/5 border border-white/10 rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed text-foreground">
        {children}
      </div>
    </div>
  );
}

function UserBubble({ content }: { content: string }) {
  return (
    <div className="flex gap-3 items-start justify-end">
      <div className="max-w-[75%] bg-primary/20 border border-primary/30 rounded-2xl rounded-tr-sm px-4 py-3 text-sm leading-relaxed text-foreground">
        {content}
      </div>
      <div className="w-8 h-8 rounded-full bg-white/10 flex-shrink-0 flex items-center justify-center mt-0.5">
        <span className="text-xs font-bold text-white">RM</span>
      </div>
    </div>
  );
}

function QuestionCard({
  question,
  selectedIds,
  onToggle,
}: {
  question: EveQuestion;
  selectedIds: string[];
  onToggle: (answerId: string) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-white">{question.question}</p>
      <div className="space-y-1.5">
        {question.answers.map((answer: EveAnswer) => {
          const selected = selectedIds.includes(answer.id);
          return (
            <button
              key={answer.id}
              onClick={() => onToggle(answer.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-sm text-left transition-all ${
                selected
                  ? "bg-primary/20 border-primary/50 text-white"
                  : "bg-white/3 border-white/10 text-muted-foreground hover:border-white/20 hover:text-white"
              }`}
            >
              {question.multiSelect ? (
                selected ? (
                  <CheckSquare className="w-4 h-4 text-primary flex-shrink-0" />
                ) : (
                  <Square className="w-4 h-4 flex-shrink-0" />
                )
              ) : (
                <div
                  className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${
                    selected ? "border-primary bg-primary" : "border-white/30"
                  }`}
                />
              )}
              <span>{answer.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function EvePage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [prompt, setPrompt] = useState("");
  const [currentPrompt, setCurrentPrompt] = useState("");
  const [questions, setQuestions] = useState<EveQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [synthesis, setSynthesis] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [score, setScore] = useState(0);
  const [maxScore, setMaxScore] = useState(0);
  const [implementedFiles, setImplementedFiles] = useState<FileChange[]>([]);
  const [implementMessage, setImplementMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [phase, questions, synthesis]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [prompt]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function handleSendPrompt() {
    if (!prompt.trim() || phase !== "idle") return;
    const p = prompt.trim();
    setCurrentPrompt(p);
    setPrompt("");
    setPhase("analyzing");
    setError(null);

    try {
      const res = await fetch("/api/eve/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: p }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { questions: EveQuestion[] };
      setQuestions(data.questions);
      // Init answers map
      const initAnswers: Record<string, string[]> = {};
      data.questions.forEach((q) => { initAnswers[q.id] = []; });
      setAnswers(initAnswers);
      setPhase("questions");
    } catch {
      setError("Eve n'a pas pu analyser ta demande. Réessaie.");
      setPhase("idle");
    }
  }

  function toggleAnswer(questionId: string, answerId: string, multiSelect: boolean) {
    setAnswers((prev) => {
      const current = prev[questionId] ?? [];
      if (multiSelect) {
        return {
          ...prev,
          [questionId]: current.includes(answerId)
            ? current.filter((id) => id !== answerId)
            : [...current, answerId],
        };
      } else {
        return {
          ...prev,
          [questionId]: current.includes(answerId) ? [] : [answerId],
        };
      }
    });
  }

  async function handleSubmitAnswers() {
    const allAnswered = questions.every((q) => (answers[q.id] ?? []).length > 0);
    if (!allAnswered) {
      setError("Réponds à toutes les questions avant de continuer.");
      return;
    }
    setError(null);
    setPhase("synthesizing");

    try {
      const res = await fetch("/api/eve/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: currentPrompt, questions, answers }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as {
        score: number;
        maxScore: number;
        needsEnrichment: boolean;
        synthesis: string;
        suggestions?: string[];
      };

      setScore(data.score);
      setMaxScore(data.maxScore);

      if (data.needsEnrichment) {
        setSuggestions(data.suggestions ?? []);
        setPhase("needs_enrichment");
      } else {
        setSynthesis(data.synthesis);
        setPhase("synthesis_review");
      }
    } catch {
      setError("Eve n'a pas pu générer la synthèse. Réessaie.");
      setPhase("questions");
    }
  }

  async function handleValidateSynthesis() {
    setPhase("implementing");
    setError(null);

    try {
      const res = await fetch("/api/eve/implement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: currentPrompt, synthesis }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { files: FileChange[]; message: string };
      setImplementedFiles(data.files);
      setImplementMessage(data.message);
      setPhase("done");
    } catch {
      setError("L'implémentation a échoué. Vérifie les logs serveur.");
      setPhase("synthesis_review");
    }
  }

  function handleReset() {
    setPhase("idle");
    setCurrentPrompt("");
    setQuestions([]);
    setAnswers({});
    setSynthesis("");
    setSuggestions([]);
    setScore(0);
    setMaxScore(0);
    setImplementedFiles([]);
    setImplementMessage("");
    setError(null);
  }

  const scorePercent = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-[calc(100vh-0px)] max-h-screen">
      {/* Header */}
      <header className="flex items-center gap-3 px-6 py-4 border-b border-white/10 bg-background/50 backdrop-blur-xl flex-shrink-0">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center shadow-lg shadow-primary/20">
          <span className="text-sm font-bold text-white">E</span>
        </div>
        <div>
          <h1 className="font-semibold text-white text-sm">Eve — Feature Workshop</h1>
          <p className="text-[11px] text-muted-foreground">Producer · Eden Studio</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {phase !== "idle" && phase !== "analyzing" && (
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-white transition-colors px-2 py-1.5 rounded-lg hover:bg-white/5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Recommencer
            </button>
          )}
        </div>
      </header>

      {/* Conversation area */}
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-6 max-w-3xl w-full mx-auto">

        {/* Welcome */}
        {phase === "idle" && (
          <EveBubble>
            <p>Décris-moi la feature que tu veux implémenter dans Eden Studio.</p>
            <p className="mt-1 text-muted-foreground text-xs">Je vais lire le codebase, te poser quelques questions, puis on implémentera ensemble.</p>
          </EveBubble>
        )}

        {/* Prompt sent */}
        {currentPrompt && <UserBubble content={currentPrompt} />}

        {/* Analyzing */}
        {phase === "analyzing" && (
          <EveBubble>
            <span className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Je lis le codebase et j&apos;analyse ta demande…
            </span>
          </EveBubble>
        )}

        {/* Questions */}
        {(phase === "questions" || phase === "synthesizing") && questions.length > 0 && (
          <EveBubble>
            <p className="mb-4">Quelques questions pour préciser la feature :</p>
            <div className="space-y-5">
              {questions.map((q) => (
                <QuestionCard
                  key={q.id}
                  question={q}
                  selectedIds={answers[q.id] ?? []}
                  onToggle={(answerId) => toggleAnswer(q.id, answerId, q.multiSelect)}
                />
              ))}
            </div>
            {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
            {phase === "questions" && (
              <button
                onClick={handleSubmitAnswers}
                className="mt-5 flex items-center gap-2 bg-primary hover:bg-primary/90 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
              >
                Valider mes réponses
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
            {phase === "synthesizing" && (
              <span className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Génération de la synthèse…
              </span>
            )}
          </EveBubble>
        )}

        {/* Needs enrichment */}
        {phase === "needs_enrichment" && (
          <EveBubble>
            <div className="flex items-center gap-2 mb-3">
              <div className="text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-medium">
                Score {scorePercent}% — spec insuffisante
              </div>
            </div>
            <p className="text-sm mb-3">La spec est encore un peu vague. Voici des éléments à ajouter avant de continuer :</p>
            <ul className="space-y-1.5">
              {suggestions.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                  {s}
                </li>
              ))}
            </ul>
            <button
              onClick={handleReset}
              className="mt-4 flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white text-sm font-medium px-4 py-2 rounded-xl border border-white/10 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Reformuler ma demande
            </button>
          </EveBubble>
        )}

        {/* Synthesis review */}
        {(phase === "synthesis_review" || phase === "implementing") && synthesis && (
          <EveBubble>
            <div className="flex items-center gap-2 mb-3">
              <div className="text-xs bg-green-500/20 text-green-300 border border-green-500/30 px-2 py-0.5 rounded-full font-medium">
                Score {scorePercent}% — spec validée
              </div>
            </div>
            <p className="text-sm font-medium mb-2">Voici ma compréhension de la feature :</p>
            <div className="bg-black/20 border border-white/10 rounded-xl p-3 text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
              {synthesis}
            </div>
            {phase === "synthesis_review" && (
              <>
                {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={handleValidateSynthesis}
                    className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
                  >
                    <Check className="w-4 h-4" />
                    Valider — implémenter
                  </button>
                  <button
                    onClick={handleReset}
                    className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white text-sm font-medium px-4 py-2 rounded-xl border border-white/10 transition-colors"
                  >
                    <X className="w-4 h-4" />
                    Recommencer
                  </button>
                </div>
              </>
            )}
            {phase === "implementing" && (
              <span className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Implémentation en cours… (peut prendre 30-60s)
              </span>
            )}
          </EveBubble>
        )}

        {/* Done */}
        {phase === "done" && implementedFiles.length > 0 && (
          <EveBubble>
            <p className="text-sm font-medium mb-1">C&apos;est fait.</p>
            <p className="text-sm text-muted-foreground mb-4">{implementMessage}</p>
            <div className="space-y-2">
              {implementedFiles.map((f) => (
                <div
                  key={f.path}
                  className="flex items-center gap-2 bg-black/20 border border-white/10 rounded-xl px-3 py-2"
                >
                  <FileCode2 className="w-4 h-4 text-primary flex-shrink-0" />
                  <span className="text-xs font-mono text-white flex-1 truncate">{f.path}</span>
                  <span
                    className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                      f.action === "create"
                        ? "bg-green-500/20 text-green-300"
                        : "bg-blue-500/20 text-blue-300"
                    }`}
                  >
                    {f.action === "create" ? "créé" : "modifié"}
                  </span>
                </div>
              ))}
            </div>
            <button
              onClick={handleReset}
              className="mt-5 flex items-center gap-2 bg-primary/20 hover:bg-primary/30 text-primary text-sm font-medium px-4 py-2 rounded-xl border border-primary/30 transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              Nouvelle feature
            </button>
          </EveBubble>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="flex-shrink-0 border-t border-white/10 bg-background/50 backdrop-blur-xl px-4 md:px-8 py-4">
        <div className="max-w-3xl mx-auto">
          <div
            className={`flex items-end gap-3 bg-white/5 border rounded-2xl px-4 py-3 transition-colors ${
              phase === "idle" ? "border-white/15 focus-within:border-primary/50" : "border-white/8 opacity-50 cursor-not-allowed"
            }`}
          >
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendPrompt();
                }
              }}
              disabled={phase !== "idle"}
              placeholder={
                phase === "idle"
                  ? "Décris la feature à implémenter… (Entrée pour envoyer)"
                  : "En attente…"
              }
              rows={1}
              className="flex-1 bg-transparent text-sm text-white placeholder:text-muted-foreground resize-none outline-none leading-relaxed"
            />
            <button
              onClick={handleSendPrompt}
              disabled={!prompt.trim() || phase !== "idle"}
              className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center flex-shrink-0 hover:bg-primary/90 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <Send className="w-4 h-4 text-white" />
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground/50 text-center mt-2">
            Eve a accès au repo GitHub · morepudding/aigamestudio
          </p>
        </div>
      </div>
    </div>
  );
}
