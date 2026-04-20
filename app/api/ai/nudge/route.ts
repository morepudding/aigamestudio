import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { LLM_MODELS } from "@/lib/config/llm";
import { MAX_NUDGES, computeNextNudgeAt } from "@/lib/config/nudgeConfig";
import { getAvailableCards, fetchAcceptedDbCards } from "@/lib/services/deckService";
import { buildMemoryContextState, type AgentMemory } from "@/lib/services/memoryService";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const CLAIM_MS = 90_000;
const MAX_CONVERSATIONS_PER_PASS = 3;

type DueConversationRow = {
  id: string;
  agent_slug: string;
  awaiting_user_reply: boolean;
  nudge_count: number;
  nudge_scheduled_at: number | null;
};

type AgentRow = {
  slug: string;
  name: string;
  role: string;
  personality_primary: string;
  personality_nuance: string | null;
  backstory: string | null;
  confidence_level: number | null;
};

type MessageRow = {
  id: string;
  sender: "user" | "agent";
  content: string;
  timestamp: number;
};

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Missing Supabase configuration");
  }

  return createClient(url, key);
}

function buildFallbackNudge(seed: string): string {
  return seed.length <= 140 ? seed : `${seed.slice(0, 137).trimEnd()}...`;
}

function normalizeNudgeMessage(content: string): string {
  return content
    .replace(/```[\s\S]*?```/g, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/^['"«\s]+|['"»\s]+$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

async function generateNudgeMessage(params: {
  agent: AgentRow;
  history: MessageRow[];
  seed: string;
  memories: AgentMemory[];
}): Promise<string> {
  const { agent, history, seed, memories } = params;
  const apiKey = process.env.OPEN_ROUTE_SERVICE_API_KEY;
  if (!apiKey) {
    return buildFallbackNudge(seed);
  }

  const memoryContext = buildMemoryContextState(memories);
  const recentHistory = history
    .slice(-3)
    .map((message) => `${message.sender === "user" ? "Boss" : agent.name}: ${message.content}`)
    .join("\n");

  const memorySnippet = memoryContext.promptMemories
    .split("\n")
    .filter(Boolean)
    .slice(0, 6)
    .join("\n");

  const systemPrompt = `Tu écris UNE relance naturelle de messagerie pour ${agent.name}.
Personnalité: ${agent.personality_primary}${agent.personality_nuance ? `, nuance: ${agent.personality_nuance}` : ""}.
Role: ${agent.role}.
Backstory: ${agent.backstory ?? ""}

Objectif:
- Relancer après un silence de quelques minutes.
- Le message doit sembler spontané, pas systemique.
- Ne fais jamais de reproche sur l'absence de réponse.
- Ne dis jamais que tu "relances" ou que cela fait longtemps.
- Une seule petite idée par message.
- 1 a 2 phrases max.
- 80 tokens max.
- Francais uniquement.
- Reste leger, humain, specifique.

Seed deck a reutiliser librement:
${seed}

Memoire utile:
${memorySnippet || "Aucune"}`;

  const userPrompt = `Derniers messages:\n${recentHistory || "Aucun contexte recent."}\n\nEcris maintenant le prochain message naturel de ${agent.name}.`;

  try {
    const res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: LLM_MODELS.chat,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 300,
        temperature: 0.85,
      }),
    });

    if (!res.ok) {
      return buildFallbackNudge(seed);
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      return buildFallbackNudge(seed);
    }

    const normalized = normalizeNudgeMessage(content);
    if (!normalized) {
      return buildFallbackNudge(seed);
    }
    return normalized;
  } catch {
    return buildFallbackNudge(seed);
  }
}

