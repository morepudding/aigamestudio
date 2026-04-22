import { getSupabaseAdminClient } from "@/lib/supabase/admin";

type FeedbackValue = 1 | -1;

type FeedbackRow = {
  content: string;
  user_feedback: FeedbackValue;
  user_feedback_at: number | null;
  timestamp: number;
  message_type: string | null;
};

export type ConversationFeedbackSummary = {
  hasSignal: boolean;
  thumbsUpCount: number;
  thumbsDownCount: number;
  promptBlock: string;
};

const GENERIC_NEGATIVE_PATTERN = /tu t'es pose|tu fais quoi|je vois\b|raconte\b|ca va comment|ça va comment|t'en es ou|t'en es où/i;
const TOPIC_INSISTENCE_PATTERN = /\bcafe\b|\bcafé\b/i;

function compactWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function shorten(value: string, maxLength = 120): string {
  const compact = compactWhitespace(value);
  if (compact.length <= maxLength) {
    return compact;
  }

  const slice = compact.slice(0, maxLength);
  const boundary = slice.lastIndexOf(" ");
  return `${slice.slice(0, boundary > 60 ? boundary : maxLength).trim()}...`;
}

function normalizeForDedup(value: string): string {
  return compactWhitespace(value)
    .toLowerCase()
    .replace(/[’']/g, " ")
    .replace(/[^a-z0-9àâçéèêëîïôûùüÿñæœ\s]/gi, "")
    .trim();
}

function uniqueExamples(rows: FeedbackRow[], maxExamples = 2): string[] {
  const seen = new Set<string>();
  const examples: string[] = [];

  for (const row of rows) {
    const normalized = normalizeForDedup(row.content);
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    examples.push(shorten(row.content));

    if (examples.length >= maxExamples) {
      break;
    }
  }

  return examples;
}

function buildHeuristicBullets(rows: FeedbackRow[]): string[] {
  const positives = rows.filter((row) => row.user_feedback === 1);
  const negatives = rows.filter((row) => row.user_feedback === -1);
  const bullets: string[] = [];

  if (positives.length > 0) {
    bullets.push("A privilegier: reponses situees, concretes, avec un angle clair plutot qu'une relance vide.");
  }

  if (negatives.some((row) => GENERIC_NEGATIVE_PATTERN.test(row.content))) {
    bullets.push("A eviter: relances generiques ou recyclables entre conversations.");
  }

  if (negatives.some((row) => TOPIC_INSISTENCE_PATTERN.test(row.content))) {
    bullets.push("A eviter: insister sur un theme deja use ou explicitement rejete par le user.");
  }

  if (negatives.length > 0 && bullets.length < 3) {
    bullets.push("A eviter: formulations systemiques ou trop automatiques meme si elles paraissent naturelles.");
  }

  return bullets.slice(0, 3);
}

function buildPromptBlock(rows: FeedbackRow[]): string {
  if (rows.length === 0) {
    return "";
  }

  const positives = rows.filter((row) => row.user_feedback === 1);
  const negatives = rows.filter((row) => row.user_feedback === -1);
  const positiveExamples = uniqueExamples(positives);
  const negativeExamples = uniqueExamples(negatives);
  const lines = [
    "",
    "Feedback utilisateur recent (thumbs):",
    `- Signal recent: ${positives.length} positif(s), ${negatives.length} negatif(s).`,
    ...buildHeuristicBullets(rows).map((bullet) => `- ${bullet}`),
  ];

  if (positiveExamples.length > 0) {
    lines.push(`- Exemples bien recus: ${positiveExamples.map((example) => `\"${example}\"`).join(" ; ")}.`);
  }

  if (negativeExamples.length > 0) {
    lines.push(`- Exemples mal recus: ${negativeExamples.map((example) => `\"${example}\"`).join(" ; ")}.`);
  }

  lines.push("- Utilise ce signal comme un ajustement discret. Ne mentionne jamais le feedback explicitement.");

  return lines.join("\n");
}

async function resolveAgentSlug(params: {
  conversationId?: string;
  agentSlug?: string;
}): Promise<string | null> {
  if (params.agentSlug) {
    return params.agentSlug;
  }

  if (!params.conversationId) {
    return null;
  }

  const supabase = getSupabaseAdminClient();
  const { data } = await supabase
    .from("conversations")
    .select("agent_slug")
    .eq("id", params.conversationId)
    .single();

  return (data?.agent_slug as string | undefined) ?? null;
}

export async function getConversationFeedbackSummary(params: {
  conversationId?: string;
  agentSlug?: string;
  maxConversations?: number;
  maxFeedbackMessages?: number;
}): Promise<ConversationFeedbackSummary> {
  const agentSlug = await resolveAgentSlug(params);
  if (!agentSlug) {
    return { hasSignal: false, thumbsUpCount: 0, thumbsDownCount: 0, promptBlock: "" };
  }

  const supabase = getSupabaseAdminClient();
  const maxConversations = params.maxConversations ?? 12;
  const maxFeedbackMessages = params.maxFeedbackMessages ?? 12;

  const { data: conversations, error: conversationsError } = await supabase
    .from("conversations")
    .select("id")
    .eq("agent_slug", agentSlug)
    .order("last_message_at", { ascending: false })
    .limit(maxConversations);

  if (conversationsError || !conversations || conversations.length === 0) {
    return { hasSignal: false, thumbsUpCount: 0, thumbsDownCount: 0, promptBlock: "" };
  }

  const conversationIds = conversations
    .map((row) => row.id as string)
    .filter(Boolean);

  const { data: feedbackRows, error: feedbackError } = await supabase
    .from("messages")
    .select("content, user_feedback, user_feedback_at, timestamp, message_type")
    .in("conversation_id", conversationIds)
    .eq("sender", "agent")
    .not("user_feedback", "is", null)
    .order("user_feedback_at", { ascending: false })
    .limit(maxFeedbackMessages);

  if (feedbackError || !feedbackRows || feedbackRows.length === 0) {
    return { hasSignal: false, thumbsUpCount: 0, thumbsDownCount: 0, promptBlock: "" };
  }

  const rows = (feedbackRows as FeedbackRow[]).filter((row) => row.content?.trim());

  return {
    hasSignal: rows.length > 0,
    thumbsUpCount: rows.filter((row) => row.user_feedback === 1).length,
    thumbsDownCount: rows.filter((row) => row.user_feedback === -1).length,
    promptBlock: buildPromptBlock(rows),
  };
}