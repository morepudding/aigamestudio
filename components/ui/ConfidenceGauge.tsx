"use client";

import { Heart, MessageCircle, Sparkles, Star, Crown, Lock } from "lucide-react";

interface ConfidenceTier {
  threshold: number;
  label: string;
  labelShort: string;
  icon: React.ElementType;
  color: string;
  gradient: string;
  description: string;
}

const tiers: ConfidenceTier[] = [
  {
    threshold: 0,
    label: "Relation neutre",
    labelShort: "Neutre",
    icon: MessageCircle,
    color: "text-gray-400",
    gradient: "from-gray-500 to-slate-600",
    description: "Vous venez de vous rencontrer",
  },
  {
    threshold: 15,
    label: "Surnom possible",
    labelShort: "Surnom",
    icon: MessageCircle,
    color: "text-blue-400",
    gradient: "from-blue-500 to-cyan-500",
    description: "Elle peut utiliser un surnom pour vous",
  },
  {
    threshold: 25,
    label: "Références passées",
    labelShort: "Souvenirs",
    icon: Sparkles,
    color: "text-violet-400",
    gradient: "from-violet-500 to-purple-500",
    description: "Elle fait référence à vos moments partagés",
  },
  {
    threshold: 40,
    label: "Taquineries débloquées",
    labelShort: "Complicité",
    icon: Star,
    color: "text-amber-400",
    gradient: "from-amber-500 to-orange-500",
    description: "Blagues personnelles et complicité",
  },
  {
    threshold: 60,
    label: "Confidences débloquées",
    labelShort: "Confiance",
    icon: Heart,
    color: "text-pink-400",
    gradient: "from-pink-500 to-rose-500",
    description: "Elle partage des secrets personnels",
  },
  {
    threshold: 80,
    label: "Vulnérabilité totale",
    labelShort: "Intime",
    icon: Crown,
    color: "text-rose-400",
    gradient: "from-rose-500 to-red-500",
    description: "Lien profond, émotions sans filtre",
  },
];

function getCurrentTier(level: number): ConfidenceTier {
  for (let i = tiers.length - 1; i >= 0; i--) {
    if (level >= tiers[i].threshold) return tiers[i];
  }
  return tiers[0];
}

function getNextTier(level: number): ConfidenceTier | null {
  for (const tier of tiers) {
    if (level < tier.threshold) return tier;
  }
  return null;
}

interface ConfidenceGaugeProps {
  level: number;
  showTiers?: boolean;
  compact?: boolean;
  animated?: boolean;
  className?: string;
}

export function ConfidenceGauge({
  level,
  showTiers = true,
  compact = false,
  animated = true,
  className = "",
}: ConfidenceGaugeProps) {
  const currentTier = getCurrentTier(level);
  const nextTier = getNextTier(level);
  const Icon = currentTier.icon;
  const progress = nextTier
    ? ((level - currentTier.threshold) / (nextTier.threshold - currentTier.threshold)) * 100
    : 100;

  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="relative">
          <Icon className={`w-4 h-4 ${currentTier.color} ${level >= 60 ? "animate-heartbeat" : ""}`} />
          {level >= 80 && (
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-rose-500 rounded-full animate-ping" />
          )}
        </div>
        <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden min-w-16">
          <div
            className={`h-full bg-gradient-to-r ${currentTier.gradient} rounded-full transition-all duration-1000 ${animated ? "animate-shimmer" : ""}`}
            style={{ width: `${level}%` }}
          />
        </div>
        <span className={`text-xs font-semibold ${currentTier.color}`}>{level}</span>
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`relative ${level >= 60 ? "animate-heartbeat" : ""}`}>
            <Icon className={`w-5 h-5 ${currentTier.color}`} />
            {level >= 80 && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-rose-500 rounded-full animate-ping" />
            )}
          </div>
          <span className={`text-sm font-semibold ${currentTier.color}`}>
            {currentTier.label}
          </span>
        </div>
        <span className="text-lg font-bold text-white">{level}/100</span>
      </div>

      {/* Main gauge */}
      <div className="relative">
        <div className="h-3 bg-white/5 rounded-full overflow-hidden border border-white/10">
          <div
            className={`h-full bg-gradient-to-r ${currentTier.gradient} rounded-full transition-all duration-1000 ease-out relative overflow-hidden`}
            style={{ width: `${level}%` }}
          >
            {animated && (
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
            )}
          </div>
        </div>

        {/* Tier markers */}
        {showTiers && (
          <div className="absolute inset-x-0 top-0 h-3 pointer-events-none">
            {tiers.slice(1).map((tier) => (
              <div
                key={tier.threshold}
                className="absolute top-0 h-full w-px bg-white/20"
                style={{ left: `${tier.threshold}%` }}
              >
                <div
                  className={`absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full border-2 border-background ${
                    level >= tier.threshold
                      ? `bg-gradient-to-r ${tier.gradient}`
                      : "bg-white/20"
                  }`}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Next unlock hint */}
      {nextTier && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Lock className="w-3 h-3" />
          <span>
            Encore <span className="text-white font-medium">{nextTier.threshold - level} pts</span> pour{" "}
            <span className={nextTier.color}>{nextTier.labelShort}</span>
          </span>
        </div>
      )}

      {/* Tier list (optional) */}
      {showTiers && (
        <div className="grid grid-cols-3 gap-1.5 mt-4">
          {tiers.slice(1).map((tier) => {
            const unlocked = level >= tier.threshold;
            const TierIcon = tier.icon;
            return (
              <div
                key={tier.threshold}
                className={`relative flex flex-col items-center p-2 rounded-lg border transition-all ${
                  unlocked
                    ? `bg-gradient-to-br ${tier.gradient}/10 border-${tier.color.replace("text-", "")}/30`
                    : "bg-white/2 border-white/5 opacity-50"
                }`}
                title={tier.description}
              >
                <TierIcon
                  className={`w-4 h-4 mb-1 ${unlocked ? tier.color : "text-white/30"}`}
                />
                <span className={`text-[10px] font-medium text-center leading-tight ${unlocked ? "text-white" : "text-white/40"}`}>
                  {tier.labelShort}
                </span>
                <span className="text-[9px] text-muted-foreground">{tier.threshold}+</span>
                {!unlocked && (
                  <Lock className="absolute top-1 right-1 w-2.5 h-2.5 text-white/20" />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Mini version for cards/lists
export function ConfidenceBadge({ level }: { level: number }) {
  const tier = getCurrentTier(level);
  const Icon = tier.icon;

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-gradient-to-r ${tier.gradient}/15 border border-${tier.color.replace("text-", "")}/30`}
    >
      <Icon className={`w-3 h-3 ${tier.color} ${level >= 60 ? "animate-heartbeat" : ""}`} />
      <span className={`text-xs font-semibold ${tier.color}`}>{level}</span>
    </div>
  );
}
