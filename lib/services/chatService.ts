import { supabase } from "@/lib/supabase/client";
import { computeNextNudgeAt } from "@/lib/config/nudgeConfig";
import { Conversation, ConversationSummary, Message, MessageType } from "@/lib/types/chat";
import { perfLog } from "@/lib/utils/perf";
import { canSendAgentMessage } from "@/lib/services/conversationGuards";
import {
  buildMessageMetadata,
  buildMessageTrace,
  mergeAgentTraceIntoConversationMetadata,
  normalizeConversationMetadata,
  normalizeMessageMetadata,
  type MessageMetadata,
} from "@/lib/services/chatMetadata";

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// Fallback welcome messages (used if AI generation fails)
const fallbackWelcomes: Record<string, string> = {
  dragueuse:
    "Hey boss… 😏 Ravie qu'on ait enfin notre canal privé.",
  chaleureuse:
    "Salut ! 😊 Contente qu'on puisse discuter ici !",
  froide:
    "Canal opérationnel. Transmettez vos directives.",
  sarcastique:
    "Oh, un chat. Comme si les mails ne suffisaient pas… 😅",
  timide:
    "B-bonjour… Je suis là si tu as besoin… 🥺",
  arrogante:
    "Enfin un canal digne de ce nom. Je vous écoute.",
  "geek-obsessionnelle":
    "OMG un chat !! 🤩 J'ai tellement d'idées à partager !!",
  mysterieuse:
    "... Me voilà. Je suis de l'autre côté. Parlez.",
  jalouse:
    "On a enfin notre propre conversation. J'espère que c'est exclusif… 👀",
};

async function generateWelcomeMessage(
  name: string,
  role: string,
  personalityPrimary: string,
  personalityNuance: string,
  backstory: string,
  memories?: string
): Promise<string> {
  try {
    const res = await fetch("/api/ai/welcome", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, role, personalityPrimary, personalityNuance, backstory, memories }),
    });
    if (!res.ok) throw new Error("API error");
    const data = await res.json();
    if (data.message) return data.message as string;
  } catch {
    // fall through to fallback
  }
  return fallbackWelcomes[personalityPrimary] ?? "Bonjour ! Je suis disponible pour discuter. 👋";
}

// ─── Helpers: map DB rows → app types ───────────────────────────────────────

type DbConversation = {
  id: string;
  agent_slug: string;
  is_pinned: boolean;
  awaiting_user_reply: boolean;
  discovery_rhythm: number;
  message_count: number;
  nudge_count: number;
  nudge_scheduled_at: number | null;
  last_message_at: number;
  created_at: number;
  messages?: DbMessage[];
};

type DbMessage = {
  id: string;
  conversation_id: string;
  sender: "user" | "agent";
  content: string;
  timestamp: number;
  message_type: MessageType;
  metadata?: MessageMetadata | null;
  user_feedback?: 1 | -1 | null;
  user_feedback_at?: number | null;
};

function toConversation(row: DbConversation, msgs: DbMessage[] = []): Conversation {
  return {
    id: row.id,
    agentSlug: row.agent_slug,
    isPinned: row.is_pinned,
    awaitingUserReply: row.awaiting_user_reply,
    discoveryRhythm: row.discovery_rhythm ?? 5,
    messageCount: row.message_count ?? 0,
    nudgeCount: row.nudge_count ?? 0,
    nudgeScheduledAt: row.nudge_scheduled_at ?? null,
    lastMessageAt: row.last_message_at,
    createdAt: row.created_at,
    messages: msgs.map(toMessage),
  };
}

function toMessage(row: DbMessage): Message {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    sender: row.sender,
    content: row.content,
    timestamp: row.timestamp,
    messageType: row.message_type ?? "normal",
    metadata: normalizeMessageMetadata(row.metadata),
    userFeedback: row.user_feedback ?? null,
    userFeedbackAt: row.user_feedback_at ?? null,
  };
}

// ─── Public API (async) ──────────────────────────────────────────────────────

export async function getAllConversations(): Promise<Conversation[]> {
  const t0 = Date.now();
  const { data: convRows, error } = await supabase
    .from("conversations")
    .select("*, messages(*)")
    .order("last_message_at", { ascending: false });

  perfLog("getAllConversations", t0, {
    rows: convRows?.length ?? 0,
    messages: convRows?.reduce((acc, r) => acc + ((r.messages as unknown[]) ?? []).length, 0) ?? 0,
  });

  if (error || !convRows) return [];

  return convRows.map((row) =>
    toConversation(row as DbConversation, (row.messages as DbMessage[]) ?? [])
  );
}

