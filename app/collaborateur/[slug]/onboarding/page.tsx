"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  Check,
  Sparkles,
  MessageCircle,
  Wine,
} from "lucide-react";

interface AgentDetail {
  slug: string;
  name: string;
  role: string;
  goal: string;
  backstory: string;
  department: string;
  gender: string;
  personality_primary: string;
  personality_nuance: string;
  status: string;
  assigned_project: string;
}

const departmentGradients: Record<string, string> = {
  art: "from-pink-500 to-rose-600",
  programming: "from-cyan-500 to-blue-600",
  "game-design": "from-amber-500 to-orange-600",
  audio: "from-violet-500 to-purple-600",
  narrative: "from-emerald-500 to-teal-600",
  qa: "from-lime-500 to-green-600",
  marketing: "from-red-500 to-pink-600",
  production: "from-indigo-500 to-blue-600",
};

const STEP_THEMES = [
  { step: 1, theme: "Souvenir", emoji: "💭" },
  { step: 2, theme: "Kiff", emoji: "🔥" },
  { step: 3, theme: "Manie", emoji: "🫣" },
  { step: 4, theme: "Allergie", emoji: "💀" },
  { step: 5, theme: "Deal", emoji: "🤝" },
];

const EVE_TRANSITIONS = [
  (name: string) => `Allez, on commence en douceur. ${name}, dis-nous un peu d'où tu viens…`,
  (name: string) => `Ok, ça c'est fait. Maintenant ${name}, parlons de ce qui te fait vibrer…`,
  (name: string) => `J'adore ce que j'entends. Maintenant, le moment gênant — ${name}, t'as forcément un truc bizarre…`,
  (name: string) => `Haha, noté. Bon, ${name}, dis-nous ce qui te rend carrément dingue…`,
  (name: string) => `Dernière question, et après on trinque. ${name}, un deal entre toi et le boss…`,
];

function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

interface StepResult {
  theme: string;
  question: string;
  playerChoice: string;
  agentReaction: string;
}

