"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, FilePenLine, Loader2, Sparkles } from "lucide-react";
import {
  isGameBriefComplete,
  normalizeGameBrief,
  type BrainstormingSession,
} from "@/lib/types/brainstorming";
import BriefWizard from "./BriefWizard";

type BriefBannerProps = {
  projectId: string;
  projectTitle: string;
  initialSession?: BrainstormingSession | null;
  autoOpenIfIncomplete?: boolean;
  className?: string;
  onSessionSaved?: (session: BrainstormingSession) => void;
};

export default function BriefBanner({
  projectId,
  projectTitle,
  initialSession,
  autoOpenIfIncomplete = false,
  className = "",
  onSessionSaved,
}: BriefBannerProps) {
  const [session, setSession] = useState<BrainstormingSession | null>(initialSession ?? null);
  const [resolved, setResolved] = useState(initialSession !== undefined);
  const [loading, setLoading] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const autoOpenedRef = useRef(false);

  useEffect(() => {
    if (initialSession === undefined) return;
    setSession(initialSession);
    setResolved(true);
  }, [initialSession]);

  useEffect(() => {
    if (initialSession !== undefined) return;

    let active = true;

    async function loadSession() {
      setLoading(true);
      try {
        const res = await fetch(`/api/brainstorming/${projectId}/session`, { cache: "no-store" });
        const data = await res.json();
        if (!active) return;
        setSession(data?.session ?? null);
      } catch {
        if (!active) return;
        setSession(null);
      } finally {
        if (!active) return;
        setResolved(true);
        setLoading(false);
      }
    }

    loadSession();

    return () => {
      active = false;
    };
  }, [initialSession, projectId]);

  useEffect(() => {
    if (!resolved || !autoOpenIfIncomplete || autoOpenedRef.current) return;
    if (isGameBriefComplete(session?.gameBrief)) return;

    autoOpenedRef.current = true;
    setWizardOpen(true);
  }, [autoOpenIfIncomplete, resolved, session]);

  const brief = normalizeGameBrief(session?.gameBrief);
  const isComplete = isGameBriefComplete(brief);
  const referenceLabel = brief?.referenceGame || brief?.prototypeRef || "Référence à définir";
  const scopeLabel = brief?.scopeNote || "Scope à cadrer";

  function handleSaved(nextSession: BrainstormingSession) {
    setSession(nextSession);
    onSessionSaved?.(nextSession);
  }

  return (
    <>
      <section className={`sticky top-4 z-20 ${className}`}>
        <div className="rounded-2xl border border-white/10 bg-background/80 backdrop-blur-xl shadow-lg shadow-black/10 px-4 sm:px-5 py-4">
          {loading && !resolved ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Chargement du brief projet…
            </div>
          ) : (
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-muted-foreground">
                    <Sparkles className="w-3 h-3" />
                    Brief projet
                  </span>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 ${
                      isComplete
                        ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                        : "border border-amber-500/30 bg-amber-500/10 text-amber-300"
                    }`}
                  >
                    {isComplete ? <Sparkles className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                    {isComplete ? "Contexte prêt" : "Brief incomplet"}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2 text-xs sm:text-sm min-w-0">
                  <span className="rounded-lg bg-white/6 px-2.5 py-1.5 border border-white/10 text-foreground">
                    Genre: {brief?.genre ?? "à définir"}
                  </span>
                  <span className="rounded-lg bg-white/6 px-2.5 py-1.5 border border-white/10 text-foreground">
                    Durée: {brief?.sessionDuration ?? "à définir"}
                  </span>
                  <span className="rounded-lg bg-white/6 px-2.5 py-1.5 border border-white/10 text-foreground max-w-full truncate">
                    Réf: {referenceLabel}
                  </span>
                  <span className="rounded-lg bg-white/6 px-2.5 py-1.5 border border-white/10 text-foreground max-w-full truncate">
                    Scope: {scopeLabel}
                  </span>
                </div>

                <p className="text-sm text-muted-foreground">
                  {session
                    ? "Ce brief est persisté dans la session de brainstorming et sert de contexte stable pour les prochains runs."
                    : "Aucun brief persisté pour ce projet. Enregistre-le maintenant pour cadrer le brainstorming avant génération."}
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <button
                  onClick={() => setWizardOpen(true)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/12 bg-white/6 hover:bg-white/10 px-4 py-2.5 text-sm font-medium transition-colors"
                >
                  <FilePenLine className="w-4 h-4" />
                  {session ? "Modifier le brief" : "Créer le brief"}
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      <BriefWizard
        open={wizardOpen}
        projectId={projectId}
        projectTitle={projectTitle}
        session={session}
        onClose={() => setWizardOpen(false)}
        onSaved={handleSaved}
      />
    </>
  );
}