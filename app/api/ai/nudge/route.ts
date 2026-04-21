import { NextResponse } from "next/server";
import { LLM_MODELS } from "@/lib/config/llm";
import { buildConversationCoreRules, buildTopicTintBlock } from "@/lib/prompts/conversationCore";
import { MAX_NUDGES, computeNextNudgeAt } from "@/lib/config/nudgeConfig";
import { buildMemoryContextState, type AgentMemory } from "@/lib/services/memoryService";
import { topicReservoirService } from "@/lib/services/topicReservoirService";
import { scenarioHistoryService } from "@/lib/services/scenarioHistoryService";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { buildMessageMetadata, buildMessageTrace, mergeAgentTraceIntoConversationMetadata } from "@/lib/services/chatMetadata";
import { countTrailingAgentMessages, MAX_CONSECUTIVE_AGENT_MESSAGES } from "@/lib/services/conversationGuards";
import { normalizeConversationMessage } from "@/lib/services/conversationMessageService";

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

function getPersonalitySeedBank(personalityPrimary: string, personalityNuance?: string | null): string[] {
  const text = `${personalityPrimary} ${personalityNuance ?? ""}`.toLowerCase();

  if (/(sarcast|taquin|provoc|rebelle|jalous|rivale)/.test(text)) {
    return [
      "Relance avec une petite pique legere et une question concrete, sans mechancete.",
      "Reprends contact avec une ironie douce, comme si tu testais s'il suit encore.",
      "Fais une relance breve, joueuse et un peu mordante, mais tres naturelle.",
    ];
  }

  if (/(chaleur|empath|maternel|loyal|optimist|admirat)/.test(text)) {
    return [
      "Relance avec une chaleur simple, comme si tu prenais juste des nouvelles sans insister.",
      "Envoie une relance douce et concrete, avec une petite attention humaine.",
      "Reprends le fil avec une presence rassurante et une question tres banale.",
    ];
  }

  if (/(froid|stoique|analyt|franche|direct|perfection)/.test(text)) {
    return [
      "Relance sobre et directe, une seule question simple, pas de fioriture.",
      "Fais une relance courte, nette et credible, sans image inutile.",
      "Reprends contact avec une formule simple et precise, tres peu d'affect.",
    ];
  }

  if (/(timid|vulnerab|soumis|hesitant)/.test(text)) {
    return [
      "Relance doucement, un peu hesitante si besoin, mais claire et concrete.",
      "Fais une relance simple, presque discrete, comme pour verifier si c'est le bon moment.",
      "Reprends contact sans forcer, avec une petite question tres accessible.",
    ];
  }

  if (/(myster|melanc|curieu|creative|disper|solaire|express|geek)/.test(text)) {
    return [
      "Relance avec une petite couleur personnelle ou image legere, mais reste tres naturelle.",
      "Reprends le fil avec une energie un peu singuliere, sans partir dans une scene.",
      "Fais une relance vivante et concrete, avec une petite touche perso mais sans monologue.",
    ];
  }

  return [
    "Relance avec une question simple mais un peu situee, pas vide, comme si tu reprenais doucement contact.",
    "Fais une relance courte avec une petite couleur humaine, pas juste une formule interchangeable.",
    "Envoie une relance banale mais un peu incarnee, comme si tu voulais juste reprendre le fil sans forcer.",
  ];
}

function buildFallbackNudge(seed: string): string {
  return seed.length <= 140 ? seed : `${seed.slice(0, 137).trimEnd()}...`;
}