export async function POST() {
  try {
    const supabase = getSupabaseAdmin();
    const now = Date.now();

    const { data: dueConversations, error: dueError } = await supabase
      .from("conversations")
      .select("id, agent_slug, awaiting_user_reply, nudge_count, nudge_scheduled_at")
      .eq("is_pinned", true)
      .eq("awaiting_user_reply", true)
      .lt("nudge_count", MAX_NUDGES)
      .lte("nudge_scheduled_at", now)
      .order("nudge_scheduled_at", { ascending: true })
      .limit(MAX_CONVERSATIONS_PER_PASS);

    if (dueError) {
      return NextResponse.json({ error: dueError.message }, { status: 500 });
    }

    const dueRows = (dueConversations ?? []) as DueConversationRow[];
    if (dueRows.length === 0) {
      return NextResponse.json({ processed: 0, inserted: 0 });
    }

    let inserted = 0;

    for (const conversation of dueRows) {
      const claimUntil = now + CLAIM_MS;
      const { data: claimRows, error: claimError } = await supabase
        .from("conversations")
        .update({ nudge_scheduled_at: claimUntil })
        .eq("id", conversation.id)
        .eq("awaiting_user_reply", true)
        .eq("nudge_count", conversation.nudge_count)
        .eq("nudge_scheduled_at", conversation.nudge_scheduled_at)
        .select("id");

      if (claimError || !claimRows?.length) {
        continue;
      }

      const { data: agentData } = await supabase
        .from("agents")
        .select("slug, name, role, personality_primary, personality_nuance, backstory, confidence_level")
        .eq("slug", conversation.agent_slug)
        .single();

      const agent = agentData as AgentRow | null;
      if (!agent) {
        await supabase
          .from("conversations")
          .update({ nudge_scheduled_at: null })
          .eq("id", conversation.id);
        continue;
      }

      const { data: recentMessages } = await supabase
        .from("messages")
        .select("id, sender, content, timestamp")
        .eq("conversation_id", conversation.id)
        .order("timestamp", { ascending: false })
        .limit(6);

      const history = ((recentMessages ?? []) as MessageRow[]).reverse();

      const { data: memoryRows } = await supabase
        .from("agent_memory")
        .select("*")
        .eq("agent_slug", agent.slug)
        .order("importance", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(12);

      const [agentDbCards, studioDbCards] = await Promise.all([
        fetchAcceptedDbCards(agent.slug),
        fetchAcceptedDbCards("studio"),
      ]);
      const candidateCards = getAvailableCards(agent.slug, agent.confidence_level ?? 0, [...agentDbCards, ...studioDbCards])
        .filter((card) => card.type === "relance" || card.type === "question");

      const seed = candidateCards.length > 0
        ? candidateCards[Math.floor(Math.random() * candidateCards.length)].content
        : "Je repensais a ce qu'on disait tout a l'heure. Tu en es ou de ton cote ?";

      const message = await generateNudgeMessage({
        agent,
        history,
        seed,
        memories: (memoryRows ?? []) as AgentMemory[],
      });

      const timestamp = Date.now();
      const messageId = `${timestamp}-${Math.random().toString(36).slice(2, 9)}`;

      const { error: messageError } = await supabase
        .from("messages")
        .insert({
          id: messageId,
          conversation_id: conversation.id,
          sender: "agent",
          content: message,
          timestamp,
          message_type: "normal",
        });

      if (messageError) {
        await supabase
          .from("conversations")
          .update({ nudge_scheduled_at: conversation.nudge_scheduled_at })
          .eq("id", conversation.id);
        continue;
      }

      const nextNudgeCount = conversation.nudge_count + 1;
      await supabase
        .from("conversations")
        .update({
          last_message_at: timestamp,
          awaiting_user_reply: true,
          nudge_count: nextNudgeCount,
          nudge_scheduled_at: nextNudgeCount >= MAX_NUDGES
            ? null
            : computeNextNudgeAt(agent.personality_primary, nextNudgeCount),
        })
        .eq("id", conversation.id);

      inserted += 1;
    }

    return NextResponse.json({ processed: dueRows.length, inserted });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
