import { supabase } from "@/lib/supabase/client";

export type MemoryType =
  | "summary" | "decision" | "preference" | "progress"
  | "relationship" | "nickname" | "confidence" | "boss_profile"
  | "family" | "hobbies" | "dreams" | "social" | "fears"
  | "personal_event" | "topic_tracker";

export interface ExtractedMemoryInput {
  type: MemoryType;
  content: string;
  importance: number;
}

export interface MemoryContextState {
  promptMemories: string;
  personalMemories: string;
  recentTopics: string;
  memoriesByType: Record<string, string>;
}

const SHORT_TERM_MEMORY_TYPES: MemoryType[] = ["topic_tracker"];
const SHORT_TERM_TOPIC_LIMIT = 8;
const CONSOLIDATABLE_TYPES: MemoryType[] = [
  "summary",
  "decision",
  "preference",
  "progress",
  "boss_profile",
  "family",
  "hobbies",
  "dreams",
  "social",
  "fears",
  "personal_event",
];

/**
 * Singleton types: only one entry per agent is kept.
 * When a new one is extracted, it replaces the old instead of appending.
 */
export const SINGLETON_TYPES: MemoryType[] = ["relationship", "nickname", "confidence"];

export interface AgentMemory {
  id: string;
  agent_slug: string;
  memory_type: MemoryType;
  content: string;
  importance: number; // 1-5
  source_conversation_id: string | null;
  created_at: string;
  updated_at: string;
}

function normaliseMemoryContent(content: string): string {
  return content
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function isShortTermMemoryType(memoryType: MemoryType): boolean {
  return SHORT_TERM_MEMORY_TYPES.includes(memoryType);
}

function isConsolidatableMemoryType(memoryType: MemoryType): boolean {
  return CONSOLIDATABLE_TYPES.includes(memoryType);
}

function dedupeMemoryEntries(
  existingMemories: AgentMemory[],
  entries: {
    agent_slug: string;
    memory_type: MemoryType;
    content: string;
    importance?: number;
    source_conversation_id?: string;
  }[]
) {
  const existingKeys = new Set(
    existingMemories.map((memory) => `${memory.memory_type}::${normaliseMemoryContent(memory.content)}`)
  );
  const seenKeys = new Set<string>();

  return entries.filter((entry) => {
    const normalised = normaliseMemoryContent(entry.content);
    if (!normalised) return false;

    const dedupeKey = `${entry.memory_type}::${normalised}`;

    if (SINGLETON_TYPES.includes(entry.memory_type)) {
      if (seenKeys.has(dedupeKey)) return false;
      seenKeys.add(dedupeKey);
      return true;
    }

    if (existingKeys.has(dedupeKey) || seenKeys.has(dedupeKey)) {
      return false;
    }

    seenKeys.add(dedupeKey);
    return true;
  });
}

async function pruneShortTermMemories(agentSlug: string): Promise<void> {
  const { data, error } = await supabase
    .from("agent_memory")
    .select("id")
    .eq("agent_slug", agentSlug)
    .eq("memory_type", "topic_tracker")
    .order("created_at", { ascending: false });

  if (error || !data || data.length <= SHORT_TERM_TOPIC_LIMIT) return;

  const idsToDelete = data.slice(SHORT_TERM_TOPIC_LIMIT).map((row) => row.id);
  if (idsToDelete.length === 0) return;

  const { error: deleteError } = await supabase
    .from("agent_memory")
    .delete()
    .in("id", idsToDelete);

  if (deleteError) {
    console.error("Failed to prune short-term memories:", deleteError.message);
  }
}

async function requestMemoryConsolidation(
  agentName: string,
  agentRole: string,
  memories: { type: MemoryType; content: string; importance?: number }[]
): Promise<{ type: MemoryType; content: string; importance: number }[]> {
  try {
    const res = await fetch("/api/ai/consolidate-memory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentName, agentRole, memories }),
    });
    if (!res.ok) throw new Error("API error");
    const data = await res.json();
    return (data.consolidated ?? []) as { type: MemoryType; content: string; importance: number }[];
  } catch {
    return [];
  }
}

