// Brainstorming system types
// Multi-agent wizard that scopes the game concept before GDD generation.

export type BrainstormingPhase =
  | "game-design" // Game Designer questions (concept, genre, core loop, audience, scope)
  | "programming" // Programmer questions (platform, engine, constraints)
  | "art"         // Artist questions (mood, visual style, references)
  | "dynamic"     // AI-generated follow-up questions based on previous answers
  | "synthesis"   // AI synthesizes scope summary
  | "completed";  // Brainstorming done, ready for GDD generation

export type BrainstormingMessageRole = "user" | "agent" | "system";

export interface CritiqueQuestion {
  id: string;
  question: string;
  /** If provided: render as radio/select choices. If null: free text. */
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
  scopeSummary: string | null;
  gddV1: string | null;
  gdCritiqueQuestions: CritiqueQuestion[] | null;
  gddAnswers: Record<string, string> | null;
  gddV2: string | null;
  gddFinalized: boolean;
  createdAt: string;
  updatedAt: string;
}

// Ordered list of agent phases (maps department → phase name)
export const PHASE_ORDER: BrainstormingPhase[] = [
  "game-design",
  "programming",
  "art",
  "dynamic",
  "synthesis",
  "completed",
];

// Department responsible for each brainstorming phase
export const PHASE_DEPARTMENT: Record<string, string> = {
  "game-design": "game-design",
  "programming": "programming",
  "art": "art",
};

export function getNextPhase(current: BrainstormingPhase): BrainstormingPhase {
  const idx = PHASE_ORDER.indexOf(current);
  if (idx === -1 || idx >= PHASE_ORDER.length - 1) return "completed";
  return PHASE_ORDER[idx + 1];
}
