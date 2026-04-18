"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  BookOpen,
  Sparkles,
  User,
  FolderKanban,
  RefreshCw,
  Loader2,
  MessageCircle,
  Brain,
  Heart,
  Image as ImageIcon,
  Lightbulb,
  TrendingUp,
  Users,
  Tag,
  Shield,
  Trash2,
  ChevronRight,
} from "lucide-react";
import { projects } from "@/lib/data/projects";
import { departments, personalities } from "@/lib/wizard-data";
import { parsePersonalityTraits } from "@/lib/types/agent";
import { getAgentMemories, type AgentMemory, type MemoryType } from "@/lib/services/memoryService";
import { MoodRing, type Mood } from "@/components/ui/MoodRing";
import { ConfidenceGauge } from "@/components/ui/ConfidenceGauge";

interface Task {
  task_name?: string;
  description?: string;
  expected_output?: string;
}

interface AgentDetail {
  slug: string;
  name: string;
  role: string;
  goal: string;
  backstory: string;
  appearance_prompt: string;
  department: string;
  gender: string;
  personality_primary: string;
  personality_nuance: string;
  personality_extras: string | null;
  status: string;
  assigned_project: string;
  tasks: Task[];
  portrait_url: string | null;
  icon_url: string | null;
  mood: string | null;
  mood_cause: string | null;
  confidence_level: number | null;
  personality_bio: string | null;
}



const memoryTypeConfig: Record<MemoryType, { icon: React.ElementType; label: string; color: string }> = {
  summary: { icon: Brain, label: "Résumé", color: "text-violet-400" },
  preference: { icon: Heart, label: "Préférences", color: "text-pink-400" },
  decision: { icon: Lightbulb, label: "Décisions", color: "text-amber-400" },
  progress: { icon: TrendingUp, label: "Progression", color: "text-emerald-400" },
  relationship: { icon: Users, label: "Relations", color: "text-blue-400" },
  nickname: { icon: Tag, label: "Surnoms", color: "text-cyan-400" },
  confidence: { icon: Shield, label: "Confiance", color: "text-rose-400" },
  boss_profile: { icon: Brain, label: "Profil boss", color: "text-indigo-400" },
  family: { icon: Users, label: "Famille", color: "text-fuchsia-400" },
  hobbies: { icon: Heart, label: "Hobbies", color: "text-orange-400" },
  dreams: { icon: Sparkles, label: "Rêves", color: "text-sky-400" },
  social: { icon: Users, label: "Vie sociale", color: "text-lime-400" },
  fears: { icon: Shield, label: "Peurs", color: "text-red-400" },
  personal_event: { icon: Lightbulb, label: "Événements personnels", color: "text-teal-400" },
  topic_tracker: { icon: Tag, label: "Sujets suivis", color: "text-amber-300" },
};

const defaultMemoryTypeConfig = {
  icon: Brain,
  label: "Autre",
  color: "text-muted-foreground",
} as const;

function prettyMemoryTypeLabel(type: string) {
  return type
    .split("_")
    .join(" ")
    .replace(/^./, (c) => c.toUpperCase());
}

