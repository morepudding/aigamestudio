import { supabase } from "@/lib/supabase/client";
import type {
  BrainstormingSession,
  BrainstormingMessage,
  BrainstormingPhase,
  CritiqueQuestion,
} from "@/lib/types/brainstorming";

// ============================================================
// DB → Domain mappers
// ============================================================

type DbSession = {
  id: string;
  project_id: string;
  agent_slugs: string[];
  current_phase: string;
  phases_completed: string[];
  scope_summary: string | null;
  gdd_v1: string | null;
  gdd_critique_questions: CritiqueQuestion[] | null;
  gdd_answers: Record<string, string> | null;
  gdd_v2: string | null;
  gdd_finalized: boolean;
  created_at: string;
  updated_at: string;
};

type DbMessage = {
  id: string;
  session_id: string;
  role: string;
  agent_slug: string | null;
  phase: string;
  content: string;
  is_dynamic: boolean;
  question_key: string | null;
  sort_order: number;
  created_at: string;
};

function toSession(row: DbSession): BrainstormingSession {
  return {
    id: row.id,
    projectId: row.project_id,
    agentSlugs: row.agent_slugs ?? [],
    currentPhase: row.current_phase as BrainstormingPhase,
    phasesCompleted: (row.phases_completed ?? []) as BrainstormingPhase[],
    scopeSummary: row.scope_summary,
    gddV1: row.gdd_v1,
    gdCritiqueQuestions: row.gdd_critique_questions,
    gddAnswers: row.gdd_answers,
    gddV2: row.gdd_v2,
    gddFinalized: row.gdd_finalized,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toMessage(row: DbMessage): BrainstormingMessage {
  return {
    id: row.id,
    sessionId: row.session_id,
    role: row.role as BrainstormingMessage["role"],
    agentSlug: row.agent_slug,
    phase: row.phase as BrainstormingPhase,
    content: row.content,
    isDynamic: row.is_dynamic,
    questionKey: row.question_key,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  };
}

// ============================================================
// Session CRUD
// ============================================================

export async function createSession(
  projectId: string,
  agentSlugs: string[]
): Promise<BrainstormingSession | null> {
  const { data, error } = await supabase
    .from("brainstorming_sessions")
    .insert({
      project_id: projectId,
      agent_slugs: agentSlugs,
      current_phase: "game-design",
      phases_completed: [],
      gdd_finalized: false,
    })
    .select()
    .single();

  if (error || !data) {
    console.error("[brainstormingService] createSession error:", error);
    return null;
  }

  // Link session to project
  await supabase
    .from("projects")
    .update({ brainstorming_session_id: data.id })
    .eq("id", projectId);

  return toSession(data as DbSession);
}

export async function getSessionByProject(
  projectId: string
): Promise<BrainstormingSession | null> {
  const { data, error } = await supabase
    .from("brainstorming_sessions")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;
  return toSession(data as DbSession);
}

export async function getSessionById(
  sessionId: string
): Promise<BrainstormingSession | null> {
  const { data, error } = await supabase
    .from("brainstorming_sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (error || !data) return null;
  return toSession(data as DbSession);
}

export async function updateSessionPhase(
  sessionId: string,
  newPhase: BrainstormingPhase,
  completedPhase?: BrainstormingPhase
): Promise<void> {
  const session = await getSessionById(sessionId);
  if (!session) return;

  const phasesCompleted = completedPhase
    ? [...new Set([...session.phasesCompleted, completedPhase])]
    : session.phasesCompleted;

  await supabase
    .from("brainstorming_sessions")
    .update({ current_phase: newPhase, phases_completed: phasesCompleted })
    .eq("id", sessionId);
}

export async function updateSessionScope(
  sessionId: string,
  scopeSummary: string
): Promise<void> {
  await supabase
    .from("brainstorming_sessions")
    .update({ scope_summary: scopeSummary, current_phase: "completed" })
    .eq("id", sessionId);
}

export async function updateSessionGdd(
  sessionId: string,
  fields: {
    gddV1?: string;
    gdCritiqueQuestions?: CritiqueQuestion[];
    gddAnswers?: Record<string, string>;
    gddV2?: string;
    gddFinalized?: boolean;
  }
): Promise<void> {
  const dbFields: Record<string, unknown> = {};
  if (fields.gddV1 !== undefined) dbFields.gdd_v1 = fields.gddV1;
  if (fields.gdCritiqueQuestions !== undefined) dbFields.gdd_critique_questions = fields.gdCritiqueQuestions;
  if (fields.gddAnswers !== undefined) dbFields.gdd_answers = fields.gddAnswers;
  if (fields.gddV2 !== undefined) dbFields.gdd_v2 = fields.gddV2;
  if (fields.gddFinalized !== undefined) dbFields.gdd_finalized = fields.gddFinalized;

  await supabase
    .from("brainstorming_sessions")
    .update(dbFields)
    .eq("id", sessionId);
}

// ============================================================
// Message CRUD
// ============================================================

export async function getSessionMessages(
  sessionId: string
): Promise<BrainstormingMessage[]> {
  const { data, error } = await supabase
    .from("brainstorming_messages")
    .select("*")
    .eq("session_id", sessionId)
    .order("sort_order", { ascending: true });

  if (error || !data) return [];
  return (data as DbMessage[]).map(toMessage);
}

export async function addMessage(msg: {
  sessionId: string;
  role: BrainstormingMessage["role"];
  agentSlug: string | null;
  phase: BrainstormingPhase;
  content: string;
  isDynamic?: boolean;
  questionKey?: string | null;
}): Promise<BrainstormingMessage | null> {
  // Get current max sort_order for this session
  const { data: last } = await supabase
    .from("brainstorming_messages")
    .select("sort_order")
    .eq("session_id", msg.sessionId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .single();

  const sortOrder = ((last as { sort_order: number } | null)?.sort_order ?? -1) + 1;

  const { data, error } = await supabase
    .from("brainstorming_messages")
    .insert({
      session_id: msg.sessionId,
      role: msg.role,
      agent_slug: msg.agentSlug,
      phase: msg.phase,
      content: msg.content,
      is_dynamic: msg.isDynamic ?? false,
      question_key: msg.questionKey ?? null,
      sort_order: sortOrder,
    })
    .select()
    .single();

  if (error || !data) {
    console.error("[brainstormingService] addMessage error:", error);
    return null;
  }
  return toMessage(data as DbMessage);
}

// Returns all messages for a session formatted as a conversation transcript
export async function getConversationTranscript(
  sessionId: string
): Promise<string> {
  const messages = await getSessionMessages(sessionId);
  return messages
    .map((m) => {
      const speaker = m.role === "user" ? "Directeur" : m.agentSlug ?? "Système";
      return `[${speaker}]: ${m.content}`;
    })
    .join("\n\n");
}
