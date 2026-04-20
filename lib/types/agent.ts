export type Department =
  | "art"
  | "programming"
  | "game-design"
  | "audio"
  | "narrative"
  | "qa"
  | "marketing"
  | "production";

/** Hiérarchie en 3 niveaux, commune à tous les départements */
export type AgentPosition = "junior" | "confirmé" | "lead";

export const AGENT_POSITIONS: { id: AgentPosition; label: string }[] = [
  { id: "junior", label: "Junior" },
  { id: "confirmé", label: "Confirmé" },
  { id: "lead", label: "Lead" },
];

/** Spécialisations réservées au département programming */
export type ProgrammerSpecialization =
  | "gameplay"
  | "engine"
  | "backend"
  | "ui-tech"
  | "devops";

export const PROGRAMMER_SPECIALIZATIONS: {
  id: ProgrammerSpecialization;
  label: string;
  description: string;
  /** Mots-clés de tâches pipeline qui matchent cette spécialisation */
  taskKeywords: string[];
}[] = [
  {
    id: "gameplay",
    label: "Gameplay",
    description: "Mécaniques de jeu, contrôles, boucle de jeu",
    taskKeywords: ["gameplay", "mécanique", "contrôle", "physique", "jeu", "player", "level"],
  },
  {
    id: "engine",
    label: "Engine",
    description: "Moteur, performance, outils internes",
    taskKeywords: ["moteur", "engine", "perf", "rendu", "shader", "optimis", "profil"],
  },
  {
    id: "backend",
    label: "Backend",
    description: "Serveurs, base de données, API",
    taskKeywords: ["backend", "api", "base de données", "serveur", "auth", "supabase", "rest"],
  },
  {
    id: "ui-tech",
    label: "UI/UX Tech",
    description: "Interfaces, intégration design, front-end",
    taskKeywords: ["ui", "interface", "front", "design", "composant", "layout", "css"],
  },
  {
    id: "devops",
    label: "DevOps",
    description: "Build, déploiement, CI/CD",
    taskKeywords: ["deploy", "build", "ci", "cd", "pipeline", "infra", "docker"],
  },
];

const DEPARTMENT_LABELS: Record<string, string> = {
  art: "Designer",
  programming: "Développeur",
  "game-design": "Game Designer",
  audio: "Sound Designer",
  narrative: "Narrateur",
  qa: "QA",
  marketing: "Marketing",
  production: "Producteur",
};

/** Returns the display title shown under an agent's name, replacing the legacy `role` field. */
export function getAgentTitle(agent: {
  department: string;
  position?: string | null;
  specialization?: string | null;
}): string {
  const positionLabel =
    AGENT_POSITIONS.find((p) => p.id === agent.position)?.label ?? null;

  if (agent.department === "programming") {
    const specLabel =
      PROGRAMMER_SPECIALIZATIONS.find((s) => s.id === agent.specialization)?.label ?? null;
    const parts = ["Développeur", specLabel, positionLabel].filter(Boolean);
    return parts.join(" ");
  }

  const deptLabel = DEPARTMENT_LABELS[agent.department] ?? agent.department;
  const parts = [deptLabel, positionLabel].filter(Boolean);
  return parts.join(" ");
}

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
  | "provocatrice"
  | "sarcastique"
  | "taquine"
  // Émotionnelle (étendu)
  | "solaire"
  // Relationnelle (étendu)
  | "testante";

/** All valid single-word personality trait identifiers. */
export const VALID_PERSONALITY_TRAITS = new Set<string>([
  "empathique", "maternelle", "distante", "manipulatrice", "possessive",
  "melancolique", "optimiste", "impulsive", "stoique", "vulnerable",
  "perfectionniste", "curieuse", "analytique", "creative", "dispersee",
  "loyale", "jalouse", "rivale", "admirative", "rebelle",
  "dominante", "soumise", "franche", "mysterieuse", "provocatrice",
  "sarcastique", "taquine", "solaire", "testante",
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
  piercingEmplacement?: string;
  ethnie: string;
  age: string;
}

export interface AppearanceHomme {
  cheveux: string;
  morphologie: string;
  style: string;
  barbe: string;
  traitDistinctif?: string;
  piercingEmplacement?: string;
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
  position?: AgentPosition;
  specialization?: ProgrammerSpecialization | null;
}
