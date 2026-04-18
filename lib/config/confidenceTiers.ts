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
    label: "Inconnu(e)",
    labelShort: "Inconnu",
    color: "text-gray-400",
    gradient: "from-gray-500 to-slate-600",
    description: "Vous vous connaissez à peine",
    unlocks: "Profil de base visible",
  },
  {
    threshold: 30,
    label: "Collègue",
    labelShort: "Collègue",
    color: "text-blue-400",
    gradient: "from-blue-500 to-cyan-500",
    description: "Le ton est cordial, la relation s'installe",
    unlocks: "Profil complet visible",
  },
  {
    threshold: 100,
    label: "Ami(e)",
    labelShort: "Ami(e)",
    color: "text-violet-400",
    gradient: "from-violet-500 to-purple-500",
    description: "Une vraie chaleur s'installe — taquineries, ouverture",
    unlocks: "Photo exclusive + conversations personnelles",
  },
  {
    threshold: 250,
    label: "Confident(e)",
    labelShort: "Confident(e)",
    color: "text-pink-400",
    gradient: "from-pink-500 to-rose-500",
    description: "Elle se confie, les secrets arrivent",
    unlocks: "Backstory secrète + scène exclusive",
  },
  {
    threshold: 500,
    label: "Lien unique",
    labelShort: "Lien",
    color: "text-amber-400",
    gradient: "from-amber-500 to-orange-500",
    description: "Une complicité totale — au-delà du studio",
    unlocks: "Photo intime + chat inédit + histoire commune",
  },
];

export const CONFIDENCE_MAX = 500;

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
