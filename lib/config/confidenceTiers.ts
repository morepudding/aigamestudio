// Shared confidence tier data — usable in both server routes and client components

export interface ConfidenceTierData {
  threshold: number;
  label: string;
  labelShort: string;
  color: string;
  gradient: string;
  description: string;
  unlocks: string;
}

export const CONFIDENCE_TIERS: ConfidenceTierData[] = [
  {
    threshold: 0,
    label: "Collègue",
    labelShort: "Collègue",
    color: "text-gray-400",
    gradient: "from-gray-500 to-slate-600",
    description: "Vous venez de vous rencontrer",
    unlocks: "Profil complet visible",
  },
  {
    threshold: 25,
    label: "Camarade",
    labelShort: "Camarade",
    color: "text-blue-400",
    gradient: "from-blue-500 to-cyan-500",
    description: "Une vraie sympa s'installe",
    unlocks: "Photo exclusive",
  },
  {
    threshold: 75,
    label: "Ami(e)",
    labelShort: "Ami(e)",
    color: "text-violet-400",
    gradient: "from-violet-500 to-purple-500",
    description: "La confiance grandit",
    unlocks: "Backstory secrète + conversations nocturnes",
  },
  {
    threshold: 150,
    label: "Confident(e)",
    labelShort: "Confident(e)",
    color: "text-pink-400",
    gradient: "from-pink-500 to-rose-500",
    description: "Elle se confie vraiment à toi",
    unlocks: "Scène exclusive + Photo #2",
  },
  {
    threshold: 300,
    label: "Lien unique",
    labelShort: "Lien",
    color: "text-amber-400",
    gradient: "from-amber-500 to-orange-500",
    description: "Un lien au-delà du studio",
    unlocks: "Photo intime + Backstory complète + Chat inédit",
  },
];

export const CONFIDENCE_MAX = 300;

export function getTierForLevel(level: number): ConfidenceTierData {
  for (let i = CONFIDENCE_TIERS.length - 1; i >= 0; i--) {
    if (level >= CONFIDENCE_TIERS[i].threshold) return CONFIDENCE_TIERS[i];
  }
  return CONFIDENCE_TIERS[0];
}

export function getNextTier(level: number): ConfidenceTierData | null {
  for (const tier of CONFIDENCE_TIERS) {
    if (level < tier.threshold) return tier;
  }
  return null;
}

export function getConfidenceProgress(level: number): number {
  const current = getTierForLevel(level);
  const next = getNextTier(level);
  if (!next) return 100;
  return ((level - current.threshold) / (next.threshold - current.threshold)) * 100;
}
