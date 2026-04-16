"use client";

import { Camera, Users, Moon, Heart, Crown, Lock } from "lucide-react";
import { CONFIDENCE_TIERS, CONFIDENCE_MAX, getTierForLevel, getNextTier, getConfidenceProgress } from "@/lib/config/confidenceTiers";
import type { ConfidenceTierData } from "@/lib/config/confidenceTiers";

type LucideIcon = React.ElementType;

const TIER_ICONS: Record<number, LucideIcon> = {
  0: Users,
  25: Camera,
  75: Moon,
  150: Heart,
  300: Crown,
};

function getIcon(threshold: number): LucideIcon {
  return TIER_ICONS[threshold] ?? Users;
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
  const currentTier = getTierForLevel(level);
  const nextTier = getNextTier(level);
  const Icon = getIcon(currentTier.threshold);
  const progress = getConfidenceProgress(level);
  const isMax = level >= CONFIDENCE_MAX;

  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="relative">
          <Icon className={`w-4 h-4 ${currentTier.color} ${level >= 150 ? "animate-heartbeat" : ""}`} />
          {isMax && (
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-amber-500 rounded-full animate-ping" />
          )}
        </div>
        <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden min-w-16">
          <div
            className={`h-full bg-gradient-to-r ${currentTier.gradient} rounded-full transition-all duration-1000 ${animated ? "animate-shimmer" : ""}`}
            style={{ width: `${progress}%` }}
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
          <div className={`relative ${level >= 150 ? "animate-heartbeat" : ""}`}>
            <Icon className={`w-5 h-5 ${currentTier.color}`} />
            {isMax && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-amber-500 rounded-full animate-ping" />
            )}
          </div>
          <span className={`text-sm font-semibold ${currentTier.color}`}>
            {currentTier.label}
          </span>
        </div>
        <span className="text-lg font-bold text-white">
          {level}
          <span className="text-xs text-muted-foreground font-normal">/{CONFIDENCE_MAX}</span>
        </span>
      </div>

      {/* Main gauge */}
      <div className="relative">
        <div className="h-3 bg-white/5 rounded-full overflow-hidden border border-white/10">
          <div
            className={`h-full bg-gradient-to-r ${currentTier.gradient} rounded-full transition-all duration-1000 ease-out relative overflow-hidden`}
            style={{ width: `${progress}%` }}
          >
            {animated && (
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
            )}
          </div>
        </div>

        {/* Tier markers */}
        {showTiers && (
          <div className="absolute inset-x-0 top-0 h-3 pointer-events-none">
            {CONFIDENCE_TIERS.slice(1).map((tier) => {
              const markerPct = (tier.threshold / CONFIDENCE_MAX) * 100;
              return (
                <div
                  key={tier.threshold}
                  className="absolute top-0 h-full w-px bg-white/20"
                  style={{ left: `${markerPct}%` }}
                >
                  <div
                    className={`absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full border-2 border-background ${
                      level >= tier.threshold
                        ? `bg-gradient-to-r ${tier.gradient}`
                        : "bg-white/20"
                    }`}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Next unlock hint */}
      {nextTier && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Lock className="w-3 h-3 shrink-0" />
          <span>
            Encore <span className="text-white font-medium">{nextTier.threshold - level} pts</span> pour{" "}
            <span className={nextTier.color}>{nextTier.labelShort}</span>
            {" "}— <span className="italic">{nextTier.unlocks}</span>
          </span>
        </div>
      )}

      {/* Tier grid */}
      {showTiers && (
        <div className="grid grid-cols-5 gap-1.5 mt-4">
          {CONFIDENCE_TIERS.map((tier) => {
            const unlocked = level >= tier.threshold;
            const TierIcon = getIcon(tier.threshold);
            return (
              <div
                key={tier.threshold}
                className={`relative flex flex-col items-center p-2 rounded-lg border transition-all ${
                  unlocked
                    ? `bg-gradient-to-br ${tier.gradient}/10 border-white/20`
                    : "bg-white/2 border-white/5 opacity-40"
                }`}
                title={tier.unlocks}
              >
                <TierIcon className={`w-4 h-4 mb-1 ${unlocked ? tier.color : "text-white/30"}`} />
                <span className={`text-[9px] font-medium text-center leading-tight ${unlocked ? "text-white" : "text-white/40"}`}>
                  {tier.labelShort}
                </span>
                <span className="text-[8px] text-muted-foreground mt-0.5">
                  {tier.threshold === 0 ? "début" : `${tier.threshold}+`}
                </span>
                {!unlocked && tier.threshold > 0 && (
                  <Lock className="absolute top-1 right-1 w-2 h-2 text-white/20" />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Mini badge for headers/cards
export function ConfidenceBadge({ level }: { level: number }) {
  const tier = getTierForLevel(level);
  const Icon = getIcon(tier.threshold);

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-gradient-to-r ${tier.gradient}/15 border border-white/15`}
    >
      <Icon className={`w-3 h-3 ${tier.color} ${level >= 150 ? "animate-heartbeat" : ""}`} />
      <span className={`text-xs font-semibold ${tier.color}`}>{level}</span>
    </div>
  );
}
