export type Department =
  | "art"
  | "programming"
  | "game-design"
  | "audio"
  | "narrative"
  | "qa"
  | "marketing"
  | "production";

export type Gender = "homme" | "femme";

export type PersonalityTrait =
  // Sociale
  | "empathique"
  | "maternelle"
  | "distante"
  | "manipulatrice"
  | "possessive"
  // Émotionnelle
  | "melancolique"
  | "optimiste"
  | "impulsive"
  | "stoique"
  | "vulnerable"
  // Intellectuelle
  | "perfectionniste"
  | "curieuse"
  | "analytique"
  | "creative"
  | "dispersee"
  // Relationnelle
  | "loyale"
  | "jalouse"
  | "rivale"
  | "admirative"
  | "rebelle"
  // Caractère
  | "dominante"
  | "soumise"
  | "franche"
  | "mysterieuse"
  | "provocatrice";

/** All valid single-word personality trait identifiers. */
export const VALID_PERSONALITY_TRAITS = new Set<string>([
  "empathique", "maternelle", "distante", "manipulatrice", "possessive",
  "melancolique", "optimiste", "impulsive", "stoique", "vulnerable",
  "perfectionniste", "curieuse", "analytique", "creative", "dispersee",
  "loyale", "jalouse", "rivale", "admirative", "rebelle",
  "dominante", "soumise", "franche", "mysterieuse", "provocatrice",
]);

/**
 * Splits a raw personality string (e.g. "directe, chaleureuse") into
 * individual trait tokens. Each token is trimmed and lowercased.
 */
export function parsePersonalityTraits(raw: string): string[] {
  return raw
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Returns true only if every comma-separated token in `raw` is a known
 * PersonalityTrait. Use this at system boundaries (API routes, migrations).
 */
export function isValidPersonalityField(raw: string): boolean {
  return parsePersonalityTraits(raw).every((t) => VALID_PERSONALITY_TRAITS.has(t));
}

export interface PersonalityMix {
  primary: PersonalityTrait;
  nuance: PersonalityTrait;
  extras: [PersonalityTrait, PersonalityTrait];
}

export interface AppearanceFemme {
  cheveux: string;
  yeux: string;
  morphologie: string;
  taille: string;
  style: string;
  traitDistinctif: string;
  ethnie: string;
  age: string;
}

export interface AppearanceHomme {
  cheveux: string;
  morphologie: string;
  style: string;
  barbe: string;
  ethnie: string;
  age: string;
}

export type Appearance = AppearanceFemme | AppearanceHomme;

export type AgentStatus = "recruté" | "onboarding" | "actif";

export interface AgentDraft {
  department: Department;
  gender: Gender;
  personality: PersonalityMix;
  appearance: Appearance;
  name?: string;
  summary?: string;
  role?: string;
  goal?: string;
  backstory?: string;
}