export default function OnboardingPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();

  const [agent, setAgent] = useState<AgentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Eve welcome
  const [eveMessage, setEveMessage] = useState("");
  const [eveLoading, setEveLoading] = useState(false);
  const [eveFetched, setEveFetched] = useState(false);

  // Step state
  const [currentStep, setCurrentStep] = useState(0); // 0 = welcome, 1-5 = steps
  const [stepChoices, setStepChoices] = useState<string[]>([]);
  const [stepQuestion, setStepQuestion] = useState("");
  const [choicesLoading, setChoicesLoading] = useState(false);
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [agentReaction, setAgentReaction] = useState("");
  const [reactionLoading, setReactionLoading] = useState(false);
  const [stepResults, setStepResults] = useState<StepResult[]>([]);

  // Final
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [avatarGenerating, setAvatarGenerating] = useState(false);

  // ── Fetch agent ────────────────────────────────────────
  useEffect(() => {
    if (!slug) return;
    fetch(`/api/agents/${slug}`)
      .then((res) => {
        if (!res.ok) throw new Error("not found");
        return res.json();
      })
      .then((data) => setAgent(data))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

  // ── Eve welcome message ───────────────────────────────
  useEffect(() => {
    if (!agent || eveFetched || eveLoading) return;
    setEveLoading(true);
    setEveFetched(true);
    fetch("/api/ai/onboarding/welcome", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: agent.slug }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.message) setEveMessage(data.message);
      })
      .catch(() => {})
      .finally(() => setEveLoading(false));
  }, [agent, eveFetched, eveLoading]);

  // ── Fetch choices for current step ────────────────────
  const fetchChoices = useCallback(async (step: number) => {
    if (!agent) return;
    setChoicesLoading(true);
    setStepChoices([]);
    setStepQuestion("");
    setSelectedChoice(null);
    setAgentReaction("");

    try {
      const res = await fetch("/api/ai/onboarding/choices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step,
          agentName: agent.name,
          role: agent.role,
          department: agent.department,
          personalityPrimary: agent.personality_primary,
          personalityNuance: agent.personality_nuance,
          gender: agent.gender,
          backstory: agent.backstory,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setStepChoices(data.choices ?? []);
        setStepQuestion(data.question ?? "");
      }
    } catch {
      // silent
    } finally {
      setChoicesLoading(false);
    }
  }, [agent]);

  // ── Start step (Eve transition → fetch choices) ───────
  const startStep = useCallback((step: number) => {
    setCurrentStep(step);
    fetchChoices(step);
  }, [fetchChoices]);

  // ── Handle choice selection → get agent reaction ──────
  const handleChoice = useCallback(async (choice: string) => {
    if (!agent || reactionLoading) return;
    setSelectedChoice(choice);
    setReactionLoading(true);

    try {
      const res = await fetch("/api/ai/onboarding/roleplay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: agent.name,
          role: agent.role,
          gender: agent.gender,
          personalityPrimary: agent.personality_primary,
          personalityNuance: agent.personality_nuance,
          backstory: agent.backstory,
          department: agent.department,
          conversationHistory: [
            ...stepResults.flatMap((r) => [
              { sender: "user", content: r.playerChoice },
              { sender: "agent", content: r.agentReaction },
            ]),
          ],
          userMessage: `(Le boss choisit pour toi : "${choice}")`,
          mode: "reply",
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setAgentReaction(data.message ?? "");
      }
    } catch {
      setAgentReaction("*sourit* Intéressant… c'est noté, boss.");
    } finally {
      setReactionLoading(false);
    }
  }, [agent, reactionLoading, stepResults]);

  // ── Confirm step and move to next ─────────────────────
  const confirmStep = useCallback(() => {
    if (!selectedChoice || !agentReaction) return;
    const theme = STEP_THEMES[currentStep - 1];
    setStepResults((prev) => [
      ...prev,
      {
        theme: theme.theme,
        question: stepQuestion,
        playerChoice: selectedChoice,
        agentReaction,
      },
    ]);
    if (currentStep < 5) {
      startStep(currentStep + 1);
    } else {
      setCurrentStep(6); // finalize screen
    }
  }, [selectedChoice, agentReaction, currentStep, stepQuestion, startStep]);

  // ── Finalize onboarding ───────────────────────────────
  const finalizeOnboarding = useCallback(async () => {
    if (!agent || finalizing) return;
    setFinalizing(true);

    try {
      // 1. Save choices to onboarding_choices table
      for (const result of stepResults) {
        await fetch("/api/ai/onboarding/save-choice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agentSlug: agent.slug,
            step: stepResults.indexOf(result) + 1,
            theme: result.theme,
            playerChoice: result.playerChoice,
            agentReaction: result.agentReaction,
          }),
        });
      }

      // 2. Save memories from choices
      for (const result of stepResults) {
        await fetch("/api/ai/extract-memory", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agentName: agent.name,
            agentRole: agent.role,
            messages: [
              { sender: "user", content: result.playerChoice },
              { sender: "agent", content: result.agentReaction },
            ],
            existingMemories: [],
            agentSlug: agent.slug,
          }),
        });
      }

      // 3. Activate agent
      await fetch(`/api/agents/${agent.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "actif",
          confidence_level: 15,
          mood: "enthousiaste",
          mood_cause: "Premier jour au studio — afterwork de bienvenue !",
        }),
      });

      setOnboardingComplete(true);

      // 4. Generate avatar in background
      setAvatarGenerating(true);
      fetch("/api/ai/generate-avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: agent.slug }),
      })
        .catch(() => {})
        .finally(() => setAvatarGenerating(false));
    } catch {
      // silent
    } finally {
      setFinalizing(false);
    }
  }, [agent, finalizing, stepResults]);

  // ── Render ────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground animate-pulse">
        Chargement…
      </div>
    );
  }

  if (notFound || !agent) {
    return (
      <div className="space-y-4">
        <Link
          href="/collaborateur"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Retour
        </Link>
        <p className="text-muted-foreground">Agent introuvable.</p>
      </div>
    );
  }

  const gradient =
    departmentGradients[agent.department] ?? "from-gray-500 to-gray-600";

  // ─── ONBOARDING COMPLETE ──────────────────────────────
  if (onboardingComplete) {
    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="flex flex-col items-center gap-6 py-16">
          <div className="w-20 h-20 rounded-full bg-emerald-500/10 border-2 border-emerald-500/30 flex items-center justify-center">
            <Check className="w-10 h-10 text-emerald-400" />
          </div>
          <div className="text-center">
            <h2 className="text-2xl font-bold text-white mb-2">
              {agent.name} fait partie de l&apos;équipe !
            </h2>
            <p className="text-muted-foreground text-sm max-w-md">
              L&apos;afterwork est terminé. {agent.name} est maintenant actif
              {agent.gender === "femme" ? "ve" : ""} et prêt
              {agent.gender === "femme" ? "e" : ""} à bosser.
            </p>
          </div>
          {avatarGenerating && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground animate-pulse">
              <Loader2 className="w-4 h-4 animate-spin" />
              Génération du portrait en cours…
            </div>
          )}
          <button
            onClick={() => router.push(`/collaborateur/${slug}`)}
            disabled={avatarGenerating}
            className="flex items-center gap-2 px-6 py-2.5 bg-primary hover:bg-primary/90 disabled:opacity-50 rounded-xl text-sm font-semibold text-primary-foreground transition-all shadow-lg shadow-primary/20"
          >
            {avatarGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Patienter…
              </>
            ) : (
              "Voir la fiche agent"
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Back */}
      <Link
        href={`/collaborateur/${slug}`}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Retour à la fiche
      </Link>

      {/* Header — Afterwork vibe */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-linear-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-xl text-lg">
          <Wine className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">
            Afterwork — {agent.name}
          </h1>
          <p className="text-muted-foreground text-sm">
            Faisons connaissance autour d&apos;un verre
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="flex gap-1.5">
        {STEP_THEMES.map((s) => (
          <div
            key={s.step}
            className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${
              s.step < currentStep
                ? "bg-emerald-500"
                : s.step === currentStep
                ? "bg-primary"
                : "bg-white/10"
            }`}
          />
        ))}
      </div>

      {/* ─── EVE WELCOME BANNER ──────────────────────── */}
      {(eveMessage || eveLoading) && (
        <div className="bg-linear-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-2xl p-5 animate-in fade-in slide-in-from-top-2 duration-500">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-linear-to-br from-pink-500 to-rose-600 flex items-center justify-center text-white font-bold text-xs shadow-lg shrink-0">
              E
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-white text-sm">Eve</span>
                <span className="text-xs text-muted-foreground">Producer</span>
              </div>
              {eveLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground text-sm animate-pulse">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  prépare l&apos;afterwork…
                </div>
              ) : (
                <p className="text-sm text-white/70 leading-relaxed">
                  {eveMessage}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── WELCOME: START BUTTON ───────────────────── */}
      {currentStep === 0 && eveMessage && !eveLoading && (
        <div className="flex justify-center pt-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <button
            onClick={() => startStep(1)}
            className="flex items-center gap-2 px-8 py-3 bg-primary hover:bg-primary/90 rounded-xl text-sm font-bold text-primary-foreground transition-all shadow-lg shadow-primary/20"
          >
            <Sparkles className="w-4 h-4" />
            Commencer l&apos;afterwork
          </button>
        </div>
      )}

      {/* ─── STEP 1-5: DIALOGUE CHOICES ──────────────── */}
      {currentStep >= 1 && currentStep <= 5 && (
        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-700">
          {/* Previous results recap (collapsed) */}
          {stepResults.length > 0 && (
            <div className="space-y-2">
              {stepResults.map((r, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 text-xs text-muted-foreground bg-white/3 rounded-lg px-3 py-2"
                >
                  <span>{STEP_THEMES[i].emoji}</span>
                  <span className="font-medium text-white/50">{r.theme}</span>
                  <span className="text-white/30">—</span>
                  <span className="truncate">{r.playerChoice}</span>
                  <Check className="w-3 h-3 text-emerald-500 ml-auto shrink-0" />
                </div>
              ))}
            </div>
          )}

          {/* Eve transition */}
          <div className="bg-linear-to-r from-indigo-500/5 to-transparent border-l-2 border-indigo-500/30 pl-4 py-2 animate-in fade-in slide-in-from-left-2 duration-500">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-6 h-6 rounded-full bg-linear-to-br from-pink-500 to-rose-600 flex items-center justify-center text-white font-bold text-[10px]">
                E
              </div>
              <span className="text-xs font-medium text-white/50">Eve</span>
            </div>
            <p className="text-sm text-white/60 italic">
              {EVE_TRANSITIONS[currentStep - 1](agent.name)}
            </p>
          </div>

          {/* Step header */}
          <div className="flex items-center gap-3">
            <span className="text-2xl">{STEP_THEMES[currentStep - 1].emoji}</span>
            <div>
              <h2 className="text-lg font-bold text-white">
                {STEP_THEMES[currentStep - 1].theme}
              </h2>
              <p className="text-sm text-muted-foreground">
                Étape {currentStep}/5
              </p>
            </div>
          </div>

          {/* Question */}
          {stepQuestion && (
            <p className="text-sm text-white/80 bg-white/5 rounded-xl px-4 py-3 border border-white/10">
              {stepQuestion}
            </p>
          )}

          {/* Choices */}
          {choicesLoading ? (
            <div className="flex items-center gap-3 text-muted-foreground animate-pulse py-6 justify-center">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Préparation des choix…</span>
            </div>
          ) : (
            <div className="space-y-2">
              {stepChoices.map((choice, i) => (
                <button
                  key={i}
                  onClick={() => handleChoice(choice)}
                  disabled={!!selectedChoice}
                  className={`w-full text-left px-4 py-3 rounded-xl text-sm transition-all duration-300 ${
                    selectedChoice === choice
                      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-[1.02]"
                      : selectedChoice
                      ? "bg-white/3 text-white/30 cursor-not-allowed"
                      : "bg-white/5 text-white/80 hover:bg-white/10 hover:scale-[1.01] border border-white/10 hover:border-white/20"
                  }`}
                  style={{ animationDelay: `${i * 100}ms` }}
                >
                  <span className="flex items-center gap-3">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                      selectedChoice === choice
                        ? "bg-white/20 text-white"
                        : "bg-white/10 text-white/50"
                    }`}>
                      {String.fromCharCode(65 + i)}
                    </span>
                    {choice}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Agent reaction */}
          {(reactionLoading || agentReaction) && (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
              <div className="flex items-start gap-3">
                <div
                  className={`w-9 h-9 rounded-full bg-linear-to-br ${gradient} flex items-center justify-center text-white font-bold text-xs shadow-lg shrink-0`}
                >
                  {getInitials(agent.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-white text-sm">
                      {agent.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {agent.role}
                    </span>
                  </div>
                  {reactionLoading ? (
                    <div className="flex gap-1 py-1">
                      <span className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  ) : (
                    <p className="text-sm text-white/70 leading-relaxed">
                      {agentReaction}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Next step button */}
          {agentReaction && !reactionLoading && (
            <div className="flex justify-end pt-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <button
                onClick={confirmStep}
                className="flex items-center gap-2 px-6 py-2.5 bg-primary hover:bg-primary/90 rounded-xl text-sm font-semibold text-primary-foreground transition-all shadow-lg shadow-primary/20"
              >
                {currentStep < 5 ? (
                  <>
                    <MessageCircle className="w-4 h-4" />
                    Question suivante
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Terminer l&apos;afterwork
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ─── STEP 6: FINALIZE ────────────────────────── */}
      {currentStep === 6 && !onboardingComplete && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
          {/* Recap of all choices */}
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Wine className="w-5 h-5 text-amber-400" />
              Récap de la soirée
            </h2>
            {stepResults.map((r, i) => (
              <div
                key={i}
                className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-500"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{STEP_THEMES[i].emoji}</span>
                  <span className="font-semibold text-white text-sm">{r.theme}</span>
                </div>
                <p className="text-sm text-primary/80 pl-8">→ {r.playerChoice}</p>
                <p className="text-sm text-white/50 pl-8 italic">{r.agentReaction}</p>
              </div>
            ))}
          </div>

          {/* Eve outro */}
          <div className="bg-linear-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-2xl p-5">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-linear-to-br from-pink-500 to-rose-600 flex items-center justify-center text-white font-bold text-xs shadow-lg shrink-0">
                E
              </div>
              <div>
                <span className="font-semibold text-white text-sm">Eve</span>
                <p className="text-sm text-white/60 mt-1">
                  Bon, l&apos;afterwork est terminé et je crois qu&apos;on a appris pas mal de trucs sur {agent.name}.
                  {" "}{agent.gender === "femme" ? "Elle" : "Il"} a l&apos;air d&apos;être quelqu&apos;un de bien. On l&apos;active dans l&apos;équipe ?
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-center pt-2">
            <button
              onClick={finalizeOnboarding}
              disabled={finalizing}
              className="flex items-center gap-2 px-8 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-xl text-sm font-bold text-white transition-all shadow-lg shadow-emerald-500/20"
            >
              {finalizing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Activation en cours…
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Activer {agent.name}
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
