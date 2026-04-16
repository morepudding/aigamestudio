"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check, MessageCircle } from "lucide-react";
import { EVE_ONBOARDING_STEPS, calculateEvePersonalityNuance } from "@/lib/prompts/eveOnboarding";
import { parseEmotion } from "@/lib/utils/emotion";

const TOTAL_STEPS = 7;

const STEP_EMOJIS: Record<number, string> = {
  1: "👋",
  2: "🔥",
  3: "🤝",
  4: "🌑",
  5: "🧠",
  6: "🤙",
  7: "🌿",
};

interface StepResult {
  step: number;
  theme: string;
  playerChoice: string;
  agentReaction: string;
  scores: Record<string, number>;
}

export default function EveOnboardingPage() {
  const router = useRouter();

  // Step state
  const [currentStep, setCurrentStep] = useState(0); // 0 = intro, 1-7 = steps, 8 = finalize
  const [stepResults, setStepResults] = useState<StepResult[]>([]);

  // Player identity
  const [playerName, setPlayerName] = useState("");
  const [playerNameInput, setPlayerNameInput] = useState("");

  // Per-step state
  const [eveMessage, setEveMessage] = useState(""); // intro message only
  const [eveLoading, setEveLoading] = useState(false);

  const [stepChoices, setStepChoices] = useState<string[]>([]);
  const [choicesLoading, setChoicesLoading] = useState(false);
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);

  const [agentReaction, setAgentReaction] = useState("");
  const [reactionLoading, setReactionLoading] = useState(false);

  // Step 7 special: generated closing message
  const [closingMessage, setClosingMessage] = useState("");
  const [closingLoading, setClosingLoading] = useState(false);

  // Final
  const [finalizing, setFinalizing] = useState(false);
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [avatarGenerating, setAvatarGenerating] = useState(false);
  const [finalError, setFinalError] = useState<string | null>(null);

  // ── Load Eve intro message on mount ──────────────────
  useEffect(() => {
    if (eveLoading || eveMessage) return;
    setEveLoading(true);

    fetch("/api/ai/onboarding/eve/welcome", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: "eve" }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.message) setEveMessage(data.message);
      })
      .catch(() => {
        setEveMessage("T'es là. Bien. Moi c'est Eve. Maintenant qu'on est juste nous deux — je veux apprendre à te connaître vraiment.");
      })
      .finally(() => setEveLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Fetch choices for a step ─────────────────────────
  const fetchChoices = useCallback(async (step: number) => {
    setChoicesLoading(true);
    setStepChoices([]);
    setSelectedChoice(null);
    setAgentReaction("");

    const conversationHistory = stepResults.flatMap((r) => [
      { sender: "user", content: r.playerChoice },
      { sender: "eve", content: r.agentReaction },
    ]);

    try {
      const res = await fetch("/api/ai/onboarding/eve/choices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step, conversationHistory, playerName }),
      });
      if (res.ok) {
        const data = await res.json();
        setStepChoices(data.choices ?? []);
      }
    } catch {
      setStepChoices([
        "Je réponds avec honnêteté.",
        "Je prends le temps de réfléchir avant de répondre.",
        "Je renvoie la question à Eve.",
      ]);
    } finally {
      setChoicesLoading(false);
    }
  }, [stepResults, playerName]);

  // ── Handle name submission (step 1) ──────────────────
  const handleNameSubmit = useCallback(async () => {
    const name = playerNameInput.trim();
    if (!name || reactionLoading) return;
    setPlayerName(name);
    setSelectedChoice(name);
    setReactionLoading(true);

    try {
      const res = await fetch("/api/ai/onboarding/eve/roleplay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step: 1,
          playerChoice: name,
          conversationHistory: [],
          playerName: name,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setAgentReaction(data.message ?? "");
      }
    } catch {
      setAgentReaction("Bien. On va travailler ensemble, alors.");
    } finally {
      setReactionLoading(false);
    }
  }, [playerNameInput, reactionLoading]);

  // ── Start a step ─────────────────────────────────────
  const startStep = useCallback((step: number) => {
    setCurrentStep(step);
    if (step === 1) {
      // Step 1 uses free input — reset state only
      setStepChoices([]);
      setSelectedChoice(null);
      setAgentReaction("");
    } else if (step <= 6) {
      fetchChoices(step);
    } else if (step === 7) {
      // Generate closing message from Eve
      generateClosingMessage();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchChoices]);

  // ── Generate Eve's closing message (step 7) ───────────
  const generateClosingMessage = useCallback(async () => {
    setClosingLoading(true);

    const conversationHistory = stepResults.flatMap((r) => [
      { sender: "user", content: r.playerChoice },
      { sender: "eve", content: r.agentReaction },
    ]);

    try {
      const res = await fetch("/api/ai/onboarding/eve/closing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationHistory, playerName }),
      });
      if (res.ok) {
        const data = await res.json();
        setClosingMessage(data.message ?? "");
      }
    } catch {
      setClosingMessage("Je sais pas encore tout de toi. Mais j'ai assez pour commencer.");
    } finally {
      setClosingLoading(false);
    }
  }, [stepResults, playerName]);

  // ── Handle choice → get Eve reaction ─────────────────
  const handleChoice = useCallback(async (choice: string) => {
    if (reactionLoading || selectedChoice) return;
    setSelectedChoice(choice);
    setReactionLoading(true);

    const conversationHistory = stepResults.flatMap((r) => [
      { sender: "user", content: r.playerChoice },
      { sender: "eve", content: r.agentReaction },
    ]);

    try {
      const res = await fetch("/api/ai/onboarding/eve/roleplay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step: currentStep,
          playerChoice: choice,
          conversationHistory,
          playerName,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setAgentReaction(data.message ?? "");
      }
    } catch {
      setAgentReaction("Noté.");
    } finally {
      setReactionLoading(false);
    }
  }, [reactionLoading, selectedChoice, stepResults, currentStep, playerName]);

  // ── Score signals from a choice ──────────────────────
  const scoreChoice = useCallback((step: number, choice: string): Record<string, number> => {
    const stepData = EVE_ONBOARDING_STEPS[step];
    if (!stepData) return {};

    const scores: Record<string, number> = {};
    const choiceLower = choice.toLowerCase();

    for (const [trait, signals] of Object.entries(stepData.scoringSignals)) {
      for (const signal of signals) {
        if (choiceLower.includes(signal)) {
          scores[trait] = (scores[trait] ?? 0) + 1;
        }
      }
    }
    return scores;
  }, []);

  // ── Confirm step → move to next ──────────────────────
  const confirmStep = useCallback(() => {
    const choice = currentStep === 1 ? playerName : selectedChoice;
    if (!choice || !agentReaction) return;

    const stepData = EVE_ONBOARDING_STEPS[currentStep];
    const scores = scoreChoice(currentStep, choice);

    setStepResults((prev) => [
      ...prev,
      {
        step: currentStep,
        theme: stepData.theme,
        playerChoice: choice,
        agentReaction,
        scores,
      },
    ]);

    if (currentStep < TOTAL_STEPS) {
      startStep(currentStep + 1);
    } else {
      setCurrentStep(8); // finalize screen
    }
  }, [playerName, selectedChoice, agentReaction, currentStep, scoreChoice, startStep]);

  // ── "On y va" from step 7 ────────────────────────────
  const confirmClosing = useCallback(() => {
    setCurrentStep(8);
  }, []);

  // ── Finalize onboarding ──────────────────────────────
  const finalizeOnboarding = useCallback(async () => {
    if (finalizing) return;
    setFinalizing(true);
    setFinalError(null);

    try {
      // 1. Calculate final personality nuance
      const totalScores: Record<string, number> = {};
      for (const result of stepResults) {
        for (const [trait, score] of Object.entries(result.scores)) {
          totalScores[trait] = (totalScores[trait] ?? 0) + score;
        }
      }
      const personalityNuance = calculateEvePersonalityNuance(totalScores);

      // 2. Save onboarding choices
      for (const result of stepResults) {
        await fetch("/api/ai/onboarding/save-choice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agentSlug: "eve",
            step: result.step,
            theme: result.theme,
            playerChoice: result.playerChoice,
            agentReaction: result.agentReaction,
          }),
        });
      }

      // 3. Extract and save foundational memories
      const allMessages = stepResults.flatMap((r) => [
        { sender: "user", content: r.playerChoice },
        { sender: "agent", content: r.agentReaction },
      ]);

      await fetch("/api/ai/extract-memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentName: "Eve",
          agentRole: "Producer",
          messages: allMessages,
          existingMemories: [],
          agentSlug: "eve",
        }),
      });

      // 4. Compute confidence boost from how open the boss was
      // More "chaleureuse" signals → warmer relationship → higher starting confidence
      const warmthScore = (totalScores["chaleureuse"] ?? 0) + (totalScores["dragueuse"] ?? 0) * 0.5;
      const confidenceLevel = Math.min(35, 20 + Math.round(warmthScore * 2));

      // 5. Activate Eve with calculated personality and mood
      await fetch("/api/agents/eve", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "actif",
          confidence_level: confidenceLevel,
          mood: "enthousiaste",
          mood_cause: "Premier jour. On commence enfin.",
        }),
      });

      // 6. Update personality_nuance via Supabase (direct, as PATCH only allows certain fields)
      await fetch("/api/agents/eve/personality", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personality_nuance: personalityNuance }),
      });

      // 7. Save player name globally
      if (playerName) {
        await fetch("/api/studio-settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: "player_name", value: playerName }),
        });
      }

      setOnboardingComplete(true);

      // 7. Generate avatar in background
      setAvatarGenerating(true);
      fetch("/api/ai/generate-avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: "eve" }),
      })
        .catch(() => {})
        .finally(() => setAvatarGenerating(false));

    } catch {
      setFinalError("Une erreur est survenue. Réessaie.");
    } finally {
      setFinalizing(false);
    }
  }, [finalizing, stepResults, playerName]);

  // ─── COMPLETE ───────────────────────────────────────
  if (onboardingComplete) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-6 py-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="w-20 h-20 rounded-full bg-emerald-500/10 border-2 border-emerald-500/30 flex items-center justify-center">
          <Check className="w-10 h-10 text-emerald-400" />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-white">C'est parti.</h2>
          <p className="text-muted-foreground text-sm max-w-sm">
            Eve est là. Le studio peut commencer.
          </p>
        </div>
        {avatarGenerating && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground animate-pulse">
            <Loader2 className="w-4 h-4 animate-spin" />
            Génération du portrait…
          </div>
        )}
        <button
          onClick={() => router.push("/")}
          disabled={avatarGenerating}
          className="w-full max-w-xs py-4 bg-primary hover:bg-primary/90 disabled:opacity-50 rounded-2xl text-base font-bold text-primary-foreground transition-all shadow-lg shadow-primary/20 active:scale-95"
        >
          {avatarGenerating ? <><Loader2 className="w-4 h-4 animate-spin inline mr-2" />Patienter…</> : "Entrer dans le studio"}
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Fixed header */}
      <div className="sticky top-0 z-10 bg-background/90 backdrop-blur-sm border-b border-white/5 px-5 py-3">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-linear-to-br from-pink-500 to-rose-600 flex items-center justify-center text-white font-bold text-xs shadow-lg shrink-0">
            E
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm leading-none">Eve</p>
            <p className="text-muted-foreground text-[11px] mt-0.5">Premier contact</p>
          </div>
          {currentStep > 0 && currentStep <= TOTAL_STEPS && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {currentStep}/{TOTAL_STEPS}
            </span>
          )}
        </div>

        {/* Progress bar */}
        {currentStep > 0 && currentStep <= TOTAL_STEPS && (
          <div className="max-w-lg mx-auto flex gap-1 mt-3">
            {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((s) => (
              <div
                key={s}
                className={`h-0.5 flex-1 rounded-full transition-all duration-500 ${
                  s < currentStep
                    ? "bg-emerald-500"
                    : s === currentStep
                    ? "bg-rose-400"
                    : "bg-white/10"
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-lg mx-auto px-5 py-6 space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-700 safe-area-bottom">

          {/* ─── INTRO ─────────────────────────────────────── */}
          {currentStep === 0 && (
            <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-500">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                {eveLoading ? (
                  <div className="flex items-center gap-2 text-muted-foreground animate-pulse text-sm">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Eve arrive…
                  </div>
                ) : (
                  <p className="text-white/80 leading-relaxed text-[15px]">{parseEmotion(eveMessage).text}</p>
                )}
              </div>

              {eveMessage && !eveLoading && (
                <button
                  onClick={() => startStep(1)}
                  className="w-full py-4 bg-rose-500/20 hover:bg-rose-500/30 active:scale-95 border border-rose-500/30 rounded-2xl text-base font-semibold text-rose-300 transition-all"
                >
                  Commencer
                </button>
              )}
            </div>
          )}

          {/* ─── STEPS 1-6: CHOICES ────────────────────────── */}
          {currentStep >= 1 && currentStep <= 6 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
              {/* Step label */}
              <div className="flex items-center gap-2">
                <span className="text-lg">{STEP_EMOJIS[currentStep]}</span>
                <p className="text-xs font-medium text-white/50 uppercase tracking-wide">
                  {EVE_ONBOARDING_STEPS[currentStep]?.theme.split(" — ")[0]}
                </p>
              </div>

              {/* Step 1: free name input */}
              {currentStep === 1 && !selectedChoice && (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={playerNameInput}
                    onChange={(e) => setPlayerNameInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleNameSubmit()}
                    placeholder="Ton prénom…"
                    maxLength={40}
                    autoFocus
                    className="w-full px-4 py-4 bg-white/5 border border-white/10 rounded-2xl text-[15px] text-white placeholder-white/30 focus:outline-none focus:border-rose-500/40 focus:bg-white/8 transition-all"
                  />
                  <button
                    onClick={handleNameSubmit}
                    disabled={!playerNameInput.trim() || reactionLoading}
                    className="w-full py-4 bg-rose-500/20 hover:bg-rose-500/30 active:scale-[0.98] border border-rose-500/30 disabled:opacity-40 disabled:cursor-not-allowed rounded-2xl text-base font-semibold text-rose-300 transition-all"
                  >
                    {reactionLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" /> Un instant…
                      </span>
                    ) : "Valider →"}
                  </button>
                </div>
              )}

              {/* Step 1 confirmed: show chosen name */}
              {currentStep === 1 && selectedChoice && (
                <div className="px-4 py-4 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-white text-[15px]">
                  {selectedChoice}
                </div>
              )}

              {/* Steps 2-6: Choices */}
              {currentStep >= 2 && (choicesLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-2.5">
                  {stepChoices.map((choice, i) => (
                    <button
                      key={i}
                      onClick={() => handleChoice(choice)}
                      disabled={!!selectedChoice}
                      className={`w-full text-left px-4 py-4 rounded-2xl text-[15px] leading-snug transition-all duration-200 active:scale-[0.98] ${
                        selectedChoice === choice
                          ? "bg-rose-500/20 border border-rose-500/40 text-white"
                          : selectedChoice
                          ? "bg-white/3 text-white/20 cursor-not-allowed border border-transparent"
                          : "bg-white/5 text-white/80 border border-white/10 active:bg-white/10"
                      }`}
                    >
                      <span className="flex items-start gap-3">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5 ${
                          selectedChoice === choice
                            ? "bg-rose-500/30 text-rose-300"
                            : "bg-white/10 text-white/40"
                        }`}>
                          {String.fromCharCode(65 + i)}
                        </span>
                        <span>{choice}</span>
                      </span>
                    </button>
                  ))}
                </div>
              ))}

              {/* Eve reaction */}
              {(reactionLoading || agentReaction) && (
                <div className="border-l-2 border-rose-500/30 pl-4 py-1 animate-in fade-in slide-in-from-bottom-2 duration-500">
                  <p className="text-[11px] text-rose-400/60 mb-2 font-semibold uppercase tracking-wide">Eve</p>
                  {reactionLoading ? (
                    <div className="flex gap-1.5 py-1">
                      <span className="w-1.5 h-1.5 bg-white/30 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-1.5 h-1.5 bg-white/30 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-1.5 h-1.5 bg-white/30 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  ) : (
                    <p className="text-[15px] text-white/75 leading-relaxed">{parseEmotion(agentReaction).text}</p>
                  )}
                </div>
              )}

              {/* Next button — full width on mobile */}
              {agentReaction && !reactionLoading && (
                <button
                  onClick={confirmStep}
                  className="w-full py-4 bg-white/5 hover:bg-white/10 active:scale-[0.98] border border-white/10 rounded-2xl text-sm font-semibold text-white/60 transition-all flex items-center justify-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300"
                >
                  {currentStep < TOTAL_STEPS ? (
                    <><MessageCircle className="w-4 h-4" /> Suite</>
                  ) : (
                    <><Check className="w-4 h-4" /> Continuer</>
                  )}
                </button>
              )}
            </div>
          )}

          {/* ─── STEP 7: CLOSING ───────────────────────────── */}
          {currentStep === 7 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <div className="flex items-center gap-2">
                <span className="text-lg">{STEP_EMOJIS[7]}</span>
                <p className="text-xs font-medium text-white/50 uppercase tracking-wide">Silence</p>
              </div>

              <div className="border-l-2 border-rose-500/30 pl-4 py-2">
                <p className="text-[11px] text-rose-400/60 mb-2 font-semibold uppercase tracking-wide">Eve</p>
                {closingLoading ? (
                  <div className="flex gap-1.5 py-2">
                    <span className="w-1.5 h-1.5 bg-white/30 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 bg-white/30 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 bg-white/30 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                ) : (
                  <p className="text-[15px] text-white/85 leading-relaxed italic">{parseEmotion(closingMessage).text}</p>
                )}
              </div>

              {closingMessage && !closingLoading && (
                <button
                  onClick={confirmClosing}
                  className="w-full py-4 bg-rose-500/15 hover:bg-rose-500/25 active:scale-[0.98] border border-rose-500/25 rounded-2xl text-base font-semibold text-rose-300/80 transition-all animate-in fade-in slide-in-from-bottom-2 duration-500"
                >
                  On y va.
                </button>
              )}
            </div>
          )}

          {/* ─── STEP 8: FINALIZE ──────────────────────────── */}
          {currentStep === 8 && (
            <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <div className="space-y-2">
                {stepResults.map((r, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 text-sm bg-white/3 rounded-xl px-4 py-3"
                  >
                    <span className="text-base">{STEP_EMOJIS[r.step]}</span>
                    <span className="truncate text-white/40 flex-1">{r.playerChoice}</span>
                    <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  </div>
                ))}
              </div>

              {finalError && (
                <p className="text-sm text-rose-400 text-center">{finalError}</p>
              )}

              <button
                onClick={finalizeOnboarding}
                disabled={finalizing}
                className="w-full py-4 bg-emerald-600/20 hover:bg-emerald-600/30 active:scale-[0.98] border border-emerald-500/30 disabled:opacity-50 rounded-2xl text-base font-bold text-emerald-300 transition-all flex items-center justify-center gap-2"
              >
                {finalizing ? (
                  <><Loader2 className="w-5 h-5 animate-spin" />Un instant…</>
                ) : (
                  <><Check className="w-5 h-5" />Lancer le studio</>
                )}
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
