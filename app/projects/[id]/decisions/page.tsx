"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Loader2,
  MessageCircle,
  Sparkles,
} from "lucide-react";

interface Decision {
  id: string;
  projectId: string;
  scope: string;
  questionKey: string;
  questionText: string;
  options: string[];
  selectedOption: string | null;
  freeText: string | null;
  answered: boolean;
  sortOrder: number;
}

interface ProjectInfo {
  id: string;
  title: string;
  description: string;
  genre: string;
  engine: string;
  platforms: string[];
}

type ScopeKey = "global" | "gdd" | "tech-spec" | "data-arch" | "asset-list" | "backlog";

const SCOPE_LABELS: Record<string, string> = {
  global: "Vision globale",
  gdd: "Game Design Document",
  "tech-spec": "Spécification Technique",
  "data-arch": "Architecture Data",
  "asset-list": "Asset List",
  backlog: "Backlog",
};

const SCOPE_DESCRIPTIONS: Record<string, string> = {
  global: "Questions stratégiques sur la direction générale du projet",
  gdd: "Questions spécifiques au document de game design",
  "tech-spec": "Questions sur les choix techniques et d'infrastructure",
  "data-arch": "Questions sur la structure des données",
  "asset-list": "Questions sur les assets graphiques et audio",
  backlog: "Questions sur la planification et les priorités de dev",
};

const SCOPE_ORDER: ScopeKey[] = ["global", "gdd", "tech-spec", "backlog"];