function buildNonScenarioSeed(params: {
  history: MessageRow[];
  memories: AgentMemory[];
  agent: AgentRow;
}): string {
  const { history, memories, agent } = params;

  const lastUserMessage = [...history].reverse().find((message) => message.sender === "user")?.content?.trim();
  if (lastUserMessage) {
    return `Rebondis naturellement sur ce que le boss disait: ${lastUserMessage}`;
  }

  const recentTopic = memories.find((memory) => memory.memory_type === "topic_tracker")?.content?.trim();
  if (recentTopic) {
    return `Relance legerement autour de ce theme deja ouvert: ${recentTopic}`;
  }

  const personalitySeeds = getPersonalitySeedBank(agent.personality_primary, agent.personality_nuance);
  const fallbackSeed = personalitySeeds[history.length % personalitySeeds.length];
  return `${agent.name} reprend la conversation. ${fallbackSeed} Evite completement les relances vides comme "tu fais quoi là ?".`;
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
  scenarioSeed?: string;
  memories: AgentMemory[];
}): Promise<string> {
  const { agent, history, seed, scenarioSeed, memories } = params;
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

  const topicTintBlock = scenarioSeed
    ? buildTopicTintBlock({
        title: "nudge_topic",
        situation: scenarioSeed,
        subtext: "legere impulsion sociale",
        mood: "leger",
      })
    : "";

  let systemPrompt = `Tu écris UNE relance naturelle de messagerie pour ${agent.name}.
Personnalité: ${agent.personality_primary}${agent.personality_nuance ? `, nuance: ${agent.personality_nuance}` : ""}.
Role: ${agent.role}.
Backstory: ${agent.backstory ?? ""}${topicTintBlock}`;

  systemPrompt += `

${buildConversationCoreRules()}

Objectif:
- Relancer après un silence de quelques minutes.
- Le message doit sembler spontané, pas systemique.
- Ne fais jamais de reproche sur l'absence de réponse.
- Ne dis jamais que tu "relances" ou que cela fait longtemps.
- Le studio est seulement en toile de fond. Ne parle pas de dev, de projet ou de technique sauf si le contexte recent l'impose vraiment.
- Cree juste une petite impulsion humaine simple: question concrete, remarque breve, invitation legere, confidence minuscule ou taquinerie legere.
- Si une teinte est fournie, elle doit rester faible et presque invisible.
- Interdit: monologue abstrait, pitch produit, brainstorming hors-sol, texte qui sonne écrit, bruitages, mise en scène, roleplay envahissant.
- Evite les messages trop vides ou trop generiques comme "tu fais quoi là ?". Un simple emoji seul n'est acceptable que si la personnalite le rend vraiment credible.
- N'utilise jamais de placeholders ou crochets de remplissage du type [prenom], [nom], [collegue], [quelque chose].
- N'ecris jamais de fragments narratifs residuels comme "regarde mon telephone" ou "hausse les epaules".
- Si le dernier signal du user etait faible ou minimal, n'invente ni scene, ni hypothese precise, ni imaginaire detaille. Reste au ras de l'echange.
- Une seule impulsion sociale claire par message.
- 1 a 2 phrases max.
- 45 tokens max.
- Francais uniquement.
- Reste leger, humain, banal, specifique.

${scenarioSeed ? 'Inspiration:' : 'Seed conversationnel a reutiliser librement:'}
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

    const normalized = normalizeConversationMessage(normalizeNudgeMessage(content), { mode: "nudge" });
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
    const supabase = getSupabaseAdminClient();
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

      const trailingAgentMessages = await countTrailingAgentMessages(supabase, conversation.id);
      if (trailingAgentMessages >= MAX_CONSECUTIVE_AGENT_MESSAGES) {
        await supabase
          .from("conversations")
          .update({ nudge_scheduled_at: null })
          .eq("id", conversation.id);
        continue;
      }

      const { data: memoryRows } = await supabase
        .from("agent_memory")
        .select("*")
        .eq("agent_slug", agent.slug)
        .order("importance", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(12);

      // Logique Topic Reservoir
      let seed = "";
      let scenarioSeed = "";
      let selectedScenarioId: number | null = null;
      
      // Récupérer les scénarios déjà utilisés
      const usedScenarioIds = await scenarioHistoryService.getUsedScenarioIds(conversation.id, supabase);
      
      // Essayer de trouver un scénario adapté
      const scenario = topicReservoirService.getScenarioForAgent(
        agent.personality_primary,
        agent.confidence_level ?? 0,
        usedScenarioIds
      );
      
      if (scenario) {
        // Formater une teinte discrete plutot qu'un script a jouer
        scenarioSeed = `TITRE : ${scenario.title}\nSITUATION : ${scenario.situation}\nSOUS-TEXTE : ${scenario.subtext}\nENERGIE : ${scenario.mood}\nEXEMPLES DISCRETS : ${scenario.examples.join(', ')}`;
        
        // Utiliser un exemple aléatoire comme seed de base
        const randomExample = scenario.examples[Math.floor(Math.random() * scenario.examples.length)];
        seed = randomExample;
        selectedScenarioId = scenario.id;
      } else {
        seed = buildNonScenarioSeed({
          history,
          memories: (memoryRows ?? []) as AgentMemory[],
          agent,
        });
      }

      const message = await generateNudgeMessage({
        agent,
        history,
        seed,
        scenarioSeed: scenarioSeed || undefined,
        memories: (memoryRows ?? []) as AgentMemory[],
      });

      const timestamp = Date.now();
      const messageId = `${timestamp}-${Math.random().toString(36).slice(2, 9)}`;
      const messageMetadata = buildMessageMetadata(
        selectedScenarioId !== null
          ? buildMessageTrace("nudge", "topic_reservoir", {
              scenarioId: selectedScenarioId,
              scenarioTitle: scenario?.title ?? null,
              selectedAt: timestamp,
            })
          : buildMessageTrace("nudge", "seed_nudge", { selectedAt: timestamp })
      );

      const { error: messageError } = await supabase
        .from("messages")
        .insert({
          id: messageId,
          conversation_id: conversation.id,
          sender: "agent",
          content: message,
          timestamp,
          message_type: "normal",
          metadata: messageMetadata,
        });

      if (messageError) {
        await supabase
          .from("conversations")
          .update({ nudge_scheduled_at: conversation.nudge_scheduled_at })
          .eq("id", conversation.id);
        continue;
      }

      const { data: updatedConversation } = await supabase
        .from("conversations")
        .select("metadata")
        .eq("id", conversation.id)
        .single();

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
          metadata: mergeAgentTraceIntoConversationMetadata(updatedConversation?.metadata, messageMetadata.trace!),
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
