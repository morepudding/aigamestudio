"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Dices,
  Loader2,
  Sparkles,
  RefreshCw,
  Check,
  FileCode2,
  Building2,
} from "lucide-react";
import type {
  Department,
  Gender,
  PersonalityTrait,
  PersonalityMix,
  AppearanceFemme,
  AppearanceHomme,
  AgentDraft,
} from "@/lib/types/agent";
import {
  departments,
  genders,
  personalities,
  appearanceOptions,
  hairColors,
  eyeColors,
  morphologyEmojis,
  styleEmojis,
  barbeEmojis,
  traitEmojis,
  piercingEmplacements,
  ethnies,
  ethnicColors,
  ageRanges,
} from "@/lib/wizard-data";
import { projects } from "@/lib/data/projects";

// ─── AI Comment Bubble ──────────────────────────────────────
function AiComment({ comment, loading }: { comment: string; loading: boolean }) {
  if (!comment && !loading) return null;
  return (
    <div className="flex items-start gap-3 mb-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="w-8 h-8 rounded-full bg-linear-to-br from-violet-500 to-pink-500 flex items-center justify-center shrink-0 shadow-lg shadow-violet-500/20">
        <Sparkles className="w-4 h-4 text-white" />
      </div>
      <div className="bg-white/5 border border-white/10 rounded-2xl rounded-tl-sm px-4 py-3 max-w-md">
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>réfléchit...</span>
          </div>
        ) : (
          <p className="text-sm text-white/80 leading-relaxed">{comment}</p>
        )}
      </div>
    </div>
  );
}

// ─── Personality Roulette ────────────────────────────────────
function PersonalityRoulette({
  mix,
  onReroll,
  spinning,
}: {
  mix: PersonalityMix;
  onReroll: () => void;
  spinning: boolean;
}) {
  const primary = personalities.find((p) => p.id === mix.primary)!;
  const nuance = personalities.find((p) => p.id === mix.nuance)!;
  const extras = mix.extras.map((id) => personalities.find((p) => p.id === id)!);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Primary */}
        <div
          className={`relative bg-white/5 border-2 border-primary/50 rounded-2xl p-6 text-center transition-all ${
            spinning ? "animate-pulse scale-95" : "scale-100"
          }`}
        >
          <div className="text-xs uppercase tracking-wider text-primary mb-2 font-semibold">
            Dominante
          </div>
          <div className="text-4xl mb-2">{primary.emoji}</div>
          <div className="text-lg font-bold text-white">{primary.label}</div>
          <div className="text-xs text-muted-foreground mt-1">
            {primary.description}
          </div>
        </div>
        {/* Nuance */}
        <div
          className={`relative bg-white/5 border border-white/20 rounded-2xl p-6 text-center transition-all ${
            spinning ? "animate-pulse scale-95" : "scale-100"
          }`}
        >
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2 font-semibold">
            Nuance
          </div>
          <div className="text-4xl mb-2">{nuance.emoji}</div>
          <div className="text-lg font-bold text-white">{nuance.label}</div>
          <div className="text-xs text-muted-foreground mt-1">
            {nuance.description}
          </div>
        </div>
      </div>
      {/* Extras */}
      <div className="grid grid-cols-2 gap-3">
        {extras.map((trait) => (
          <div
            key={trait.id}
            className={`bg-white/3 border border-white/10 rounded-xl p-4 text-center transition-all ${
              spinning ? "animate-pulse scale-95" : "scale-100"
            }`}
          >
            <div className="text-2xl mb-1">{trait.emoji}</div>
            <div className="text-sm font-semibold text-white/80">{trait.label}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{trait.description}</div>
          </div>
        ))}
      </div>
      <button
        onClick={onReroll}
        disabled={spinning}
        className="mx-auto flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-medium text-white transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
      >
        <Dices className={`w-4 h-4 ${spinning ? "animate-spin" : ""}`} />
        Re-roll la roulette
      </button>
    </div>
  );
}

// ─── Option Grid ─────────────────────────────────────────────
function OptionGrid<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T | "";
  onChange: (v: T) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-muted-foreground">{label}</label>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              value === opt.value
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                : "bg-white/5 text-white/70 hover:bg-white/10 border border-white/10"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Main Wizard ─────────────────────────────────────────────
const STEPS = [
  "Département",
  "Genre",
  "Personnalité",
  "Apparence",
  "Résumé",
] as const;