export function buildMemoryContextState(memories: AgentMemory[]): MemoryContextState {
  return {
    promptMemories: formatMemoriesForPrompt(memories),
    personalMemories: formatPersonalMemories(memories),
    recentTopics: formatRecentTopics(memories),
    memoriesByType: buildMemoriesByType(memories),
  };
}

export async function processExtractedMemories(params: {
  agentSlug: string;
  agentName: string;
  agentRole: string;
  extractedMemories: ExtractedMemoryInput[];
  existingMemories: AgentMemory[];
  sourceConversationId?: string;
}): Promise<AgentMemory[]> {
  const { agentSlug, agentName, agentRole, extractedMemories, existingMemories, sourceConversationId } = params;

  const filteredEntries = dedupeMemoryEntries(
    existingMemories,
    extractedMemories.map((memory) => ({
      agent_slug: agentSlug,
      memory_type: memory.type,
      content: memory.content,
      importance: memory.importance,
      source_conversation_id: sourceConversationId,
    }))
  );

  if (filteredEntries.length > 0) {
    await saveAgentMemories(filteredEntries);
  }

  await pruneShortTermMemories(agentSlug);

  let updatedMemories = await getAgentMemories(agentSlug);

  if (await needsConsolidation(agentSlug)) {
    const durableMemories = updatedMemories
      .filter((memory) => isConsolidatableMemoryType(memory.memory_type))
      .map((memory) => ({
        type: memory.memory_type,
        content: memory.content,
        importance: memory.importance,
      }));

    if (durableMemories.length > 0) {
      const consolidated = await requestMemoryConsolidation(agentName, agentRole, durableMemories);
      if (consolidated.length > 0) {
        await replaceMemoriesWithConsolidated(
          agentSlug,
          consolidated.map((memory) => ({
            memory_type: memory.type,
            content: memory.content,
            importance: memory.importance,
          }))
        );
        updatedMemories = await getAgentMemories(agentSlug);
      }
    }
  }

  return updatedMemories;
}

/**
 * Get all memories for a given agent, sorted by importance desc then newest first.
 */
export async function getAgentMemories(agentSlug: string): Promise<AgentMemory[]> {
  const { data, error } = await supabase
    .from("agent_memory")
    .select("*")
    .eq("agent_slug", agentSlug)
    .order("importance", { ascending: false })
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data as AgentMemory[];
}

/**
 * Save a new memory entry for an agent (non-singleton).
 */
export async function saveAgentMemory(
  agentSlug: string,
  memoryType: MemoryType,
  content: string,
  importance = 3,
  sourceConversationId?: string
): Promise<AgentMemory | null> {
  const { data, error } = await supabase
    .from("agent_memory")
    .insert({
      agent_slug: agentSlug,
      memory_type: memoryType,
      content,
      importance,
      source_conversation_id: sourceConversationId ?? null,
    })
    .select()
    .single();

  if (error || !data) return null;
  return data as AgentMemory;
}

/**
 * Upsert a singleton memory (relationship, nickname, confidence).
 * Deletes the existing entry for this type and inserts the new state.
 */
export async function upsertSingletonMemory(
  agentSlug: string,
  memoryType: MemoryType,
  content: string,
  importance = 3,
  sourceConversationId?: string
): Promise<void> {
  // Remove existing singleton entry for this type
  await supabase
    .from("agent_memory")
    .delete()
    .eq("agent_slug", agentSlug)
    .eq("memory_type", memoryType);

  // Insert the new current state
  const { error } = await supabase.from("agent_memory").insert({
    agent_slug: agentSlug,
    memory_type: memoryType,
    content,
    importance,
    source_conversation_id: sourceConversationId ?? null,
  });

  if (error) {
    console.error(`Failed to upsert singleton memory [${memoryType}]:`, error.message);
  }
}

/** Soft cap: consolidation triggers when non-singleton memories exceed this count. */
const CONSOLIDATION_THRESHOLD = 15;

