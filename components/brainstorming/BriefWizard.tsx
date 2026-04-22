"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronRight, Loader2, Sparkles, Wand2, X } from "lucide-react";
import {
  GAME_BRIEF_GENRES,
  SESSION_DURATIONS,
  normalizeGameBrief,
  type BrainstormingSession,
  type GameBriefExtended,
} from "@/lib/types/brainstorming";

type AgentSummary = {
  slug: string;
  department: string;
};

type BriefWizardProps = {
  open: boolean;
  projectId: string;
  projectTitle: string;
  session: BrainstormingSession | null;
  onClose: () => void;
  onSaved: (session: BrainstormingSession) => void;
};

type FormState = {
  genre: GameBriefExtended["genre"];
  sessionDuration: GameBriefExtended["sessionDuration"];
  theme: string;
  referenceGame: string;
  prototypeRef: string;
  scopeNote: string;
};

type ScopeSuggestion = {
  scope: string;
  why: string;
};

function buildInitialState(session: BrainstormingSession | null): FormState {
  const brief = normalizeGameBrief(session?.gameBrief);

  return {
    genre: brief?.genre ?? "action",
    sessionDuration: brief?.sessionDuration ?? "5min",
    theme: brief?.theme ?? "",
    referenceGame: brief?.referenceGame ?? "",
    prototypeRef: brief?.prototypeRef ?? "",
    scopeNote: brief?.scopeNote ?? "",
  };
}