export default function RecruterPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [aiComment, setAiComment] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  // Draft state
  const [department, setDepartment] = useState<Department | "">("");
  const [gender, setGender] = useState<Gender | "">("");
  const [personalityMix, setPersonalityMix] = useState<PersonalityMix>(
    () => rollPersonality()
  );
  const [spinning, setSpinning] = useState(false);
  const [personalityBio, setPersonalityBio] = useState("");
  const [bioLoading, setBioLoading] = useState(false);
  const [appearanceFemme, setAppearanceFemme] = useState<AppearanceFemme>({
    cheveux: "",
    yeux: "",
    morphologie: "",
    taille: "",
    style: "",
    traitDistinctif: "",
    piercingEmplacement: "",
    ethnie: "",
    age: "",
  });
  const [appearanceHomme, setAppearanceHomme] = useState<AppearanceHomme>({
    cheveux: "",
    morphologie: "",
    style: "",
    barbe: "",
    traitDistinctif: "",
    piercingEmplacement: "",
    ethnie: "",
    age: "",
  });

  // Summary step
  const [generatedName, setGeneratedName] = useState({ firstName: "", lastName: "" });
  const [generatedSummary, setGeneratedSummary] = useState("");
  const [nameLoading, setNameLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [generatedPath, setGeneratedPath] = useState("");

  // Assignment state
  const [assignedProject, setAssignedProject] = useState<string>("");
  const [isStudioAssignment, setIsStudioAssignment] = useState(false);

  const appearance = gender === "femme" ? appearanceFemme : appearanceHomme;

  // ── Fetch AI comment ─────────────────────────────────────
  const fetchComment = useCallback(async (context: string, stepName: string) => {
    setAiLoading(true);
    setAiComment("");
    try {
      const res = await fetch("/api/ai/comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context, step: stepName }),
      });
      if (res.ok) {
        const data = await res.json();
        setAiComment(data.comment || "");
      }
    } catch {
      // Silent fail — comment is optional
    } finally {
      setAiLoading(false);
    }
  }, []);

  const fetchPersonalityBio = useCallback(async (mix: PersonalityMix, dept: string) => {
    const { personalities } = await import("@/lib/wizard-data");
    const traits = [
      { trait: mix.primary, label: personalities.find((p) => p.id === mix.primary)?.label ?? mix.primary, emoji: personalities.find((p) => p.id === mix.primary)?.emoji ?? "✦", role: "primary" as const },
      { trait: mix.nuance, label: personalities.find((p) => p.id === mix.nuance)?.label ?? mix.nuance, emoji: personalities.find((p) => p.id === mix.nuance)?.emoji ?? "✦", role: "nuance" as const },
      ...mix.extras.map((id) => ({ trait: id, label: personalities.find((p) => p.id === id)?.label ?? id, emoji: personalities.find((p) => p.id === id)?.emoji ?? "✦", role: "secondary" as const })),
    ];
    setBioLoading(true);
    setPersonalityBio("");
    try {
      const res = await fetch("/api/ai/personality-phrases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ department: dept, traits }),
      });
      if (res.ok) {
        const data = await res.json();
        setPersonalityBio(data.bio ?? "");
      }
    } catch {
      // silent fail
    } finally {
      setBioLoading(false);
    }
  }, []);

  // ── Roll personality ─────────────────────────────────────
  function rollPersonality(): PersonalityMix {
    const shuffled = [...personalities].sort(() => Math.random() - 0.5);
    return { primary: shuffled[0].id, nuance: shuffled[1].id, extras: [shuffled[2].id, shuffled[3].id] };
  }

  const handleReroll = () => {
    setSpinning(true);
    setTimeout(() => {
      const newMix = rollPersonality();
      setPersonalityMix(newMix);
      setSpinning(false);
      // portrait généré à la validation du combo, pas au re-roll
    }, 600);
  };

  // ── Generate name ────────────────────────────────────────
  const generateName = useCallback(async () => {
    setNameLoading(true);
    try {
      const res = await fetch("/api/ai/generate-name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          department,
          gender,
          personality: personalityMix,
          appearance,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setGeneratedName({
          firstName: data.firstName || "Agent",
          lastName: data.lastName || "Inconnu",
        });
        setGeneratedSummary(data.summary || "");
      } else {
        setGeneratedName({ firstName: "Agent", lastName: "X" });
        setGeneratedSummary("Un mystérieux collaborateur...");
      }
    } catch {
      setGeneratedName({ firstName: "Agent", lastName: "X" });
      setGeneratedSummary("Un mystérieux collaborateur...");
    } finally {
      setNameLoading(false);
    }
  }, [department, gender, personalityMix, appearance]);

  // ── Generate agent files ─────────────────────────────────
  const generateAgent = async () => {
    setGenerating(true);
    try {
      const fullName = `${generatedName.firstName} ${generatedName.lastName}`;
      const res = await fetch("/api/ai/generate-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draft: {
            department,
            gender,
            personality: personalityMix,
            appearance,
            name: fullName,
            assignedProject: isStudioAssignment ? "studio" : assignedProject,
          },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setGenerated(true);
        setGeneratedPath(data.agentSlug || "");
      }
    } catch {
      // error handling
    } finally {
      setGenerating(false);
    }
  };

  // ── Step navigation ──────────────────────────────────────
  const canNext = () => {
    switch (step) {
      case 0: return department !== "";
      case 1: return gender !== "";
      case 2: return true; // personality is always set
      case 3: {
        if (gender === "femme") {
          const a = appearanceFemme;
          return a.cheveux && a.yeux && a.morphologie && a.taille && a.style && a.ethnie && a.age;
        }
        const a = appearanceHomme;
        return a.cheveux && a.morphologie && a.style && a.barbe && a.ethnie && a.age;
      }
      case 4: return generatedName.firstName !== "" && (isStudioAssignment || assignedProject !== "");
      default: return false;
    }
  };

  const goNext = () => {
    if (step < STEPS.length - 1) {
      const nextStep = step + 1;
      setStep(nextStep);

      // Trigger AI comment based on what was just selected
      const dept = departments.find((d) => d.id === department);
      const gen = genders.find((g) => g.id === gender);
      const prim = personalities.find((p) => p.id === personalityMix.primary);
      const nuan = personalities.find((p) => p.id === personalityMix.nuance);

      let ctx = "";
      switch (step) {
        case 0:
          ctx = `L'utilisateur a choisi le département : ${dept?.label}`;
          break;
        case 1:
          ctx = `L'utilisateur recrute un collaborateur ${gen?.label} pour le département ${dept?.label}`;
          break;
        case 2:
          ctx = `Le collaborateur aura une personnalité ${prim?.label} avec une nuance de ${nuan?.label}. C'est ${gender === "femme" ? "une femme" : "un homme"} du département ${dept?.label}`;
          break;
        case 3:
          ctx = `Voici l'apparence choisie : ${Object.entries(appearance).map(([k, v]) => `${k}: ${v}`).join(", ")}. Personnalité ${prim?.label} / ${nuan?.label}, département ${dept?.label}`;
          break;
      }
      if (ctx) {
        fetchComment(ctx, STEPS[nextStep]);
      }

      // Auto-generate name on reaching summary step
      if (nextStep === 4) {
        generateName();
      }

      // Génère le portrait à la validation du combo de personnalité (quand on quitte l'étape 2)
      if (step === 2 && department) {
        fetchPersonalityBio(personalityMix, department);
      }
    }
  };

  const goBack = () => {
    if (step > 0) {
      setStep(step - 1);
      setAiComment("");
    }
  };

  // ── Render steps ─────────────────────────────────────────
  const renderStep = () => {
    switch (step) {
      // ─── DÉPARTEMENT ──────────────────────────────────────
      case 0:
        return (
          <div className="space-y-4">
            <div>
              <h2 className="text-2xl font-bold text-white mb-1">
                Choisir un département
              </h2>
              <p className="text-muted-foreground text-sm">
                Dans quel pôle ce collaborateur va-t-il travailler ?
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {departments.map((dept) => (
                <button
                  key={dept.id}
                  onClick={() => setDepartment(dept.id)}
                  className={`flex items-start gap-4 p-4 rounded-xl text-left transition-all ${
                    department === dept.id
                      ? "bg-primary/10 border-2 border-primary shadow-lg shadow-primary/10"
                      : "bg-white/5 border border-white/10 hover:bg-white/10"
                  }`}
                >
                  <span className="text-2xl">{dept.emoji}</span>
                  <div>
                    <div className="font-semibold text-white text-sm">
                      {dept.label}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {dept.description}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        );

      // ─── GENRE ────────────────────────────────────────────
      case 1:
        return (
          <div className="space-y-4">
            <div>
              <h2 className="text-2xl font-bold text-white mb-1">
                Choisir le genre
              </h2>
              <p className="text-muted-foreground text-sm">
                Cela influencera les options d&apos;apparence physique.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4 max-w-md">
              {genders.map((g) => (
                <button
                  key={g.id}
                  onClick={() => setGender(g.id)}
                  className={`flex flex-col items-center gap-3 p-8 rounded-2xl transition-all ${
                    gender === g.id
                      ? "bg-primary/10 border-2 border-primary shadow-lg shadow-primary/10 scale-105"
                      : "bg-white/5 border border-white/10 hover:bg-white/10 hover:scale-102"
                  }`}
                >
                  <span className="text-5xl">{g.emoji}</span>
                  <span className="font-semibold text-white text-lg">{g.label}</span>
                </button>
              ))}
            </div>
          </div>
        );

      // ─── PERSONNALITÉ ─────────────────────────────────────
      case 2:
        return (
          <div className="space-y-4">
            <div>
              <h2 className="text-2xl font-bold text-white mb-1">
                Roulette de personnalité
              </h2>
              <p className="text-muted-foreground text-sm">
                Le destin a parlé ! Re-roll si tu n&apos;es pas satisfait.
              </p>
            </div>
            <PersonalityRoulette
              mix={personalityMix}
              onReroll={handleReroll}
              spinning={spinning}
            />
          </div>
        );

      // ─── APPARENCE ────────────────────────────────────────
      case 3:
        return (
          <div className="space-y-5">
            {/* Portrait psychologique — généré à la validation du combo */}
            {(bioLoading || personalityBio) && (
              <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-5 space-y-3">
                <p className="text-[10px] uppercase tracking-widest text-violet-400/70 font-semibold">
                  ✦ Portrait psychologique
                </p>
                {bioLoading ? (
                  <div className="space-y-2 animate-pulse">
                    <div className="h-2.5 bg-white/10 rounded w-full" />
                    <div className="h-2.5 bg-white/10 rounded w-5/6" />
                    <div className="h-2.5 bg-white/10 rounded w-full" />
                    <div className="h-2.5 bg-white/10 rounded w-4/5" />
                  </div>
                ) : (
                  <div className="space-y-3">
                    {personalityBio.split(/\n+/).filter(Boolean).map((para, i) => (
                      <p key={i} className="text-sm text-muted-foreground leading-relaxed">{para}</p>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white mb-1">
                  Apparence physique
                </h2>
                <p className="text-muted-foreground text-sm">
                  Ces choix serviront à générer le portrait IA du collaborateur.
                </p>
              </div>
              <button
                onClick={() => {
                  const randomPick = <T,>(arr: readonly { value: T }[]) =>
                    arr[Math.floor(Math.random() * arr.length)].value;
                  if (gender === "femme") {
                    const trait = randomPick(appearanceOptions.femme.traitDistinctif) as string;
                    setAppearanceFemme({
                      cheveux: randomPick(appearanceOptions.femme.cheveux) as string,
                      yeux: randomPick(appearanceOptions.femme.yeux) as string,
                      morphologie: randomPick(appearanceOptions.femme.morphologie) as string,
                      taille: randomPick(appearanceOptions.femme.taille) as string,
                      style: randomPick(appearanceOptions.femme.style) as string,
                      traitDistinctif: trait,
                      piercingEmplacement: trait === "piercings" ? piercingEmplacements[Math.floor(Math.random() * piercingEmplacements.length)].value : "",
                      ethnie: ethnies[Math.floor(Math.random() * ethnies.length)].value,
                      age: ageRanges[Math.floor(Math.random() * ageRanges.length)].value,
                    });
                  } else {
                    const trait = randomPick(appearanceOptions.femme.traitDistinctif) as string;
                    setAppearanceHomme({
                      cheveux: randomPick(appearanceOptions.homme.cheveux) as string,
                      morphologie: randomPick(appearanceOptions.homme.morphologie) as string,
                      style: randomPick(appearanceOptions.homme.style) as string,
                      barbe: randomPick(appearanceOptions.homme.barbe) as string,
                      traitDistinctif: trait,
                      piercingEmplacement: trait === "piercings" ? piercingEmplacements[Math.floor(Math.random() * piercingEmplacements.length)].value : "",
                      ethnie: ethnies[Math.floor(Math.random() * ethnies.length)].value,
                      age: ageRanges[Math.floor(Math.random() * ageRanges.length)].value,
                    });
                  }
                }}
                className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-medium text-white transition-all hover:scale-105 active:scale-95"
              >
                <Dices className="w-3.5 h-3.5" />
                Random
              </button>
            </div>

            {gender === "femme" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Hair */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Cheveux</label>
                  <div className="flex flex-wrap gap-1.5">
                    {[...appearanceOptions.femme.cheveux].map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setAppearanceFemme((p) => ({ ...p, cheveux: opt.value }))}
                        title={opt.label}
                        className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-110 ${
                          appearanceFemme.cheveux === opt.value
                            ? "border-primary scale-110 shadow-lg shadow-primary/30"
                            : "border-white/10"
                        }`}
                        style={{ backgroundColor: hairColors[opt.value] || "#666" }}
                      />
                    ))}
                  </div>
                  {appearanceFemme.cheveux && (
                    <span className="text-[10px] text-white/50">{[...appearanceOptions.femme.cheveux].find(o => o.value === appearanceFemme.cheveux)?.label}</span>
                  )}
                </div>

                {/* Eyes */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Yeux</label>
                  <div className="flex flex-wrap gap-1.5">
                    {[...appearanceOptions.femme.yeux].map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setAppearanceFemme((p) => ({ ...p, yeux: opt.value }))}
                        title={opt.label}
                        className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-110 ${
                          appearanceFemme.yeux === opt.value
                            ? "border-primary scale-110 shadow-lg shadow-primary/30"
                            : "border-white/10"
                        }`}
                        style={{ backgroundColor: eyeColors[opt.value] || "#666" }}
                      />
                    ))}
                  </div>
                  {appearanceFemme.yeux && (
                    <span className="text-[10px] text-white/50">{[...appearanceOptions.femme.yeux].find(o => o.value === appearanceFemme.yeux)?.label}</span>
                  )}
                </div>

                {/* Morphology */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Morphologie</label>
                  <div className="flex flex-wrap gap-1.5">
                    {[...appearanceOptions.femme.morphologie].map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setAppearanceFemme((p) => ({ ...p, morphologie: opt.value }))}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all ${
                          appearanceFemme.morphologie === opt.value
                            ? "bg-primary/20 border border-primary text-white"
                            : "bg-white/5 border border-white/10 text-white/60 hover:bg-white/10"
                        }`}
                      >
                        <span>{morphologyEmojis[opt.value] || ""}</span>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Height */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Taille</label>
                  <div className="flex gap-1.5">
                    {[...appearanceOptions.femme.taille].map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setAppearanceFemme((p) => ({ ...p, taille: opt.value }))}
                        className={`flex-1 py-2 rounded-lg text-xs font-medium text-center transition-all ${
                          appearanceFemme.taille === opt.value
                            ? "bg-primary/20 border border-primary text-white"
                            : "bg-white/5 border border-white/10 text-white/60 hover:bg-white/10"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Style */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Style</label>
                  <div className="flex flex-wrap gap-1.5">
                    {[...appearanceOptions.femme.style].map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setAppearanceFemme((p) => ({ ...p, style: opt.value }))}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all ${
                          appearanceFemme.style === opt.value
                            ? "bg-primary/20 border border-primary text-white"
                            : "bg-white/5 border border-white/10 text-white/60 hover:bg-white/10"
                        }`}
                      >
                        <span>{styleEmojis[opt.value] || ""}</span>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Trait distinctif */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Trait distinctif</label>
                  <div className="flex flex-wrap gap-1.5">
                    {[...appearanceOptions.femme.traitDistinctif].map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setAppearanceFemme((p) => ({
                          ...p,
                          traitDistinctif: opt.value,
                          piercingEmplacement: opt.value !== "piercings" ? "" : p.piercingEmplacement,
                        }))}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all ${
                          appearanceFemme.traitDistinctif === opt.value
                            ? "bg-primary/20 border border-primary text-white"
                            : "bg-white/5 border border-white/10 text-white/60 hover:bg-white/10"
                        }`}
                      >
                        <span>{traitEmojis[opt.value] || ""}</span>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  {appearanceFemme.traitDistinctif === "piercings" && (
                    <div className="mt-2 pl-1 space-y-1.5">
                      <p className="text-[10px] text-white/40 uppercase tracking-wider">Emplacement</p>
                      <div className="flex flex-wrap gap-1.5">
                        {[...piercingEmplacements].map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() => setAppearanceFemme((p) => ({ ...p, piercingEmplacement: opt.value }))}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all ${
                              appearanceFemme.piercingEmplacement === opt.value
                                ? "bg-primary/20 border border-primary text-white"
                                : "bg-white/5 border border-white/10 text-white/60 hover:bg-white/10"
                            }`}
                          >
                            <span>{opt.emoji}</span>
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Ethnie */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Origine / Ethnie</label>
                  <div className="flex flex-wrap gap-1.5">
                    {[...ethnies].map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setAppearanceFemme((p) => ({ ...p, ethnie: opt.value }))}
                        title={opt.label}
                        className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-110 ${
                          appearanceFemme.ethnie === opt.value
                            ? "border-primary scale-110 shadow-lg shadow-primary/30"
                            : "border-white/10"
                        }`}
                        style={{ backgroundColor: ethnicColors[opt.value] || "#666" }}
                      />
                    ))}
                  </div>
                  {appearanceFemme.ethnie && (
                    <span className="text-[10px] text-white/50">{ethnies.find(o => o.value === appearanceFemme.ethnie)?.label}</span>
                  )}
                </div>

                {/* Âge */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tranche d&apos;âge</label>
                  <div className="flex gap-1.5">
                    {[...ageRanges].map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setAppearanceFemme((p) => ({ ...p, age: opt.value }))}
                        className={`flex-1 py-2 rounded-lg text-xs font-medium text-center transition-all ${
                          appearanceFemme.age === opt.value
                            ? "bg-primary/20 border border-primary text-white"
                            : "bg-white/5 border border-white/10 text-white/60 hover:bg-white/10"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Hair */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Cheveux</label>
                  <div className="flex flex-wrap gap-1.5">
                    {[...appearanceOptions.homme.cheveux].map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setAppearanceHomme((p) => ({ ...p, cheveux: opt.value }))}
                        title={opt.label}
                        className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-110 ${
                          appearanceHomme.cheveux === opt.value
                            ? "border-primary scale-110 shadow-lg shadow-primary/30"
                            : "border-white/10"
                        }`}
                        style={{ backgroundColor: hairColors[opt.value] || "#666" }}
                      />
                    ))}
                  </div>
                  {appearanceHomme.cheveux && (
                    <span className="text-[10px] text-white/50">{[...appearanceOptions.homme.cheveux].find(o => o.value === appearanceHomme.cheveux)?.label}</span>
                  )}
                </div>

                {/* Morphology */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Morphologie</label>
                  <div className="flex flex-wrap gap-1.5">
                    {[...appearanceOptions.homme.morphologie].map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setAppearanceHomme((p) => ({ ...p, morphologie: opt.value }))}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all ${
                          appearanceHomme.morphologie === opt.value
                            ? "bg-primary/20 border border-primary text-white"
                            : "bg-white/5 border border-white/10 text-white/60 hover:bg-white/10"
                        }`}
                      >
                        <span>{morphologyEmojis[opt.value] || ""}</span>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Style */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Style</label>
                  <div className="flex flex-wrap gap-1.5">
                    {[...appearanceOptions.homme.style].map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setAppearanceHomme((p) => ({ ...p, style: opt.value }))}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all ${
                          appearanceHomme.style === opt.value
                            ? "bg-primary/20 border border-primary text-white"
                            : "bg-white/5 border border-white/10 text-white/60 hover:bg-white/10"
                        }`}
                      >
                        <span>{styleEmojis[opt.value] || ""}</span>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Barbe */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Barbe</label>
                  <div className="flex flex-wrap gap-1.5">
                    {[...appearanceOptions.homme.barbe].map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setAppearanceHomme((p) => ({ ...p, barbe: opt.value }))}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all ${
                          appearanceHomme.barbe === opt.value
                            ? "bg-primary/20 border border-primary text-white"
                            : "bg-white/5 border border-white/10 text-white/60 hover:bg-white/10"
                        }`}
                      >
                        <span>{barbeEmojis[opt.value] || ""}</span>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Trait distinctif (homme) */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Trait distinctif</label>
                  <div className="flex flex-wrap gap-1.5">
                    {[...appearanceOptions.femme.traitDistinctif].map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setAppearanceHomme((p) => ({
                          ...p,
                          traitDistinctif: opt.value,
                          piercingEmplacement: opt.value !== "piercings" ? "" : p.piercingEmplacement,
                        }))}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all ${
                          appearanceHomme.traitDistinctif === opt.value
                            ? "bg-primary/20 border border-primary text-white"
                            : "bg-white/5 border border-white/10 text-white/60 hover:bg-white/10"
                        }`}
                      >
                        <span>{traitEmojis[opt.value] || ""}</span>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  {appearanceHomme.traitDistinctif === "piercings" && (
                    <div className="mt-2 pl-1 space-y-1.5">
                      <p className="text-[10px] text-white/40 uppercase tracking-wider">Emplacement</p>
                      <div className="flex flex-wrap gap-1.5">
                        {[...piercingEmplacements].map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() => setAppearanceHomme((p) => ({ ...p, piercingEmplacement: opt.value }))}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all ${
                              appearanceHomme.piercingEmplacement === opt.value
                                ? "bg-primary/20 border border-primary text-white"
                                : "bg-white/5 border border-white/10 text-white/60 hover:bg-white/10"
                            }`}
                          >
                            <span>{opt.emoji}</span>
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Ethnie */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Origine / Ethnie</label>
                  <div className="flex flex-wrap gap-1.5">
                    {[...ethnies].map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setAppearanceHomme((p) => ({ ...p, ethnie: opt.value }))}
                        title={opt.label}
                        className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-110 ${
                          appearanceHomme.ethnie === opt.value
                            ? "border-primary scale-110 shadow-lg shadow-primary/30"
                            : "border-white/10"
                        }`}
                        style={{ backgroundColor: ethnicColors[opt.value] || "#666" }}
                      />
                    ))}
                  </div>
                  {appearanceHomme.ethnie && (
                    <span className="text-[10px] text-white/50">{ethnies.find(o => o.value === appearanceHomme.ethnie)?.label}</span>
                  )}
                </div>

                {/* Âge */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tranche d&apos;âge</label>
                  <div className="flex gap-1.5">
                    {[...ageRanges].map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setAppearanceHomme((p) => ({ ...p, age: opt.value }))}
                        className={`flex-1 py-2 rounded-lg text-xs font-medium text-center transition-all ${
                          appearanceHomme.age === opt.value
                            ? "bg-primary/20 border border-primary text-white"
                            : "bg-white/5 border border-white/10 text-white/60 hover:bg-white/10"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        );

      // ─── RÉSUMÉ / GÉNÉRATION ──────────────────────────────
      case 4:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white mb-1">
                Votre nouvel agent
              </h2>
              <p className="text-muted-foreground text-sm">
                L&apos;IA a imaginé un profil. Assignez-le à un cours de l&apos;Université d&apos;Espions.
              </p>
            </div>

            {nameLoading ? (
              <div className="flex items-center gap-3 text-muted-foreground animate-pulse py-12">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Création du profil en cours...</span>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Agent card preview */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-linear-to-br from-violet-500 to-pink-500 flex items-center justify-center text-white font-bold text-xl shadow-lg">
                      {generatedName.firstName[0]}
                      {generatedName.lastName[0]}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white">
                        {generatedName.firstName} {generatedName.lastName}
                      </h3>
                      <p className="text-sm text-primary font-medium">
                        {departments.find((d) => d.id === department)?.label}
                      </p>
                    </div>
                  </div>

                  <p className="text-sm text-white/70 leading-relaxed">
                    {generatedSummary}
                  </p>

                  <div className="flex flex-wrap gap-2 pt-2">
                    <span className="px-2 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                      {personalities.find((p) => p.id === personalityMix.primary)?.emoji}{" "}
                      {personalities.find((p) => p.id === personalityMix.primary)?.label}
                    </span>
                    <span className="px-2 py-1 rounded-full bg-white/5 text-white/60 text-xs font-medium">
                      + {personalities.find((p) => p.id === personalityMix.nuance)?.label}
                    </span>
                    {personalityMix.extras.map((id) => (
                      <span key={id} className="px-2 py-1 rounded-full bg-white/5 text-white/50 text-xs font-medium">
                        {personalities.find((p) => p.id === id)?.emoji}{" "}
                        {personalities.find((p) => p.id === id)?.label}
                      </span>
                    ))}
                    <span className="px-2 py-1 rounded-full bg-white/5 text-white/60 text-xs font-medium">
                      {gender === "femme" ? "♀️" : "♂️"} {gender}
                    </span>
                  </div>
                </div>

                {/* Project assignment */}
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-muted-foreground">
                    Affectation — Cours de l&apos;Université d&apos;Espions
                  </h3>
                  <button
                    onClick={() => {
                      setIsStudioAssignment(!isStudioAssignment);
                      if (!isStudioAssignment) setAssignedProject("");
                    }}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all text-sm ${
                      isStudioAssignment
                        ? "bg-primary/10 border-2 border-primary"
                        : "bg-white/5 border border-white/10 hover:bg-white/10"
                    }`}
                  >
                    <Building2 className="w-5 h-5 text-primary shrink-0" />
                    <div>
                      <div className="font-medium text-white">Direction du Studio</div>
                      <div className="text-xs text-muted-foreground">Rôle transversal — tous les cours</div>
                    </div>
                  </button>
                  {!isStudioAssignment && projects.map((project) => (
                    <button
                      key={project.id}
                      onClick={() => setAssignedProject(project.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all text-sm ${
                        assignedProject === project.id
                          ? "bg-primary/10 border-2 border-primary"
                          : "bg-white/5 border border-white/10 hover:bg-white/10"
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg bg-linear-to-br ${project.coverGradient} shrink-0`} />
                      <div>
                        <div className="font-medium text-white">{project.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {project.courseInfo ? project.courseInfo.courseName : project.genre}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={generateName}
                    disabled={nameLoading}
                    className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-medium text-white transition-all"
                  >
                    <RefreshCw className={`w-4 h-4 ${nameLoading ? "animate-spin" : ""}`} />
                    Régénérer
                  </button>

                  {!generated ? (
                    <button
                      onClick={generateAgent}
                      disabled={generating || nameLoading || !generatedName.firstName}
                      className="flex items-center gap-2 px-6 py-2.5 bg-linear-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 rounded-xl text-sm font-bold text-white transition-all shadow-lg shadow-violet-500/20 hover:shadow-violet-500/40 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {generating ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Génération...
                        </>
                      ) : (
                        <>
                          <FileCode2 className="w-4 h-4" />
                          Créer l&apos;agent CrewAI
                        </>
                      )}
                    </button>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-sm font-medium text-emerald-400">
                        <Check className="w-4 h-4" />
                        Agent créé !
                      </div>
                      <button
                        onClick={() => router.push(`/collaborateur/${generatedPath}`)}
                        className="flex items-center gap-2 px-6 py-2.5 bg-linear-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 rounded-xl text-sm font-bold text-white transition-all shadow-lg shadow-violet-500/20 hover:shadow-violet-500/40"
                      >
                        <Sparkles className="w-4 h-4" />
                        Voir le collaborateur
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => step === 0 ? router.push("/collaborateur") : goBack()}
          className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white transition-all hover:scale-105"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Recruter un agent
          </h1>
          <p className="text-muted-foreground text-sm">
            Étape {step + 1} sur {STEPS.length} — {STEPS[step]}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-white/5 rounded-full overflow-hidden">
        <div
          className="h-full bg-linear-to-r from-primary to-pink-500 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
        />
      </div>

      {/* AI Comment */}
      <AiComment comment={aiComment} loading={aiLoading} />

      {/* Step content */}
      <div className="min-h-100">{renderStep()}</div>

      {/* Navigation */}
      {step < 4 && (
        <div className="flex justify-end pt-4 border-t border-white/5">
          <button
            onClick={goNext}
            disabled={!canNext()}
            className="flex items-center gap-2 px-6 py-2.5 bg-primary hover:bg-primary/90 rounded-xl text-sm font-semibold text-primary-foreground transition-all shadow-lg shadow-primary/20 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Suivant
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* After generation — go back to collaborateurs */}
      {generated && (
        <div className="flex justify-center pt-4">
          <button
            onClick={() => router.push("/collaborateur")}
            className="flex items-center gap-2 px-6 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-medium text-white transition-all"
          >
            Retour aux collaborateurs
          </button>
        </div>
      )}
    </div>
  );
}
