// Brainstorming system types
// Phase 1: GameBrief (template rapide) → Phase 2: One Page généré + commentaires par section → GDD pipeline

// ============================================================
// Game Brief — rempli par le créateur en Phase 1
// ============================================================

export type GameGenre = "action" | "puzzle" | "stealth" | "arcade" | "rpg" | "autre";
export type SessionDuration = "2min" | "5min" | "15min";

export interface GameBrief {
  genre: GameGenre;
  sessionDuration: SessionDuration;
  referenceGame: string;
  theme: string;
}

// ============================================================
// One Page — sections commentables
// ============================================================

export type OnePageSection =
  | "elevatorPitch"
  | "playerFantasy"
  | "coreLoop"
  | "univers"
  | "perimetreV1"
  | "risques"
  | "integrationVN";

export type OnePageComments = Partial<Record<OnePageSection, string>>;

// ============================================================
// Session & messages (conservés pour compatibilité pipeline GDD)
// ============================================================

export type BrainstormingPhase =
  | "brief"      // Phase 1: template rapide
  | "one-page"   // Phase 2: One Page généré + commentaires
  | "completed"; // One Page validé, prêt pour la GDD pipeline

export type BrainstormingMessageRole = "user" | "agent" | "system";

export interface CritiqueQuestion {
  id: string;
  question: string;
  options: string[] | null;
}

export interface BrainstormingMessage {
  id: string;
  sessionId: string;
  role: BrainstormingMessageRole;
  agentSlug: string | null;
  phase: BrainstormingPhase;
  content: string;
  isDynamic: boolean;
  questionKey: string | null;
  sortOrder: number;
  createdAt: string;
}

export interface BrainstormingSession {
  id: string;
  projectId: string;
  agentSlugs: string[];
  currentPhase: BrainstormingPhase;
  phasesCompleted: BrainstormingPhase[];
  // Phase 1
  gameBrief: GameBrief | null;
  // Phase 2
  onePage: string | null;
  onePageComments: OnePageComments | null;
  onePageValidated: boolean;
  // Legacy GDD fields (conservés pour la pipeline GDD existante)
  scopeSummary: string | null;
  gddV1: string | null;
  gdCritiqueQuestions: CritiqueQuestion[] | null;
  gddAnswers: Record<string, string> | null;
  gddV2: string | null;
  gddFinalized: boolean;
  createdAt: string;
  updatedAt: string;
}

export const PHASE_ORDER: BrainstormingPhase[] = ["brief", "one-page", "completed"];

export function getNextPhase(current: BrainstormingPhase): BrainstormingPhase {
  const idx = PHASE_ORDER.indexOf(current);
  if (idx === -1 || idx >= PHASE_ORDER.length - 1) return "completed";
  return PHASE_ORDER[idx + 1];
}