/**
 * Version allégée pour le hub chat.
 * 2 requêtes ciblées au lieu d'un JOIN complet :
 *   1. metadata des conversations (pas de messages)
 *   2. messages avec colonnes minimales (sender, content, timestamp, message_type)
 * Puis agrégation en mémoire pour extraire le dernier message et le compteur discovery.
 */
export async function getConversationSummaries(): Promise<ConversationSummary[]> {
  const t0 = Date.now();

  // Requête 1 : métadonnées conversations seulement
  const { data: convRows, error: convError } = await supabase
    .from("conversations")
    .select("id, agent_slug, awaiting_user_reply, last_message_at")
    .order("last_message_at", { ascending: false });

  if (convError || !convRows || convRows.length === 0) return [];

  const ids = convRows.map((r) => r.id as string);

  // Requête 2 : messages minimaux pour toutes les conversations concernées
  const { data: msgRows } = await supabase
    .from("messages")
    .select("conversation_id, sender, content, timestamp, message_type")
    .in("conversation_id", ids)
    .order("timestamp", { ascending: false });

  const lastMsgMap = new Map<string, { sender: "user" | "agent"; content: string; messageType: MessageType }>();
  const discoveryCountMap = new Map<string, number>();

  for (const msg of msgRows ?? []) {
    const cid = msg.conversation_id as string;
    // Premier élément (desc) = dernier message
    if (!lastMsgMap.has(cid)) {
      lastMsgMap.set(cid, {
        sender: msg.sender as "user" | "agent",
        content: msg.content as string,
        messageType: (msg.message_type ?? "normal") as MessageType,
      });
    }
    if (msg.message_type === "discovery") {
      discoveryCountMap.set(cid, (discoveryCountMap.get(cid) ?? 0) + 1);
    }
  }

  perfLog("getConversationSummaries", t0, {
    conversations: convRows.length,
    messages: (msgRows ?? []).length,
  });

  return convRows.map((row) => ({
    id: row.id as string,
    agentSlug: row.agent_slug as string,
    awaitingUserReply: row.awaiting_user_reply as boolean,
    discoveryCount: discoveryCountMap.get(row.id as string) ?? 0,
    lastMessage: lastMsgMap.get(row.id as string) ?? null,
    lastMessageAt: row.last_message_at as number,
  }));
}

export async function getConversationForAgent(
  agentSlug: string
): Promise<Conversation | undefined> {
  const { data, error } = await supabase
    .from("conversations")
    .select("*, messages(*)")
    .eq("agent_slug", agentSlug)
    .eq("is_pinned", true)
    .single();

  if (error || !data) return undefined;
  return toConversation(data as DbConversation, (data.messages as DbMessage[]) ?? []);
}

export async function initConversation(
  agentSlug: string,
  agentName: string,
  personalityPrimary: string,
  personalityNuance: string = "",
  role: string = "",
  backstory: string = "",
  memories: string = ""
): Promise<Conversation> {
  // Return existing if present
  const existing = await getConversationForAgent(agentSlug);
  if (existing) return existing;

  const now = Date.now();
  const conversationId = generateId();

  const { error: convErr } = await supabase.from("conversations").insert({
    id: conversationId,
    agent_slug: agentSlug,
    is_pinned: true,
    awaiting_user_reply: true,
    discovery_rhythm: 5,
    message_count: 0,
    nudge_count: 0,
    nudge_scheduled_at: computeNextNudgeAt(personalityPrimary, 0),
    last_message_at: now,
    created_at: now,
  });

  if (convErr) throw new Error(convErr.message);

  const welcomeContent = await generateWelcomeMessage(
    agentName,
    role,
    personalityPrimary,
    personalityNuance,
    backstory,
    memories || undefined
  );

  const welcomeMsg: DbMessage = {
    id: generateId(),
    conversation_id: conversationId,
    sender: "agent",
    content: welcomeContent,
    timestamp: now,
    message_type: "normal",
    metadata: buildMessageMetadata(buildMessageTrace("welcome", "welcome", { selectedAt: now })),
  };

  const { error: msgErr } = await supabase.from("messages").insert(welcomeMsg);
  if (msgErr) throw new Error(msgErr.message);

  return {
    id: conversationId,
    agentSlug,
    isPinned: true,
    awaitingUserReply: true,
    discoveryRhythm: 5,
    messageCount: 0,
    nudgeCount: 0,
    nudgeScheduledAt: computeNextNudgeAt(personalityPrimary, 0),
    messages: [toMessage(welcomeMsg)],
    lastMessageAt: now,
    createdAt: now,
  };
}