export default function DecisionsWizardPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [currentScopeIdx, setCurrentScopeIdx] = useState(0);
  const [saving, setSaving] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [freeTexts, setFreeTexts] = useState<Record<string, string>>({});
  const [completing, setCompleting] = useState(false);
  const [completionError, setCompletionError] = useState<string | null>(null);

  const currentScope = SCOPE_ORDER[currentScopeIdx];

  // Fetch project + decisions
  useEffect(() => {
    if (!id) return;

    Promise.all([
      fetch(`/api/projects/${id}`).then((r) => r.json()),
      fetch(`/api/projects/${id}/decisions`).then((r) => r.json()),
    ])
      .then(([proj, decData]) => {
        setProject(proj);
        setDecisions(decData.decisions ?? []);
        setReady(decData.ready ?? false);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const scopeDecisions = decisions.filter((d) => d.scope === currentScope);
  const answeredInScope = scopeDecisions.filter((d) => d.answered).length;
  const totalInScope = scopeDecisions.length;

  // Answer a decision
  const handleAnswer = useCallback(
    async (decisionId: string, selectedOption: string) => {
      setSaving(decisionId);
      const freeText = freeTexts[decisionId] ?? null;

      try {
        const res = await fetch(`/api/projects/${id}/decisions`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decisionId, selectedOption, freeText }),
        });
        const updated = await res.json();

        setDecisions((prev) =>
          prev.map((d) =>
            d.id === decisionId
              ? { ...d, selectedOption, freeText, answered: true }
              : d
          )
        );
      } finally {
        setSaving(null);
      }
    },
    [id, freeTexts]
  );

  // Generate AI follow-up questions for current scope
  const handleGenerateMore = useCallback(async () => {
    if (!id) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/ai/generate-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: id, scope: currentScope }),
      });
      const data = await res.json();
      if (data.questions?.length) {
        // Save them to DB
        const saveRes = await fetch(`/api/projects/${id}/decisions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ questions: data.questions }),
        });
        const saved = await saveRes.json();
        if (saved.decisions?.length) {
          setDecisions((prev) => [...prev, ...saved.decisions]);
        }
      }
    } finally {
      setGenerating(false);
    }
  }, [id, currentScope]);

  // Complete wizard
  const handleComplete = useCallback(async () => {
    if (!id) return;
    setCompleting(true);
    setCompletionError(null);
    try {
      const response = await fetch(`/api/projects/${id}/decisions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markReady: true }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(
          typeof data?.error === "string"
            ? data.error
            : "Impossible de valider le cadrage pour le moment."
        );
      }

      router.push(`/projects/${id}`);
    } catch (error) {
      setCompletionError(
        error instanceof Error
          ? error.message
          : "Impossible de valider le cadrage pour le moment."
      );
    } finally {
      setCompleting(false);
    }
  }, [id, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-muted-foreground">Projet introuvable</p>
        <Link href="/projects" className="text-primary hover:underline text-sm">
          Retour aux projets
        </Link>
      </div>
    );
  }

  if (ready) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-6">
        <CheckCircle2 className="w-16 h-16 text-emerald-400" />
        <h2 className="text-2xl font-bold">Décisions déjà validées</h2>
        <p className="text-muted-foreground text-center max-w-md">
          Les décisions pour <strong>{project.title}</strong> ont déjà été prises.
          Elles seront injectées automatiquement dans les documents.
        </p>
        <Link
          href={`/projects/${id}`}
          className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors"
        >
          Retour au projet
        </Link>
      </div>
    );
  }

  const totalAnswered = decisions.filter((d) => d.answered).length;
  const totalQuestions = decisions.length;
  const progressPercent = totalQuestions > 0 ? Math.round((totalAnswered / totalQuestions) * 100) : 0;
  const isReadyToComplete = totalQuestions > 0 && totalAnswered === totalQuestions;

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground pb-24">
      {/* Top bar */}
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-white/8">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link
            href={`/projects/${id}`}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {project.title}
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              {totalAnswered}/{totalQuestions} réponses
            </span>
            <div className="w-32 h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="max-w-4xl mx-auto px-6 pt-8 pb-6 w-full">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-full bg-linear-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
            E
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">
              Cadrage avec Eve
            </h1>
            <p className="text-sm text-muted-foreground">
              Producer — Questions stratégiques avant rédaction
            </p>
          </div>
        </div>

        <div className="mt-4 p-4 rounded-xl bg-white/3 border border-white/8 text-sm text-muted-foreground leading-relaxed">
          <MessageCircle className="w-4 h-4 inline-block mr-2 text-primary" />
          Le cadrage avec Eve est obligatoire avant de lancer la rédaction des 5 documents.
          Je dois d'abord comprendre ta vision.
          Réponds à ces questions pour que l&apos;équipe ne prenne pas de décisions à ta place.
          Tu peux aussi ajouter du texte libre pour préciser ton choix.
        </div>
      </div>

      {/* Scope tabs */}
      <div className="max-w-4xl mx-auto px-6 w-full">
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
          {SCOPE_ORDER.map((scope, idx) => {
            const scopeItems = decisions.filter((d) => d.scope === scope);
            const answered = scopeItems.filter((d) => d.answered).length;
            const total = scopeItems.length;
            const isComplete = total > 0 && answered === total;
            const isCurrent = idx === currentScopeIdx;

            return (
              <button
                key={scope}
                onClick={() => setCurrentScopeIdx(idx)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                  isCurrent
                    ? "bg-primary/15 text-primary border border-primary/30"
                    : isComplete
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      : "bg-white/5 text-muted-foreground border border-white/8 hover:bg-white/10"
                }`}
              >
                {isComplete && <Check className="w-3.5 h-3.5" />}
                {SCOPE_LABELS[scope]}
                {total > 0 && (
                  <span className="text-xs opacity-60">
                    {answered}/{total}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Current scope header */}
      <div className="max-w-4xl mx-auto px-6 w-full mb-6">
        <h2 className="text-lg font-bold mb-1">{SCOPE_LABELS[currentScope]}</h2>
        <p className="text-sm text-muted-foreground">
          {SCOPE_DESCRIPTIONS[currentScope]}
        </p>
      </div>

      {/* Questions */}
      <div className="max-w-4xl mx-auto px-6 w-full space-y-6">
        {scopeDecisions.length === 0 && !generating && (
          <div className="text-center py-12 text-muted-foreground">
            <p className="mb-4">Aucune question pour cette section.</p>
            <button
              onClick={handleGenerateMore}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/15 text-primary text-sm font-medium hover:bg-primary/25 transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              Eve génère des questions
            </button>
          </div>
        )}

        {scopeDecisions.map((decision, idx) => (
          <div
            key={decision.id}
            className={`p-5 rounded-2xl border transition-all ${
              decision.answered
                ? "bg-white/2 border-emerald-500/20"
                : "bg-white/3 border-white/10"
            }`}
            style={{ animationDelay: `${idx * 80}ms` }}
          >
            <div className="flex items-start justify-between mb-4">
              <p className="font-semibold text-sm leading-relaxed pr-4">
                {decision.questionText}
              </p>
              {decision.answered && (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              )}
            </div>

            {/* Options as selectable cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
              {decision.options.map((option) => {
                const isSelected = decision.selectedOption === option;
                return (
                  <button
                    key={option}
                    onClick={() => handleAnswer(decision.id, option)}
                    disabled={saving === decision.id}
                    className={`text-left px-4 py-3 rounded-xl text-sm transition-all ${
                      isSelected
                        ? "bg-primary/20 border-primary/40 text-primary border font-medium"
                        : decision.answered
                          ? "bg-white/3 border border-white/5 text-muted-foreground opacity-60"
                          : "bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-foreground"
                    }`}
                  >
                    {saving === decision.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : isSelected ? (
                      <span className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5" />
                        {option}
                      </span>
                    ) : (
                      option
                    )}
                  </button>
                );
              })}
            </div>

            {/* Free text input */}
            <div className="mt-2">
              <input
                type="text"
                placeholder="Précision libre (optionnel)..."
                value={
                  decision.answered
                    ? decision.freeText ?? ""
                    : freeTexts[decision.id] ?? ""
                }
                onChange={(e) => {
                  if (!decision.answered) {
                    setFreeTexts((prev) => ({
                      ...prev,
                      [decision.id]: e.target.value,
                    }));
                  }
                }}
                disabled={decision.answered}
                className="w-full px-4 py-2 rounded-xl bg-white/5 border border-white/8 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/40 disabled:opacity-50 transition-colors"
              />
            </div>
          </div>
        ))}

        {/* Generate more questions button */}
        {scopeDecisions.length > 0 && (
          <div className="flex justify-center pt-2">
            <button
              onClick={handleGenerateMore}
              disabled={generating}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-muted-foreground hover:text-foreground hover:bg-white/10 transition-all disabled:opacity-50"
            >
              {generating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              Eve propose d&apos;autres questions
            </button>
          </div>
        )}

        {completionError && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {completionError}
          </div>
        )}
      </div>

      {/* Bottom navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/90 backdrop-blur-md border-t border-white/8 z-20">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => setCurrentScopeIdx((prev) => Math.max(0, prev - 1))}
            disabled={currentScopeIdx === 0}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-white/5 border border-white/10 hover:bg-white/10 transition-colors disabled:opacity-30"
          >
            <ArrowLeft className="w-4 h-4" />
            Précédent
          </button>

          {currentScopeIdx < SCOPE_ORDER.length - 1 ? (
            <button
              onClick={() =>
                setCurrentScopeIdx((prev) =>
                  Math.min(SCOPE_ORDER.length - 1, prev + 1)
                )
              }
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
            >
              Suivant
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleComplete}
              disabled={completing || !isReadyToComplete}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-600/20 disabled:opacity-50"
            >
              {completing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              Valider les décisions
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
