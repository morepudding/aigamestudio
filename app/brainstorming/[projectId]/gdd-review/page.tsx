"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Loader2,
  FileText,
  ChevronRight,
  CheckCircle2,
  Sparkles,
  RotateCcw,
  Eye,
  EyeOff,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { BrainstormingSession, CritiqueQuestion } from "@/lib/types/brainstorming";
import type { Project } from "@/lib/types/project";

// ============================================================
// Step types
// ============================================================

type Step = "loading-gdd" | "answering" | "generating-v2" | "done";

// ============================================================
// GDD Viewer (markdown side panel)
// ============================================================

function GddViewer({ content, label }: { content: string; label: string }) {
  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 border-b border-white/8 flex items-center gap-2 shrink-0">
        <FileText className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-semibold">{label}</span>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="prose prose-invert prose-sm max-w-none prose-headings:font-bold prose-headings:text-foreground prose-p:text-muted-foreground prose-li:text-muted-foreground prose-strong:text-foreground">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Question card
// ============================================================

function QuestionCard({
  question,
  answer,
  onChange,
}: {
  question: CritiqueQuestion;
  answer: string;
  onChange: (value: string) => void;
}) {
  const hasOptions = question.options && question.options.length > 0;

  return (
    <div className="bg-white/3 border border-white/10 rounded-xl p-4 space-y-3">
      <p className="text-sm font-medium text-foreground leading-relaxed">{question.question}</p>

      {hasOptions ? (
        <div className="space-y-2">
          {question.options!.map((opt) => (
            <button
              key={opt}
              onClick={() => onChange(opt)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all border ${
                answer === opt
                  ? "border-primary/60 bg-primary/15 text-foreground"
                  : "border-white/8 bg-white/3 text-muted-foreground hover:border-white/20 hover:bg-white/5"
              }`}
            >
              <span className={`inline-block w-3 h-3 rounded-full border mr-2 shrink-0 align-middle ${
                answer === opt ? "border-primary bg-primary" : "border-white/30"
              }`} />
              {opt}
            </button>
          ))}
          {/* Optional free text complement */}
          <textarea
            value={answer.startsWith(question.options![0]) || question.options!.includes(answer) ? "" : answer}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Ou précise librement…"
            rows={2}
            className="w-full mt-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50 resize-none"
          />
        </div>
      ) : (
        <textarea
          value={answer}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Ta réponse…"
          rows={3}
          className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50 resize-none"
        />
      )}

      {/* Required indicator */}
      {!answer.trim() && (
        <p className="text-xs text-amber-400/70">Réponse requise</p>
      )}
    </div>
  );
}

// ============================================================
// Main Page
// ============================================================

export default function GddReviewPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const router = useRouter();

  const [project, setProject] = useState<Project | null>(null);
  const [session, setSession] = useState<BrainstormingSession | null>(null);
  const [step, setStep] = useState<Step>("loading-gdd");
  const [gddV1, setGddV1] = useState<string | null>(null);
  const [gddV2, setGddV2] = useState<string | null>(null);
  const [critiqueQuestions, setCritiqueQuestions] = useState<CritiqueQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showV1, setShowV1] = useState(false);
  const [saving, setSaving] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load project + session
  useEffect(() => {
    Promise.all([
      fetch(`/api/projects/${projectId}`).then((r) => r.json()),
      fetch(`/api/brainstorming/${projectId}/session`).then((r) => r.json()),
    ]).then(([proj, sessionData]: [Project, { session: BrainstormingSession } | null]) => {
      setProject(proj);
      const sess = sessionData?.session ?? null;
      setSession(sess);

      if (sess?.gddFinalized && sess.gddV2) {
        // Already done → show V2 as final
        setGddV2(sess.gddV2);
        setStep("done");
        return;
      }

      if (sess?.gddV1 && sess.gdCritiqueQuestions) {
        // Resume from cached state
        setGddV1(sess.gddV1);
        setCritiqueQuestions(sess.gdCritiqueQuestions);
        setAnswers(sess.gddAnswers ?? {});
        setStep("answering");
        return;
      }

      // Start fresh GDD generation
      startGddGeneration();
    }).catch((err) => {
      console.error(err);
      setError("Erreur lors du chargement");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function startGddGeneration() {
    setStep("loading-gdd");
    setError(null);
    try {
      const res = await fetch(`/api/gdd-review/${projectId}/start`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Erreur lors de la génération du GDD");
      }
      const data = await res.json();
      setGddV1(data.gddV1);
      setCritiqueQuestions(data.critiqueQuestions ?? []);
      setAnswers({});
      setStep("answering");
    } catch (err) {
      setError((err as Error).message);
    }
  }

  function setAnswer(questionId: string, value: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }

  async function saveAnswers(): Promise<boolean> {
    setSaving(true);
    try {
      const res = await fetch(`/api/gdd-review/${projectId}/answers`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      return res.ok;
    } catch {
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleFinalize() {
    // Validate all questions answered
    const unanswered = critiqueQuestions.filter((q) => !answers[q.id]?.trim());
    if (unanswered.length > 0) {
      setError(`${unanswered.length} question${unanswered.length > 1 ? "s" : ""} sans réponse.`);
      return;
    }

    setError(null);
    setFinalizing(true);
    setStep("generating-v2");

    // Save answers first
    await saveAnswers();

    try {
      const res = await fetch(`/api/gdd-review/${projectId}/finalize`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Erreur lors de la finalisation");
      }
      const data = await res.json();
      setGddV2(data.gddV2);
      setStep("done");
    } catch (err) {
      setError((err as Error).message);
      setStep("answering");
    } finally {
      setFinalizing(false);
    }
  }

  const allAnswered =
    critiqueQuestions.length > 0 &&
    critiqueQuestions.every((q) => answers[q.id]?.trim());

  const answeredCount = critiqueQuestions.filter((q) => answers[q.id]?.trim()).length;

  // ============================================================
  // Step: Loading GDD V1
  // ============================================================
  if (step === "loading-gdd") {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto">
            <Loader2 className="w-7 h-7 animate-spin text-primary" />
          </div>
          <div>
            <h2 className="font-bold text-lg mb-1">Génération du GDD…</h2>
            <p className="text-sm text-muted-foreground">
              L&apos;IA rédige le premier jet à partir du scope du brainstorming,<br />
              puis l&apos;analyse pour identifier les points à clarifier.
            </p>
          </div>
          {error && (
            <div className="max-w-sm mx-auto">
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
              <button
                onClick={startGddGeneration}
                className="mt-3 text-xs text-primary hover:underline flex items-center gap-1 mx-auto"
              >
                <RotateCcw className="w-3 h-3" /> Réessayer
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ============================================================
  // Step: Generating V2
  // ============================================================
  if (step === "generating-v2") {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto">
            <Loader2 className="w-7 h-7 animate-spin text-emerald-400" />
          </div>
          <div>
            <h2 className="font-bold text-lg mb-1">Finalisation du GDD…</h2>
            <p className="text-sm text-muted-foreground">
              L&apos;IA intègre tes réponses et génère la version définitive.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================
  // Step: Done
  // ============================================================
  if (step === "done" && gddV2) {
    return (
      <div className="flex flex-col h-screen bg-background">
        {/* Header */}
        <div className="border-b border-white/8 bg-card/50 px-6 py-4 shrink-0">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <h1 className="font-bold text-lg">GDD finalisé — {project?.title}</h1>
                <p className="text-xs text-muted-foreground">
                  Document validé · Prêt pour la génération des autres documents
                </p>
              </div>
            </div>
            <button
              onClick={() => router.push(`/projects/${projectId}`)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-semibold transition-all"
            >
              Lancer la pipeline
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* GDD V2 full view */}
        <div className="flex-1 overflow-y-auto px-6 py-8">
          <div className="max-w-4xl mx-auto">
            <div className="bg-card border border-white/10 rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-white/8 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="font-semibold text-sm">Game Design Document — Version finale</span>
              </div>
              <div className="px-6 py-6">
                <div className="prose prose-invert prose-sm max-w-none prose-headings:font-bold prose-headings:text-foreground prose-p:text-muted-foreground prose-li:text-muted-foreground prose-strong:text-foreground">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{gddV2}</ReactMarkdown>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================
  // Step: Answering critique questions
  // ============================================================
  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="border-b border-white/8 bg-card/50 px-6 py-4 shrink-0">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="font-bold text-lg">Révision du GDD — {project?.title}</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              L&apos;IA a analysé son premier jet et identifié {critiqueQuestions.length} point{critiqueQuestions.length > 1 ? "s" : ""} à clarifier
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowV1(!showV1)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5 border border-white/8"
            >
              {showV1 ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              {showV1 ? "Masquer GDD V1" : "Voir GDD V1"}
            </button>
            {/* Progress badge */}
            <div className="text-xs font-medium px-3 py-1.5 rounded-full bg-white/8 border border-white/10">
              {answeredCount}/{critiqueQuestions.length} réponses
            </div>
          </div>
        </div>
      </div>

      {/* Split layout */}
      <div className="flex-1 overflow-hidden flex">
        {/* Left: Questions */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="max-w-2xl mx-auto space-y-4">
            {/* Intro */}
            <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl px-4 py-3">
              <p className="text-sm text-amber-200/80 leading-relaxed">
                Réponds à toutes les questions ci-dessous. L&apos;IA intégrera tes réponses pour produire
                la version finale du GDD. Chaque question est obligatoire.
              </p>
            </div>

            {/* Questions */}
            {critiqueQuestions.map((q) => (
              <QuestionCard
                key={q.id}
                question={q}
                answer={answers[q.id] ?? ""}
                onChange={(v) => setAnswer(q.id, v)}
              />
            ))}

            {error && (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            {/* CTA */}
            <div className="pt-2 pb-8">
              <button
                onClick={handleFinalize}
                disabled={!allAnswered || finalizing || saving}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-sm transition-all disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {finalizing ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Génération du GDD final…</>
                ) : (
                  <><Sparkles className="w-4 h-4" /> Valider et générer le GDD final</>
                )}
              </button>
              {!allAnswered && (
                <p className="text-xs text-center text-muted-foreground/60 mt-2">
                  {critiqueQuestions.length - answeredCount} question{critiqueQuestions.length - answeredCount > 1 ? "s" : ""} restante{critiqueQuestions.length - answeredCount > 1 ? "s" : ""}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Right: GDD V1 preview (optional) */}
        {showV1 && gddV1 && (
          <div className="w-[45%] border-l border-white/8 bg-white/2 overflow-hidden">
            <GddViewer content={gddV1} label="GDD — Premier jet (V1)" />
          </div>
        )}
      </div>
    </div>
  );
}