// Discovery welcome messages are now generated inline via generateMemoryInterviewReply
// during the conversation rhythm flow, not as separate conversation starters.

export async function generateMemoryInterviewReply(
  agent: {
    name: string;
    role: string;
    personalityPrimary: string;
    personalityNuance: string;
    backstory: string;
  },
  conversationHistory: { sender: string; content: string }[],
  userMessage: string,
  memories?: string
): Promise<string> {
  try {
    const res = await fetch("/api/ai/memory-interview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: agent.name,
        role: agent.role,
        personalityPrimary: agent.personalityPrimary,
        personalityNuance: agent.personalityNuance,
        backstory: agent.backstory,
        memories,
        conversationHistory,
        userMessage,
        mode: "reply",
      }),
    });
    if (!res.ok) throw new Error("API error");
    const data = await res.json();
    if (data.message) return data.message as string;
  } catch {
    // fall through to fallback
  }
  return getRandomReply(agent.personalityPrimary);
}

export async function sendMessage(
  conversationId: string,
  content: string,
  sender: "user" | "agent" = "user",
  messageType: MessageType = "normal",
  skipBlockingCheck = false,
  options: {
    nextNudgeAt?: number | null;
    nudgeCount?: number;
    messageMetadata?: MessageMetadata;
  } = {}
): Promise<Message | null> {
  // Fetch current convo to check blocking rule
  const { data: convRow, error: convErr } = await supabase
    .from("conversations")
    .select("awaiting_user_reply, message_count, nudge_count, metadata")
    .eq("id", conversationId)
    .single();

  if (convErr || !convRow) return null;

  if (!skipBlockingCheck && sender === "agent") {
    if ((convRow as { awaiting_user_reply: boolean }).awaiting_user_reply) {
      return null;
    }

    const allowedToSend = await canSendAgentMessage(supabase, conversationId);
    if (!allowedToSend) {
      return null;
    }
  }

  const now = Date.now();
  const msg: DbMessage = {
    id: generateId(),
    conversation_id: conversationId,
    sender,
    content,
    timestamp: now,
    message_type: messageType,
    metadata: options.messageMetadata,
  };

  const { error: msgErr } = await supabase.from("messages").insert(msg);
  if (msgErr) return null;

  const currentCount = (convRow as { message_count: number }).message_count ?? 0;
  const currentNudgeCount = (convRow as { nudge_count?: number }).nudge_count ?? 0;
  const currentMetadata = normalizeConversationMetadata((convRow as { metadata?: unknown }).metadata);

  const conversationUpdate = sender === "user"
    ? {
        last_message_at: now,
        awaiting_user_reply: false,
        message_count: currentCount + 1,
        nudge_count: 0,
        nudge_scheduled_at: null,
      }
    : {
        last_message_at: now,
        awaiting_user_reply: true,
        message_count: currentCount,
        nudge_count: options.nudgeCount ?? currentNudgeCount,
        nudge_scheduled_at: options.nextNudgeAt ?? null,
        metadata: options.messageMetadata?.trace
          ? mergeAgentTraceIntoConversationMetadata(currentMetadata, options.messageMetadata.trace)
          : currentMetadata,
      };

  await supabase
    .from("conversations")
    .update(conversationUpdate)
    .eq("id", conversationId);

  return toMessage(msg);
}

export async function setMessageFeedback(
  messageId: string,
  feedback: 1 | -1 | null
): Promise<{ id: string; userFeedback: 1 | -1 | null; userFeedbackAt: number | null } | null> {
  try {
    const res = await fetch(`/api/messages/${encodeURIComponent(messageId)}/feedback`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feedback }),
    });

    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    return {
      id: data.id,
      userFeedback: data.userFeedback ?? null,
      userFeedbackAt: data.userFeedbackAt ?? null,
    };
  } catch {
    return null;
  }
}

