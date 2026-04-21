import { PersonalityTrait } from "@/lib/types/agent";

export const MAX_NUDGES = 1;

/** Plage de délai en millisecondes [min, max] par classe de personnalité */
const NUDGE_DELAY_MS: Record<string, [number, number]> = {
  // Rapides — ne peuvent pas s'empêcher de réécrire
  impulsive:    [2 * 60_000, 4 * 60_000],
  curieuse:     [2 * 60_000, 4 * 60_000],
  dispersee:    [2 * 60_000, 4 * 60_000],
  jalouse:      [2 * 60_000, 4 * 60_000],
  possessive:   [2 * 60_000, 4 * 60_000],

  // Moyens — chaleureux ou engagés mais pas urgents
  empathique:   [4 * 60_000, 7 * 60_000],
  maternelle:   [4 * 60_000, 7 * 60_000],
  optimiste:    [4 * 60_000, 7 * 60_000],
  creative:     [4 * 60_000, 7 * 60_000],
  loyale:       [4 * 60_000, 7 * 60_000],
  admirative:   [4 * 60_000, 7 * 60_000],
  franche:      [4 * 60_000, 7 * 60_000],
  rebelle:      [4 * 60_000, 7 * 60_000],
  rivale:       [4 * 60_000, 7 * 60_000],
  vulnerable:   [4 * 60_000, 7 * 60_000],

  // Lents — n'ont pas besoin de toi, mais finissent par craquer
  distante:       [7 * 60_000, 12 * 60_000],
  stoique:        [7 * 60_000, 12 * 60_000],
  analytique:     [7 * 60_000, 12 * 60_000],
  perfectionniste:[7 * 60_000, 12 * 60_000],
  melancolique:   [7 * 60_000, 12 * 60_000],
  mysterieuse:    [7 * 60_000, 12 * 60_000],
  dominante:      [7 * 60_000, 12 * 60_000],
  soumise:        [7 * 60_000, 12 * 60_000],
  manipulatrice:  [7 * 60_000, 12 * 60_000],
};

const DEFAULT_DELAY_MS: [number, number] = [4 * 60_000, 8 * 60_000];

/** Calcule le prochain nudge_scheduled_at (epoch ms) */
export function computeNextNudgeAt(
  personality: PersonalityTrait | string,
  nudgeIndex: number, // 0-based: 0 = premier nudge, 1 = deuxième, etc.
): number {
  const [min, max] = NUDGE_DELAY_MS[personality] ?? DEFAULT_DELAY_MS;

  // Les relances successives sont légèrement plus espacées (×1.2 par relance)
  const factor = Math.pow(1.2, nudgeIndex);
  const scaledMin = min * factor;
  const scaledMax = max * factor;

  // Jitter aléatoire dans la plage
  const delay = scaledMin + Math.random() * (scaledMax - scaledMin);
  return Date.now() + Math.round(delay);
}
