// Brainstorming system types
// Phase 1: GameBrief (template rapide) → Phase 2: One Page généré + commentaires par section → GDD pipeline

// ============================================================
// Game Brief — rempli par le créateur en Phase 1
// ============================================================

export type GameGenre = "action" | "puzzle" | "stealth" | "arcade" | "rpg" | "autre";
export type SessionDuration = "2min" | "5min" | "15min";

export const GAME_BRIEF_GENRES: GameGenre[] = ["action", "puzzle", "stealth", "arcade", "rpg", "autre"];
export const SESSION_DURATIONS: SessionDuration[] = ["2min", "5min", "15min"];

export interface GameBrief {
  genre: GameGenre;
  sessionDuration: SessionDuration;
  referenceGame: string;
  theme: string;
}

export interface GameBriefExtended extends GameBrief {
  lockedDecisions: string[];
  prototypeRef: string | null;
  scopeNote: string | null;
}

export function normalizeGameBrief(
  brief: GameBrief | GameBriefExtended | null | undefined
): GameBriefExtended | null {
  if (!brief) return null;

  return {
    genre: brief.genre,
    sessionDuration: brief.sessionDuration,
    referenceGame: brief.referenceGame ?? "",
    theme: brief.theme ?? "",
    lockedDecisions: "lockedDecisions" in brief && Array.isArray(brief.lockedDecisions)
      ? brief.lockedDecisions.filter((decision) => typeof decision === "string")
      : [],
    prototypeRef: "prototypeRef" in brief ? brief.prototypeRef ?? null : null,
    scopeNote: "scopeNote" in brief ? brief.scopeNote ?? null : null,
  };
}

export function isGameBriefComplete(
  brief: GameBrief | GameBriefExtended | null | undefined
): brief is GameBriefExtended {
  const normalized = normalizeGameBrief(brief);

  if (!normalized) return false;

  const hasReference =
    normalized.referenceGame.trim().length > 0 || (normalized.prototypeRef?.trim().length ?? 0) > 0;

  return (
    normalized.genre.length > 0 &&
    normalized.sessionDuration.length > 0 &&
    normalized.theme.trim().length > 0 &&
    hasReference &&
    (normalized.scopeNote?.trim().length ?? 0) > 0
  );
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
  gameBrief: GameBriefExtended | null;
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
