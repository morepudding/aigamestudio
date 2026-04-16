export interface ExclusivePhotoTier {
  threshold: number;
  title: string;
  subtitle: string;
  stylePrompt: string;
}

export const EXCLUSIVE_PHOTO_TIERS: ExclusivePhotoTier[] = [
  {
    threshold: 25,
    title: "Photo Exclusive I",
    subtitle: "Ambiance boudoir elegante",
    stylePrompt:
      "elegant lifestyle editorial portrait, refined interior atmosphere, soft warm window light, chic satin outfit, premium fashion direction, strictly non-explicit, no nudity",
  },
  {
    threshold: 150,
    title: "Photo Exclusive II",
    subtitle: "Scene confidentielle cinematic",
    stylePrompt:
      "cinematic private studio moment, premium fashion editorial, intimate atmosphere, dramatic rim light, high-end color grading",
  },
  {
    threshold: 300,
    title: "Photo Exclusive III",
    subtitle: "Portrait lien unique",
    stylePrompt:
      "ultra-premium editorial portrait, emotionally intense eye contact, luxury interior set, magnetic presence, award-winning fashion photography",
  },
];

export function getUnlockedExclusiveTiers(confidenceLevel: number): ExclusivePhotoTier[] {
  return EXCLUSIVE_PHOTO_TIERS.filter((tier) => confidenceLevel >= tier.threshold);
}

export function getExclusiveTierByThreshold(threshold: number): ExclusivePhotoTier | null {
  return EXCLUSIVE_PHOTO_TIERS.find((tier) => tier.threshold === threshold) ?? null;
}