export default function BriefWizard({
  open,
  projectId,
  projectTitle,
  session,
  onClose,
  onSaved,
}: BriefWizardProps) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(() => buildInitialState(session));
  const [saving, setSaving] = useState(false);
  const [loadingScopeSuggestions, setLoadingScopeSuggestions] = useState(false);
  const [scopeSuggestions, setScopeSuggestions] = useState<ScopeSuggestion[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setError(null);
    setScopeSuggestions([]);
    setForm(buildInitialState(session));
  }, [open, session]);

  const payload = useMemo<GameBriefExtended>(() => {
    const current = normalizeGameBrief(session?.gameBrief);

    return {
      genre: form.genre,
      sessionDuration: form.sessionDuration,
      theme: form.theme.trim(),
      referenceGame: form.referenceGame.trim(),
      prototypeRef: form.prototypeRef.trim() || null,
      scopeNote: form.scopeNote.trim() || null,
      lockedDecisions: current?.lockedDecisions ?? [],
    };
  }, [form, session]);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  const fetchScopeSuggestions = useCallback(async () => {
    if (!form.genre || !form.sessionDuration || !form.theme.trim()) {
      setError("Renseigne le genre, la durée et le thème avant de demander un scope suggéré.");
      return;
    }

    if (!form.referenceGame.trim() && !form.prototypeRef.trim()) {
      setError("Choisis d'abord une référence ou un prototype avant de demander un scope.");
      return;
    }

    setLoadingScopeSuggestions(true);
    setError(null);
    try {
      const res = await fetch("/api/brief/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "scope",
          projectId,
          genre: form.genre,
          sessionDuration: form.sessionDuration,
          theme: form.theme,
          referenceGame: form.referenceGame,
          prototypeRef: form.prototypeRef,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? "Impossible de générer des suggestions de scope.");
      }

      setScopeSuggestions(Array.isArray(data?.suggestions) ? data.suggestions : []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoadingScopeSuggestions(false);
    }
  }, [form.genre, form.prototypeRef, form.referenceGame, form.sessionDuration, form.theme, projectId]);

  function validateCurrentStep(): boolean {
    if (step === 1) {
      if (!form.theme.trim()) {
        setError("Ajoute au moins un thème ou une fantasy de départ.");
        return false;
      }
      return true;
    }

    if (step === 2) {
      if (!form.referenceGame.trim() && !form.prototypeRef.trim()) {
        setError("Indique un jeu de référence ou un slug de prototype interne.");
        return false;
      }
      return true;
    }

    if (!form.scopeNote.trim()) {
      setError("Définis une contrainte de scope V1 claire.");
      return false;
    }

    return true;
  }

  async function getDefaultGameDesignAgent(): Promise<AgentSummary | null> {
    const res = await fetch("/api/agents", { cache: "no-store" });
    if (!res.ok) {
      throw new Error("Impossible de charger les agents du studio.");
    }

    const agents = (await res.json()) as AgentSummary[];
    return agents.find((agent) => agent.department === "game-design") ?? null;
  }

  async function handleNext() {
    setError(null);
    if (!validateCurrentStep()) return;
    setStep((current) => Math.min(current + 1, 3));
  }

  useEffect(() => {
    if (!open || step !== 3) return;
    if (scopeSuggestions.length > 0) return;
    if (!form.referenceGame.trim() && !form.prototypeRef.trim()) return;

    void fetchScopeSuggestions();
  }, [fetchScopeSuggestions, form.prototypeRef, form.referenceGame, open, scopeSuggestions.length, step]);

  if (!open) return null;

  async function handleSave() {
    setError(null);
    if (!validateCurrentStep()) return;

    setSaving(true);
    try {
      let res: Response;

      if (session) {
        res = await fetch(`/api/brainstorming/${projectId}/session`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ gameBrief: payload }),
        });
      } else {
        const agent = await getDefaultGameDesignAgent();
        if (!agent) {
          throw new Error("Aucun agent game-design disponible pour créer la session de brainstorming.");
        }

        res = await fetch(`/api/brainstorming/${projectId}/session`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agentSlugs: [agent.slug],
            gameBrief: payload,
          }),
        });
      }

      const data = await res.json();
      if (!res.ok || !data?.session) {
        throw new Error(data?.error ?? "Impossible d'enregistrer le brief.");
      }

      onSaved(data.session as BrainstormingSession);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/65 backdrop-blur-sm">
      <div className="w-full sm:max-w-2xl bg-card border border-white/10 rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[95dvh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/8 shrink-0">
          <div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <span>{projectTitle}</span>
              <ChevronRight className="w-3 h-3" />
              <span>Brief projet</span>
            </div>
            <h2 className="font-bold text-lg">Wizard de cadrage</h2>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-white/8 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 pt-4 pb-2 shrink-0">
          <div className="flex items-center gap-2">
            {[1, 2, 3].map((index) => (
              <div
                key={index}
                className={`h-1.5 rounded-full transition-all ${
                  index === step ? "w-12 bg-primary" : index < step ? "w-6 bg-primary/50" : "w-6 bg-white/10"
                }`}
              />
            ))}
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-5">
          {step === 1 && (
            <>
              <div>
                <p className="text-sm font-semibold text-foreground">1. Genre, durée, thème</p>
                <p className="text-sm text-muted-foreground mt-1">
                  On verrouille la boucle visée avant de lancer le brainstorming multi-agents.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="block text-xs font-medium text-muted-foreground">Genre</span>
                  <select
                    value={form.genre}
                    onChange={(event) => setField("genre", event.target.value as FormState["genre"])}
                    className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm focus:outline-none focus:border-primary/50"
                  >
                    {GAME_BRIEF_GENRES.map((genre) => (
                      <option key={genre} value={genre}>
                        {genre}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1.5">
                  <span className="block text-xs font-medium text-muted-foreground">Durée de session cible</span>
                  <select
                    value={form.sessionDuration}
                    onChange={(event) => setField("sessionDuration", event.target.value as FormState["sessionDuration"])}
                    className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm focus:outline-none focus:border-primary/50"
                  >
                    {SESSION_DURATIONS.map((duration) => (
                      <option key={duration} value={duration}>
                        {duration}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="space-y-1.5 block">
                <span className="block text-xs font-medium text-muted-foreground">Thème ou fantasy</span>
                <input
                  value={form.theme}
                  onChange={(event) => setField("theme", event.target.value)}
                  placeholder="Ex: infiltration scolaire, sabotage, examen secret"
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm focus:outline-none focus:border-primary/50"
                />
              </label>
            </>
          )}

          {step === 2 && (
            <>
              <div>
                <p className="text-sm font-semibold text-foreground">2. Référence d&apos;inspiration</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Tu peux citer soit un jeu externe, soit un prototype interne déjà connu du studio.
                </p>
              </div>

              <label className="space-y-1.5 block">
                <span className="block text-xs font-medium text-muted-foreground">Jeu ou proto de référence</span>
                <input
                  value={form.referenceGame}
                  onChange={(event) => setField("referenceGame", event.target.value)}
                  placeholder="Ex: Metal Gear Solid, WarioWare, stealth-proto"
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm focus:outline-none focus:border-primary/50"
                />
              </label>

              <label className="space-y-1.5 block">
                <span className="block text-xs font-medium text-muted-foreground">Slug de proto interne (optionnel)</span>
                <input
                  value={form.prototypeRef}
                  onChange={(event) => setField("prototypeRef", event.target.value)}
                  placeholder="Ex: stealth-proto"
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm focus:outline-none focus:border-primary/50"
                />
              </label>
            </>
          )}

          {step === 3 && (
            <>
              <div>
                <p className="text-sm font-semibold text-foreground">3. Contrainte de scope V1</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Cette phrase devient la contrainte visible dans le bandeau et le contexte persistant du projet.
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/4 p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Suggestions IA</p>
                    <p className="text-xs text-muted-foreground">
                      Générées avec le contexte studio, le projet et les choix déjà faits dans le brief.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={fetchScopeSuggestions}
                    disabled={loadingScopeSuggestions}
                    className="inline-flex items-center gap-2 rounded-xl border border-white/12 bg-white/6 hover:bg-white/10 px-3 py-2 text-xs font-medium disabled:opacity-50"
                  >
                    {loadingScopeSuggestions ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                    Suggère-moi
                  </button>
                </div>

                {scopeSuggestions.length > 0 ? (
                  <div className="space-y-2">
                    {scopeSuggestions.map((suggestion) => (
                      <button
                        key={suggestion.scope}
                        type="button"
                        onClick={() => setField("scopeNote", suggestion.scope)}
                        className={`w-full text-left rounded-xl border px-3 py-3 transition-all ${
                          form.scopeNote === suggestion.scope
                            ? "border-primary/50 bg-primary/10"
                            : "border-white/10 bg-white/3 hover:bg-white/6 hover:border-white/20"
                        }`}
                      >
                        <p className="text-sm font-medium text-foreground">{suggestion.scope}</p>
                        <p className="text-xs text-muted-foreground mt-1">{suggestion.why}</p>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground/70">
                    Lance une suggestion pour proposer un scope V1 réaliste à partir du contexte courant.
                  </p>
                )}
              </div>

              <label className="space-y-1.5 block">
                <span className="block text-xs font-medium text-muted-foreground">Scope note</span>
                <textarea
                  rows={4}
                  value={form.scopeNote}
                  onChange={(event) => setField("scopeNote", event.target.value)}
                  placeholder="Ex: une seule map, une garde, une extraction, pas d'inventaire"
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm focus:outline-none focus:border-primary/50 resize-none"
                />
              </label>

              <div className="rounded-2xl border border-primary/20 bg-primary/8 p-4 space-y-2">
                <div className="flex items-center gap-2 text-primary text-sm font-semibold">
                  <Sparkles className="w-4 h-4" />
                  Résumé persistant
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span className="px-2.5 py-1 rounded-lg bg-white/8 text-foreground">{payload.genre}</span>
                  <span className="px-2.5 py-1 rounded-lg bg-white/8 text-foreground">{payload.sessionDuration}</span>
                  <span className="px-2.5 py-1 rounded-lg bg-white/8 text-foreground">{payload.referenceGame || payload.prototypeRef || "Référence manquante"}</span>
                </div>
                <p className="text-sm text-foreground">{payload.scopeNote || "Aucune contrainte de scope définie."}</p>
              </div>
            </>
          )}

          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 px-6 py-5 border-t border-white/8 shrink-0">
          <button
            onClick={() => setStep((current) => Math.max(current - 1, 1))}
            disabled={step === 1 || saving}
            className="px-4 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/8 text-sm disabled:opacity-40"
          >
            Retour
          </button>

          <button
            onClick={step === 3 ? handleSave : handleNext}
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-semibold disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {step === 3 ? "Enregistrer le brief" : "Continuer"}
          </button>
        </div>
      </div>
    </div>
  );
}