/**
 * Save multiple memory entries at once.
 * Automatically routes singleton types to upsert instead of append.
 */
export async function saveAgentMemories(
  entries: {
    agent_slug: string;
    memory_type: MemoryType;
    content: string;
    importance?: number;
    source_conversation_id?: string;
  }[]
): Promise<void> {
  if (entries.length === 0) return;

  const singletons = entries.filter((e) => SINGLETON_TYPES.includes(e.memory_type));
  const regulars = entries.filter((e) => !SINGLETON_TYPES.includes(e.memory_type));

  // Upsert singletons sequentially to avoid race conditions
  for (const s of singletons) {
    await upsertSingletonMemory(
      s.agent_slug,
      s.memory_type,
      s.content,
      s.importance ?? 3,
      s.source_conversation_id
    );
  }

  // Bulk insert regular memories
  if (regulars.length > 0) {
    const rows = regulars.map((e) => ({
      agent_slug: e.agent_slug,
      memory_type: e.memory_type,
      content: e.content,
      importance: e.importance ?? 3,
      source_conversation_id: e.source_conversation_id ?? null,
    }));
    const { error } = await supabase.from("agent_memory").insert(rows);
    if (error) {
      console.error("Failed to save agent memories:", error.message);
    }
  }
}

/**
 * Check if an agent's memory needs consolidation (non-singleton entries only).
 */
export async function needsConsolidation(agentSlug: string): Promise<boolean> {
  const { count, error } = await supabase
    .from("agent_memory")
    .select("id", { count: "exact", head: true })
    .eq("agent_slug", agentSlug)
    .in("memory_type", CONSOLIDATABLE_TYPES);

  if (error || !count) return false;
  return count > CONSOLIDATION_THRESHOLD;
}

/**
 * Replace all existing memories with consolidated ones.
 * Singleton types are kept separate and upserted.
 */
export async function replaceMemoriesWithConsolidated(
  agentSlug: string,
  consolidated: { memory_type: MemoryType; content: string; importance?: number }[]
): Promise<void> {
  // Delete only durable consolidatable memories.
  const { error: delErr } = await supabase
    .from("agent_memory")
    .delete()
    .eq("agent_slug", agentSlug)
    .in("memory_type", CONSOLIDATABLE_TYPES);

  if (delErr) {
    console.error("Failed to delete old memories:", delErr.message);
    return;
  }

  if (consolidated.length > 0) {
    const singletons = consolidated.filter((c) => SINGLETON_TYPES.includes(c.memory_type));
    const regulars = consolidated.filter((c) => !SINGLETON_TYPES.includes(c.memory_type));

    // Upsert singletons from consolidated set
    for (const s of singletons) {
      await upsertSingletonMemory(agentSlug, s.memory_type, s.content, s.importance ?? 3);
    }

    // Insert regular consolidated memories
    if (regulars.length > 0) {
      const rows = regulars.map((c) => ({
        agent_slug: agentSlug,
        memory_type: c.memory_type,
        content: c.content,
        importance: c.importance ?? 3,
        source_conversation_id: null,
      }));
      const { error: insErr } = await supabase.from("agent_memory").insert(rows);
      if (insErr) console.error("Failed to insert consolidated memories:", insErr.message);
    }
  }
}

/**
 * Build a structured map of current memory content by type.
 * Used to pass to the extract-memory API so it can avoid duplicates.
 */
export function buildMemoriesByType(memories: AgentMemory[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const mem of memories) {
    if (isShortTermMemoryType(mem.memory_type)) continue;

    if (SINGLETON_TYPES.includes(mem.memory_type)) {
      // Singleton: just the single current value
      result[mem.memory_type] = mem.content;
    } else {
      // Non-singleton: concatenate all entries (most recent first, limited)
      const existing = result[mem.memory_type];
      if (!existing) {
        result[mem.memory_type] = mem.content;
      } else {
        result[mem.memory_type] = `${existing} | ${mem.content}`;
      }
    }
  }
  return result;
}