const moodDisplay: Record<string, { emoji: string; label: string; color: string; bg: string }> = {
  neutre: { emoji: "😐", label: "Neutre", color: "text-gray-400", bg: "bg-gray-500/10 border-gray-500/20" },
  enthousiaste: { emoji: "🤩", label: "Enthousiaste", color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20" },
  "frustré": { emoji: "😤", label: "Frustré", color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
  curieux: { emoji: "🤔", label: "Curieux", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
  fier: { emoji: "😎", label: "Fier", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
  inquiet: { emoji: "😟", label: "Inquiet", color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20" },
  joueur: { emoji: "😏", label: "Joueur", color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20" },
  nostalgique: { emoji: "🥹", label: "Nostalgique", color: "text-pink-400", bg: "bg-pink-500/10 border-pink-500/20" },
  "inspiré": { emoji: "✨", label: "Inspiré", color: "text-cyan-400", bg: "bg-cyan-500/10 border-cyan-500/20" },
  "agacé": { emoji: "😒", label: "Agacé", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
};

const statusConfig: Record<string, { label: string; color: string }> = {
  "recruté": { label: "Recruté", color: "bg-amber-500/10 text-amber-400 border-amber-500/30" },
  actif: { label: "Actif", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
};

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

/** Badge shown on every section that is directly injected into the AI system prompt */
function AiImpactBadge({ label = "Injecté dans le prompt" }: { label?: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-500/15 border border-violet-500/30 text-violet-300 text-[10px] font-semibold uppercase tracking-wider select-none"
      title="Cette donnée est injectée dans le system prompt et influence directement les messages de l'agent"
    >
      ⚡ {label}
    </span>
  );
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const evePhysicalProfile = [
  {
    label: "Silhouette",
    value: "grande, fine, un peu feline, avec une presence discrete mais magnetique.",
  },
  {
    label: "Visage",
    value: "traits anguleux et elegants, pommettes marquees, machoire douce mais nette.",
  },
  {
    label: "Regard",
    value: "yeux sombres, tres expressifs, avec un melange de fragilite et de defi.",
  },
  {
    label: "Sourcils",
    value: "bien dessines, donnant un air intense meme au repos.",
  },
  {
    label: "Cheveux",
    value: "longs, noirs, lisses (ou legerement ondules), souvent portes de facon naturelle.",
  },
  {
    label: "Teint",
    value: "clair, contraste fort avec les cheveux fonces.",
  },
  {
    label: "Bouche",
    value: "levres definies, souvent en expression neutre ou ironique.",
  },
  {
    label: "Style global",
    value: "edgy/boheme sombre, maquillage leger mais accent sur les yeux, vibe mysterieuse, lucide, un peu rebelle.",
  },
] as const;

export default function AgentDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [agent, setAgent] = useState<AgentDetail | null>(null);
  const [memories, setMemories] = useState<AgentMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [regenerating, setRegenerating] = useState<"portrait" | "icon" | "both" | null>(null);
  const [imageVersion, setImageVersion] = useState(() => Date.now());
  const [regenerationError, setRegenerationError] = useState<string | null>(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [personalityBio, setPersonalityBio] = useState("");
  const [phrasesLoading, setPhrasesLoading] = useState(false);
  const [backstoryExpanded, setBackstoryExpanded] = useState(false);


  useEffect(() => {
    if (!slug) return;

    setLoading(true);
    setNotFound(false);

    Promise.all([
      fetch(`/api/agents/${slug}`).then((res) => {
        if (!res.ok) throw new Error("not found");
        return res.json();
      }),
      getAgentMemories(slug),
    ])
      .then(([agentData, memoriesData]) => {
        setAgent(agentData);
        setMemories(memoriesData);
        setImageVersion(Date.now());
        if (agentData.personality_bio) {
          // Use cached bio — no LLM call needed
          setPersonalityBio(agentData.personality_bio);
        } else {
          // Generate and cache for next time
          fetchPersonalityPhrases(agentData);
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

  const fetchPersonalityPhrases = async (agentData: AgentDetail) => {
    const traits: { trait: string; label: string; emoji: string; role: "primary" | "nuance" | "secondary" }[] = [];

    const addTrait = (field: string | null, role: "primary" | "nuance" | "secondary") => {
      if (!field) return;
      parsePersonalityTraits(field).forEach((traitId) => {
        const match = personalities.find((p) => p.id === traitId);
        if (match) {
          traits.push({ trait: traitId, label: match.label, emoji: match.emoji, role });
        } else {
          traits.push({ trait: traitId, label: traitId.charAt(0).toUpperCase() + traitId.slice(1), emoji: "✦", role });
        }
      });
    };

    addTrait(agentData.personality_primary, "primary");
    addTrait(agentData.personality_nuance, "nuance");
    if (agentData.personality_extras) {
      addTrait(agentData.personality_extras, "secondary");
    }

    if (traits.length === 0) return;

    setPhrasesLoading(true);
    try {
      const res = await fetch("/api/ai/personality-phrases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentName: agentData.name,
          agentRole: agentData.role,
          department: agentData.department,
          traits,
          slug: agentData.slug,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setPersonalityBio(data.bio ?? "");
      }
    } catch {
      // silently fail — UI degrades to badges
    } finally {
      setPhrasesLoading(false);
    }
  };

  const handleRegenerateVisual = async (target: "portrait" | "icon" | "both") => {
    if (!agent || regenerating) return;

    setRegenerationError(null);
    setRegenerating(target);

    try {
      const res = await fetch("/api/ai/generate-avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: agent.slug, target }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : "La régénération a échoué.");
      }

      setAgent((current) => {
        if (!current) return current;

        return {
          ...current,
          portrait_url: typeof data?.portrait === "string" ? data.portrait : current.portrait_url,
          icon_url: typeof data?.icon === "string" ? data.icon : current.icon_url,
        };
      });
      setImageVersion(Date.now());
    } catch (error) {
      setRegenerationError(error instanceof Error ? error.message : "La régénération a échoué.");
    } finally {
      setRegenerating(null);
    }
  };

  const handleResetMemory = async () => {
    if (!agent || resetting) return;
    setResetting(true);
    setResetError(null);
    try {
      const res = await fetch(`/api/agents/${agent.slug}/memory`, { method: "DELETE" });
      if (!res.ok) throw new Error("Échec de la réinitialisation");
      window.location.href = `/collaborateur/${agent.slug}`;
    } catch (error) {
      setResetError(error instanceof Error ? error.message : "Erreur inconnue");
      setResetting(false);
    }
  };

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

  const dept = departments.find((d) => d.id === agent.department);
  const gradient = departmentGradients[agent.department] ?? "from-gray-500 to-gray-600";

  // Build personality badge tokens — handle both known IDs and free-form comma lists
  const personalityBadges: { emoji: string; label: string }[] = [];
  for (const field of [agent.personality_primary, agent.personality_nuance, agent.personality_extras]) {
    if (!field) continue;
    const known = personalities.find((p) => p.id === field);
    if (known) {
      personalityBadges.push({ emoji: known.emoji, label: known.label });
    } else {
      parsePersonalityTraits(field).forEach((trait) => {
        const match = personalities.find((p) => p.id === trait);
        personalityBadges.push(
          match
            ? { emoji: match.emoji, label: match.label }
            : { emoji: "✦", label: trait.charAt(0).toUpperCase() + trait.slice(1) }
        );
      });
    }
  }
  const portraitSrc = agent.portrait_url ? `${agent.portrait_url}${agent.portrait_url.includes('?') ? '&' : '?'}v=${imageVersion}` : null;
  const iconSrc = agent.icon_url ? `${agent.icon_url}${agent.icon_url.includes('?') ? '&' : '?'}v=${imageVersion}` : null;
  const isGeneratingPortrait = regenerating === "portrait" || regenerating === "both";
  const isGeneratingIcon = regenerating === "icon" || regenerating === "both";

  // Group memories by type
  const memoriesByType = memories.reduce<Record<string, AgentMemory[]>>(
    (acc, m) => {
      if (!acc[m.memory_type]) acc[m.memory_type] = [];
      acc[m.memory_type].push(m);
      return acc;
    },
    {}
  );
  const memoryTypes = Object.keys(memoriesByType);

  const mood = agent.mood ? (moodDisplay[agent.mood] ?? moodDisplay.neutre) : null;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Back */}
      <Link
        href="/collaborateur"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Retour aux collaborateurs
      </Link>

      {/* Hero — Tinder style: info left, big portrait right */}
      <div className="relative bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        <div className={`absolute inset-0 bg-linear-to-br ${gradient} opacity-5 pointer-events-none`} />
        <div className="flex flex-col sm:flex-row gap-0">
          {/* Left: info */}
          <div className="flex-1 p-5 md:p-8 flex flex-col justify-between gap-6">
            <div className="space-y-4">
              <div className="space-y-1">
                <h1 className="text-2xl md:text-4xl font-bold text-white">{agent.name}</h1>
                <p className="text-primary font-medium text-lg md:text-xl">{agent.role}</p>
              </div>

              {/* Meta badges — dept, genre, status */}
              <div className="flex flex-wrap gap-2">
                {dept && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-sm text-white">
                    {dept.emoji} {dept.label}
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-sm text-white">
                  <User className="w-3 h-3" />
                  {agent.gender === "femme" ? "Femme" : "Homme"}
                </span>
                {(() => {
                  const sc = statusConfig[agent.status] ?? statusConfig["recruté"];
                  return (
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-sm font-medium ${sc.color}`}>
                      {sc.label}
                    </span>
                  );
                })()}
              </div>

              {/* Personality traits — injectés dans le prompt */}
              {personalityBadges.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50 flex items-center gap-1">
                    <span className="text-violet-400">⚡</span> Personnalité — injecté dans le prompt
                  </p>
                  {/* Trait badges */}
                  <div className="flex flex-wrap gap-1.5">
                    {personalityBadges.map((b, i) => (
                      <span key={i} className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-xs text-violet-300">
                        {b.emoji} {b.label}
                      </span>
                    ))}
                  </div>
                  {/* Bio paragraphs */}
                  {phrasesLoading ? (
                    <div className="space-y-2 animate-pulse">
                      <div className="h-2.5 bg-white/10 rounded w-full" />
                      <div className="h-2.5 bg-white/10 rounded w-5/6" />
                      <div className="h-2.5 bg-white/10 rounded w-full" />
                      <div className="h-2.5 bg-white/10 rounded w-4/5" />
                    </div>
                  ) : personalityBio ? (
                    <div className="space-y-2 border-t border-violet-500/15 pt-2">
                      {personalityBio.split(/\n+/).filter(Boolean).map((para, i) => (
                        <p key={i} className="text-sm text-muted-foreground leading-relaxed italic">{para}</p>
                      ))}
                    </div>
                  ) : null}
                </div>
              )}

              {/* Mood + confiance — injecté dans le prompt */}
              {mood && (
                <div className={`rounded-xl border p-4 ${mood.bg} space-y-4`}>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50 flex items-center gap-1">
                    <span className="text-violet-400">⚡</span> État émotionnel — injecté dans le prompt
                  </p>

                  {/* Mood display with MoodRing */}
                  <div className="flex items-center gap-4">
                    <MoodRing
                      mood={agent.mood as Mood}
                      size="lg"
                      showOnlineIndicator={false}
                    >
                      <span className="text-2xl">{mood.emoji}</span>
                    </MoodRing>
                    <div>
                      <p className={`font-semibold text-lg ${mood.color}`}>{mood.label}</p>
                      {agent.mood_cause && (
                        <p className="text-sm text-muted-foreground">{agent.mood_cause}</p>
                      )}
                    </div>
                  </div>

                  {/* Confidence Gauge */}
                  {(agent.confidence_level ?? 0) > 0 && (
                    <div className="pt-2 border-t border-white/10">
                      <ConfidenceGauge
                        level={agent.confidence_level ?? 0}
                        showTiers={true}
                        animated={true}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* CTA buttons */}
            <div className="flex flex-wrap gap-3">
              <Link
                href={`/chat/${agent.slug}`}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-linear-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 rounded-xl text-sm font-bold text-white transition-all shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40"
              >
                <MessageCircle className="w-4 h-4" />
                Démarrer une conversation
              </Link>
              <Link
                href={`/collaborateur/${agent.slug}/galerie`}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl text-sm font-bold text-white transition-colors"
              >
                <ImageIcon className="w-4 h-4" />
                Galerie photo
              </Link>
            </div>

          </div>

          {/* Right: big portrait */}
          <div className="sm:w-56 lg:w-72 shrink-0">
            {portraitSrc ? (
              <div className="h-full min-h-64 sm:min-h-0">
                <Image
                  src={portraitSrc}
                  alt={agent.name}
                  width={288}
                  height={400}
                  unoptimized
                  className="w-full h-full object-cover object-top sm:rounded-r-2xl"
                />
              </div>
            ) : (
              <div className={`h-full min-h-64 bg-linear-to-br ${gradient} flex items-center justify-center text-white font-bold text-5xl sm:rounded-r-2xl`}>
                {getInitials(agent.name)}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">

          {/* Histoire + Objectif fusionnés */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-1">
              <BookOpen className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold text-white">Histoire</h2>
              <AiImpactBadge />
            </div>
            <p className="text-xs text-muted-foreground/40 italic mb-4">{agent.goal}</p>
            {(() => {
              const paragraphs = agent.backstory.split(/\n+/).filter(Boolean);
              if (agent.slug === "eve") {
                return (
                  <div className="space-y-3">
                    {paragraphs.map((p, i) => (
                      <p key={i} className="text-muted-foreground leading-relaxed">{p}</p>
                    ))}
                  </div>
                );
              }

              const preview = paragraphs.slice(0, 2);
              const rest = paragraphs.slice(2);
              return (
                <div className="space-y-3">
                  {preview.map((p, i) => (
                    <p key={i} className="text-muted-foreground leading-relaxed">{p}</p>
                  ))}
                  {rest.length > 0 && (
                    <>
                      {backstoryExpanded && rest.map((p, i) => (
                        <p key={i} className="text-muted-foreground leading-relaxed">{p}</p>
                      ))}
                      <button
                        type="button"
                        onClick={() => setBackstoryExpanded((v) => !v)}
                        className="flex items-center gap-1.5 text-xs text-primary/70 hover:text-primary transition-colors mt-1"
                      >
                        <ChevronRight className={`w-3.5 h-3.5 transition-transform ${backstoryExpanded ? "rotate-90" : ""}`} />
                        {backstoryExpanded ? "Réduire" : `Lire la suite (${rest.length} paragraphe${rest.length > 1 ? "s" : ""})`}
                      </button>
                    </>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Physique (Eve) */}
          {agent.slug === "eve" && (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <User className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold text-white">Physique</h2>
                <AiImpactBadge label="Reference visuelle" />
              </div>
              <div className="grid gap-2">
                {evePhysicalProfile.map((item) => (
                  <p key={item.label} className="text-sm text-muted-foreground leading-relaxed">
                    <span className="text-white font-medium">{item.label}:</span> {item.value}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Memories */}
          {memoryTypes.length > 0 && (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-5">
                <Brain className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold text-white">Mémoire</h2>
                <AiImpactBadge />
                <span className="ml-auto text-xs text-muted-foreground bg-white/5 border border-white/10 px-2 py-0.5 rounded-full">
                  {memories.length} souvenir{memories.length > 1 ? "s" : ""}
                </span>
              </div>
              <div className="space-y-5">
                {memoryTypes.map((type) => {
                  const cfg = memoryTypeConfig[type as MemoryType] ?? {
                    ...defaultMemoryTypeConfig,
                    label: prettyMemoryTypeLabel(type),
                  };
                  const Icon = cfg.icon;
                  const items = memoriesByType[type];
                  return (
                    <div key={type}>
                      <div className={`flex items-center gap-2 mb-2 ${cfg.color}`}>
                        <Icon className="w-4 h-4" />
                        <span className="text-xs font-semibold uppercase tracking-widest">{cfg.label}</span>
                        <span className="text-xs opacity-60">({items.length})</span>
                      </div>
                      <div className="space-y-2 pl-6 border-l border-white/10">
                        {items.map((mem) => (
                          <p key={mem.id} className="text-sm text-muted-foreground leading-relaxed">
                            {mem.content}
                          </p>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {memoryTypes.length === 0 && (
            <div className="bg-white/5 border border-dashed border-white/10 rounded-2xl p-6 text-center">
              <Brain className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Aucune mémoire enregistrée pour cet agent.</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Les souvenirs apparaîtront après les premières conversations.</p>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-6">

          {/* Visuels — portrait only + bouton unique */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-white">Visuels</h2>
              {regenerating && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Génération…
                </div>
              )}
            </div>

            {/* Portrait principal */}
            {portraitSrc ? (
              <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
                <Image src={portraitSrc} alt={`Portrait de ${agent.name}`} width={320} height={400} unoptimized className="w-full object-cover object-top" />
              </div>
            ) : (
              <div className={`aspect-4/5 rounded-xl bg-linear-to-br ${gradient} flex items-center justify-center text-white text-4xl font-bold`}>
                {getInitials(agent.name)}
              </div>
            )}

            {/* Photo profil compacte */}
            {iconSrc && (
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 overflow-hidden rounded-2xl border border-white/10 bg-white/5 shrink-0">
                  <Image src={iconSrc} alt={`Photo de profil de ${agent.name}`} width={48} height={48} unoptimized className="h-full w-full object-cover" />
                </div>
                <p className="text-xs text-muted-foreground">Photo de profil</p>
              </div>
            )}

            <button
              type="button"
              onClick={() => handleRegenerateVisual("both")}
              disabled={!!regenerating}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {regenerating ? <><Loader2 className="w-4 h-4 animate-spin" />Régénération…</> : <><RefreshCw className="w-4 h-4" />Régénérer les visuels</>}
            </button>

            {regenerationError && <p className="text-sm text-rose-400">{regenerationError}</p>}
          </div>

          {/* Infos essentielles */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Département</span>
              <span className="text-white font-medium">{dept?.label ?? agent.department}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Mémoires</span>
              <span className="text-white font-medium">{memories.length}</span>
            </div>
            {agent.assigned_project && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Assignation</span>
                <span className="text-white font-medium flex items-center gap-1.5">
                  <FolderKanban className="w-3 h-3" />
                  {agent.assigned_project === "studio"
                    ? "Studio / Direction"
                    : projects.find((p) => p.id === agent.assigned_project)?.title ?? agent.assigned_project}
                </span>
              </div>
            )}
          </div>

          {/* Reset memory */}
          <button
            type="button"
            onClick={() => setShowResetModal(true)}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/5 px-4 py-2.5 text-sm font-medium text-rose-400/70 transition-colors hover:border-rose-500/40 hover:text-rose-400 hover:bg-rose-500/10"
          >
            <Trash2 className="w-4 h-4" />
            Réinitialiser la relation
          </button>
        </div>
      </div>

      {/* Reset confirmation modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#0f0f14] border border-white/10 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Réinitialiser la relation</h3>
                <p className="text-xs text-muted-foreground">Cette action est irréversible</p>
              </div>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed">
              Réinitialiser la mémoire de <span className="text-white font-medium">{agent.name}</span> supprimera tous ses souvenirs de toi.
            </p>

            {resetError && (
              <p className="text-sm text-rose-400">{resetError}</p>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => { setShowResetModal(false); setResetError(null); }}
                disabled={resetting}
                className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-sm font-medium text-white hover:bg-white/10 transition-colors disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleResetMemory}
                disabled={resetting}
                className="flex-1 px-4 py-2.5 rounded-xl bg-rose-500/20 border border-rose-500/30 text-sm font-semibold text-rose-300 hover:bg-rose-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
              >
                {resetting ? <><Loader2 className="w-4 h-4 animate-spin" />Réinitialisation…</> : "Confirmer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