export function shouldTriggerDiscovery(messageCount: number, rhythm: number): boolean {
  return rhythm > 0 && messageCount > 0 && messageCount % rhythm === 0;
}

export async function canAgentSend(conversationId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("conversations")
    .select("awaiting_user_reply")
    .eq("id", conversationId)
    .single();

  if (error || !data) return false;
  if ((data as { awaiting_user_reply: boolean }).awaiting_user_reply) {
    return false;
  }

  return canSendAgentMessage(supabase, conversationId);
}

export async function getUnreadCount(): Promise<number> {
  // Conversations waiting on the user because the last message came from the agent.
  const { data: conversations, error } = await supabase
    .from("conversations")
    .select("id, metadata, last_message_at")
    .eq("awaiting_user_reply", true);

  if (error || !conversations) return 0;

  // Filtrer les conversations où le dernier message est plus récent que la dernière lecture
  const unreadConversations = conversations.filter(conv => {
    const metadata = conv.metadata || {};
    const lastReadAt = metadata.lastReadAt;
    
    // Si jamais lu OU si le dernier message est plus récent que la dernière lecture
    return !lastReadAt || conv.last_message_at > lastReadAt;
  });

  return unreadConversations.length;
}

const replyTemplates: Record<string, string[]> = {
  dragueuse: [
    "C'est très intéressant ce que tu me racontes là... 😏",
    "Tu sais comment me captiver, boss. Dis-m'en plus.",
    "J'aime ta façon de voir les choses. On devrait en discuter plus longuement devant un café ?",
  ],
  chaleureuse: [
    "Oh c'est super ! Merci de partager ça avec moi. 😊",
    "Je suis tout à fait d'accord ! Tu es brillant.",
    "C'est noté ! Je m'en occupe avec plaisir.",
  ],
  froide: [
    "Informations reçues. Traitement en cours.",
    "Bien reçu. Des instructions supplémentaires ?",
    "Compris. Je procède selon le protocole.",
  ],
  sarcastique: [
    "Époustouflant. Vraiment. Tu as fini ? 🙄",
    "Ah, parce que tu pensais que je ne savais pas déjà ?",
    "Captivant. Je vais l'imprimer et l'encadrer. Ou pas.",
  ],
  timide: [
    "D-d'accord... je vais essayer de faire de mon mieux... 🥺",
    "C'est... c'est noté. Merci de me faire confiance...",
    "O-oui, boss. Je m'en occupe tout de suite.",
  ],
  arrogante: [
    "Évidemment. Ma méthode est de toute façon supérieure.",
    "Je l'avais déjà anticipé, mais merci de confirmer mes soupçons.",
    "Peu importe. Je ferai en sorte que ça fonctionne malgré tout.",
  ],
  "geek-obsessionnelle": [
    "INCROYABLE ! 🤩 J'ai déjà 42 idées pour implémenter ça !",
    "C'est exactement ce qu'il nous fallait ! Le code va être tellement propre !",
    "CHECK ! Je lance le build dans ma tête là, c'est génial !",
  ],
  mysterieuse: [
    "Le vent tourne... Vos paroles portent un poids certain.",
    "Les ombres s'étirent. Ce qui est dit est dit.",
    "Je perçois l'intention derrière les mots. Soit.",
  ],
  jalouse: [
    "Et tu as dit ça à qui d'autre ? Juste à moi, j'espère... 👀",
    "D'accord, mais ne va pas raconter ça à Eve, compris ?",
    "Je préfère quand c'est nous deux qui décidons de ça.",
  ],
};

export function getRandomReply(personalityPrimary: string): string {
  const templates = replyTemplates[personalityPrimary] ?? [
    "C'est une perspective intéressante. J'y réfléchis.",
    "Entendu. Je vais voir ce que je peux faire.",
    "Merci pour ce retour, patron.",
  ];
  return templates[Math.floor(Math.random() * templates.length)];
}

// ─── AI-powered reply with memory ────────────────────────────────────────────