/**
 * Format memories into a readable context block for AI prompts.
 * Limits to the most important+recent memories to avoid exceeding token limits.
 */
export function formatMemoriesForPrompt(memories: AgentMemory[], maxEntries = 20): string {
  const durableMemories = memories.filter((memory) => !isShortTermMemoryType(memory.memory_type));
  if (durableMemories.length === 0) return "";

  // Already sorted by importance desc, created_at desc from DB
  const limited = durableMemories.slice(0, maxEntries);

  const grouped: Record<string, string[]> = {};
  for (const mem of limited) {
    const label = memoryTypeLabel(mem.memory_type);
    if (!grouped[label]) grouped[label] = [];
    grouped[label].push(mem.content);
  }

  const sections = Object.entries(grouped).map(
    ([label, items]) => `[${label}]\n${items.map((i) => `- ${i}`).join("\n")}`
  );

  return sections.join("\n\n");
}

function memoryTypeLabel(type: MemoryType): string {
  switch (type) {
    case "summary": return "Sujets abordés";
    case "decision": return "Décisions prises";
    case "preference": return "Préférences du boss";
    case "progress": return "Avancement des projets";
    case "relationship": return "Relation avec le boss";
    case "nickname": return "Surnoms";
    case "confidence": return "Évolution de la confiance";
    case "boss_profile": return "Ce que tu sais de lui (vie perso, goûts, habitudes)";
    case "family": return "Ma famille & origines";
    case "hobbies": return "Mes passions & hobbies";
    case "dreams": return "Mes rêves & aspirations";
    case "social": return "Mes amis & vie sociale";
    case "fears": return "Mes peurs & vulnérabilités";
    case "personal_event": return "Événements récents de ma vie";
    case "topic_tracker": return "Sujets récemment abordés";
  }
}

/** Personal life memory types — agent's own life details. */
const PERSONAL_LIFE_TYPES: MemoryType[] = ["family", "hobbies", "dreams", "social", "fears", "personal_event"];

/**
 * Format only personal-life memories for the dedicated prompt block.
 */
export function formatPersonalMemories(memories: AgentMemory[]): string {
  const personal = memories.filter((m) => PERSONAL_LIFE_TYPES.includes(m.memory_type));
  if (personal.length === 0) return "";

  const grouped: Record<string, string[]> = {};
  for (const mem of personal) {
    const label = memoryTypeLabel(mem.memory_type);
    if (!grouped[label]) grouped[label] = [];
    grouped[label].push(mem.content);
  }

  return Object.entries(grouped)
    .map(([label, items]) => `[${label}]\n${items.map((i) => `- ${i}`).join("\n")}`)
    .join("\n\n");
}

/**
 * Format topic tracker memories as a simple list for anti-repetition context.
 */
export function formatRecentTopics(memories: AgentMemory[]): string {
  const topics = memories
    .filter((m) => m.memory_type === "topic_tracker")
    .slice(0, SHORT_TERM_TOPIC_LIMIT);
  if (topics.length === 0) return "";
  return topics.map((t) => `- ${t.content}`).join("\n");
}


/**
 * Get all memories for a given agent, newest first.
 */
/**
 * Get the latest nickname the agent has for the boss (or vice versa).
 */
export async function getAgentNickname(agentSlug: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("agent_memory")
    .select("content")
    .eq("agent_slug", agentSlug)
    .eq("memory_type", "nickname")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;
  return (data as { content: string }).content;
}

/**
 * Calculate confidence delta from recent confidence memories and return suggested level change.
 */
export function calculateConfidenceDelta(confidenceMemories: AgentMemory[]): number {
  let delta = 0;
  for (const mem of confidenceMemories) {
    const content = mem.content.toLowerCase();
    if (content.includes("+confiance") || content.includes("positif") || content.includes("complicité") || content.includes("confie")) {
      delta += 3;
    } else if (content.includes("-confiance") || content.includes("tension") || content.includes("froid") || content.includes("ignore")) {
      delta -= 2;
    } else {
      delta += 1; // neutral confidence interaction is slightly positive
    }
  }
  return delta;
}