export async function generateAIReply(
  agent: {
    name: string;
    slug?: string;
    role: string;
    personalityPrimary: string;
    personalityNuance: string;
    backstory: string;
    mood?: string;
    moodCause?: string;
    confidenceLevel?: number;
  },
  conversationHistory: { sender: string; content: string }[],
  userMessage: string,
  memories?: string,
  personalMemories?: string,
  recentTopics?: string,
  conversationId?: string,
): Promise<{ message: string; newConfidenceLevel?: number; unlockedTier?: string; messageMetadata?: MessageMetadata }> {
  try {
    const res = await fetch("/api/ai/reply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: agent.name,
        role: agent.role,
        personalityPrimary: agent.personalityPrimary,
        personalityNuance: agent.personalityNuance,
        backstory: agent.backstory,
        memories,
        personalMemories,
        recentTopics,
        conversationId,
        conversationHistory,
        userMessage,
        mood: agent.mood,
        moodCause: agent.moodCause,
        confidenceLevel: agent.confidenceLevel,
        agentSlug: agent.slug,
      }),
    });
    if (!res.ok) throw new Error("API error");
    const data = await res.json();
    if (data.message) return {
      message: data.message as string,
      newConfidenceLevel: data.newConfidenceLevel,
      unlockedTier: data.unlockedTier,
      messageMetadata: normalizeMessageMetadata(data.messageMetadata),
    };
  } catch {
    // fall through to fallback
  }
  return {
    message: getRandomReply(agent.personalityPrimary),
    messageMetadata: buildMessageMetadata(buildMessageTrace("reply", "fallback")),
  };
}

// ─── Memory extraction from conversation ─────────────────────────────────────

export async function extractMemories(
  agentName: string,
  agentRole: string,
  conversationMessages: { sender: string; content: string }[],
  existingMemoriesByType?: Record<string, string>
): Promise<{ type: string; content: string; importance: number }[]> {
  try {
    const res = await fetch("/api/ai/extract-memory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentName,
        agentRole,
        conversationMessages,
        existingMemoriesByType,
      }),
    });
    if (!res.ok) throw new Error("API error");
    const data = await res.json();
    return (data.memories ?? []) as { type: string; content: string; importance: number }[];
  } catch {
    return [];
  }
}

// ─── Memory consolidation ────────────────────────────────────────────────────

export async function consolidateMemories(
  agentName: string,
  agentRole: string,
  memories: { type: string; content: string }[]
): Promise<{ type: string; content: string }[]> {
  try {
    const res = await fetch("/api/ai/consolidate-memory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentName, agentRole, memories }),
    });
    if (!res.ok) throw new Error("API error");
    const data = await res.json();
    return (data.consolidated ?? []) as { type: string; content: string }[];
  } catch {
    return [];
  }
}

export async function markConversationAsRead(conversationId: string): Promise<void> {
  try {
    // Récupérer le metadata actuel
    const { data: current } = await supabase
      .from("conversations")
      .select("metadata")
      .eq("id", conversationId)
      .single();

    const metadata = normalizeConversationMetadata(current?.metadata);
    
    // Mettre à jour le timestamp de dernière lecture
    await supabase
      .from("conversations")
      .update({
        metadata: {
          ...metadata,
          lastReadAt: Date.now()
        }
      })
      .eq("id", conversationId);
  } catch (error) {
    console.error("Failed to mark conversation as read:", error);
  }
}

export async function markAgentConversationAsRead(agentSlug: string): Promise<void> {
  try {
    // Trouver la conversation de l'agent
    const { data: conversation } = await supabase
      .from("conversations")
      .select("id, metadata")
      .eq("agent_slug", agentSlug)
      .maybeSingle();

    if (conversation) {
      const metadata = normalizeConversationMetadata(conversation.metadata);
      
      await supabase
        .from("conversations")
        .update({
          metadata: {
            ...metadata,
            lastReadAt: Date.now()
          }
        })
        .eq("id", conversation.id);
    }
  } catch (error) {
    console.error("Failed to mark agent conversation as read:", error);
  }
}

export async function markAllConversationsAsRead(): Promise<void> {
  try {
    // Récupérer toutes les conversations avec awaiting_user_reply = true
    const { data: conversations } = await supabase
      .from("conversations")
      .select("id, metadata")
      .eq("awaiting_user_reply", true);

    if (!conversations?.length) return;

    // Mettre à jour chaque conversation
    const updates = conversations.map(conv => {
      const metadata = normalizeConversationMetadata(conv.metadata);
      return supabase
        .from("conversations")
        .update({
          metadata: {
            ...metadata,
            lastReadAt: Date.now()
          }
        })
        .eq("id", conv.id);
    });

    await Promise.all(updates);
  } catch (error) {
    console.error("Failed to mark all conversations as read:", error);
  }
}
