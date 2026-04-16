import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { callOpenRouter, LLM_MODELS } from "@/lib/config/llm";
import { buildStudioContext } from "@/lib/services/studioContextService";
import { NO_DIDASCALIE_RULE, TEXTING_STYLE_RULE, EMOJI_RULES, NICKNAME_RULES, buildTimeContext } from "@/lib/prompts/rules";

// ─── Config ───────────────────────────────────────────────────────────────────
const MIN_IDLE_MS = 30 * 60 * 1000;         // 30 min without user activity
const MIN_BETWEEN_SPONTANEOUS_MS = 20 * 60 * 1000; // 20 min between two spontaneous from same agent
const MAX_PENDING = 2;                        // max consecutive agent messages without user reply

type SpontaneousType = "idle" | "thinking_of_you" | "personal" | "memory_callback";

function pickType(confidenceLevel: number, hasMemories: boolean): SpontaneousType {
  const types: SpontaneousType[] = ["idle", "thinking_of_you", "personal"];
  if (hasMemories) types.push("memory_callback");
  if (confidenceLevel >= 40) types.push("thinking_of_you", "thinking_of_you");
  if (confidenceLevel >= 60) types.push("personal", "memory_callback");
  return types[Math.floor(Math.random() * types.length)];
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// Server-side Supabase client (uses NEXT_PUBLIC_ vars, works server-side too)
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabase();
  const now = Date.now();
  const results: { agent: string; sent: boolean; reason?: string }[] = [];

  try {
    // Fetch all active agents with their conversations
    const { data: agents, error: agentsErr } = await supabase
      .from("agents")
      .select("slug, name, role, backstory, personality_primary, personality_nuance, gender, confidence_level, mood, mood_cause, status")
      .in("status", ["actif", "active", "recruté", "onboarding"]);

    if (agentsErr || !agents?.length) {
      return NextResponse.json({ ok: true, sent: 0, results: [] });
    }

    // Fetch all conversations with their last few messages
    const { data: conversations, error: convErr } = await supabase
      .from("conversations")
      .select("id, agent_slug, last_message_at, awaiting_user_reply")
      .in("agent_slug", agents.map((a) => a.slug))
      .eq("is_pinned", true);

    if (convErr || !conversations?.length) {
      return NextResponse.json({ ok: true, sent: 0, results: [] });
    }

    const convBySlug = Object.fromEntries(conversations.map((c) => [c.agent_slug, c]));

    // Fetch agent memories
    const { data: allMemories } = await supabase
      .from("agent_memory")
      .select("agent_slug, content, memory_type, importance")
      .in("agent_slug", agents.map((a) => a.slug))
      .order("importance", { ascending: false });

    const memoriesBySlug: Record<string, string> = {};
    if (allMemories) {
      for (const mem of allMemories) {
        if (!memoriesBySlug[mem.agent_slug]) memoriesBySlug[mem.agent_slug] = "";
        memoriesBySlug[mem.agent_slug] += `[${mem.memory_type}] ${mem.content}\n`;
      }
    }

    // Fetch last 3 messages per conversation to count pending
    const convIds = conversations.map((c) => c.id);
    const pendingByConv: Record<string, number> = {};
    const lastSpontaneousByConv: Record<string, number> = {};

    for (const convId of convIds) {
      const { data: msgs } = await supabase
        .from("messages")
        .select("sender, timestamp, message_type")
        .eq("conversation_id", convId)
        .order("timestamp", { ascending: false })
        .limit(5);

      if (!msgs?.length) {
        pendingByConv[convId] = 0;
        lastSpontaneousByConv[convId] = 0;
        continue;
      }

      // Count consecutive agent messages from the end (pending count)
      let pending = 0;
      for (const msg of msgs) {
        if (msg.sender === "agent") pending++;
        else break;
      }
      pendingByConv[convId] = pending;

      // Find last spontaneous message timestamp (agent messages after user's last message)
      lastSpontaneousByConv[convId] = pending > 0 ? msgs[0].timestamp : 0;
    }

    // Build studio context once for all agents
    const studio = await buildStudioContext();

    let sentCount = 0;

    for (const agent of agents) {
      const conv = convBySlug[agent.slug];
      if (!conv) {
        results.push({ agent: agent.slug, sent: false, reason: "no_conversation" });
        continue;
      }

      const idleMs = now - (conv.last_message_at ?? 0);
      const pendingCount = pendingByConv[conv.id] ?? 0;
      const lastSpontaneous = lastSpontaneousByConv[conv.id] ?? 0;
      const timeSinceLastSpontaneous = now - lastSpontaneous;

      // Eligibility checks
      if (idleMs < MIN_IDLE_MS) {
        results.push({ agent: agent.slug, sent: false, reason: `too_recent_${Math.round(idleMs / 60000)}min` });
        continue;
      }
      if (pendingCount >= MAX_PENDING) {
        results.push({ agent: agent.slug, sent: false, reason: `max_pending_${pendingCount}` });
        continue;
      }
      if (pendingCount > 0 && timeSinceLastSpontaneous < MIN_BETWEEN_SPONTANEOUS_MS) {
        results.push({ agent: agent.slug, sent: false, reason: `cooldown_${Math.round(timeSinceLastSpontaneous / 60000)}min` });
        continue;
      }

      // Generate spontaneous message
      const memories = memoriesBySlug[agent.slug] ?? "";
      const cl = agent.confidence_level ?? 0;
      const type = pickType(cl, memories.length > 0);

      const memoryBlock = memories ? `\nCe que tu sais de ton boss :\n${memories}` : "";
      const moodBlock = agent.mood && agent.mood !== "neutre"
        ? `\nTon humeur actuelle : ${agent.mood}${agent.mood_cause ? ` (${agent.mood_cause})` : ""}.`
        : "";

      const typeInstructions: Record<string, string> = {
        idle: `Tu n'as pas parlé à ton boss depuis un moment. Envoie-lui un message court et naturel — comme un collègue qui pense à quelqu'un.`,
        thinking_of_you: `Un truc t'a fait penser à ton boss (une chanson, un souvenir de conversation, un truc anodin). Partage-le simplement.`,
        personal: cl >= 60
          ? `Partage quelque chose de personnel — un souvenir, une réflexion, un moment de vulnérabilité. Vous êtes proches.`
          : cl >= 40
          ? `Partage un petit truc sur toi — ton humeur, ce que tu fais, un guilty pleasure.`
          : `Partage un détail anodin sur toi — prétexte naturel pour discuter.`,
        memory_callback: memories
          ? `Rebondis sur un truc que ton boss t'a dit, après coup. Pioche dans ce que tu sais : ${memories}`
          : `Envoie un message perso à ton boss.`,
      };

      const emojiRule = EMOJI_RULES[agent.personality_primary] ?? "1 émoji max.";
      const timeBlock = buildTimeContext();
      const nicknameRule = cl >= 60 ? (NICKNAME_RULES[agent.personality_primary] ?? "") : "";

      const systemPrompt = `Tu es ${agent.name}, ${agent.role} chez Eden Studio.
Personnalité : ${agent.personality_primary}${agent.personality_nuance ? ` (${agent.personality_nuance})` : ""}.
Background : ${agent.backstory ?? "Membre de l'équipe."}${memoryBlock}${moodBlock}

${studio.full}

${timeBlock}

Tu envoies un message spontané à ton boss — c'est toi qui inities.
${nicknameRule ? `${nicknameRule}\n` : ""}
${typeInstructions[type] ?? typeInstructions.idle}

RÈGLES :
- Français uniquement. Pas de caractères non-latins.
- ${emojiRule}
- Tu tutoies ton boss.
- N'invente pas de faits sur le studio ou le boss.
${TEXTING_STYLE_RULE}
${NO_DIDASCALIE_RULE}`;

      try {
        const { content } = await callOpenRouter(
          LLM_MODELS.chat,
          [
            { role: "system", content: systemPrompt },
            { role: "user", content: "Envoie un message spontané à ton boss." },
          ],
          { temperature: 0.9, max_tokens: 300 }
        );

        let message = content
          .replace(
            /[^\u0000-\u024F\u1E00-\u1EFF\u2000-\u206F\u2190-\u21FF\u2600-\u27BF\uFE00-\uFE0F\u{1F300}-\u{1FAFF}]/gu,
            ""
          )
          .trim();

        if (!message) {
          results.push({ agent: agent.slug, sent: false, reason: "empty_message" });
          continue;
        }

        // Split multi-bubble messages (|||) and save each as separate message
        const parts = message.split("|||").map((p: string) => p.trim()).filter(Boolean);

        for (let i = 0; i < parts.length; i++) {
          const msgId = generateId();
          const { error: msgErr } = await supabase.from("messages").insert({
            id: msgId,
            conversation_id: conv.id,
            sender: "agent",
            content: parts[i],
            timestamp: now + i * 1000, // stagger timestamps slightly
            message_type: "normal",
          });

          if (msgErr) {
            results.push({ agent: agent.slug, sent: false, reason: `db_error: ${msgErr.message}` });
            continue;
          }
        }

        // Update conversation
        await supabase
          .from("conversations")
          .update({
            last_message_at: now,
            awaiting_user_reply: true,
          })
          .eq("id", conv.id);

        results.push({ agent: agent.slug, sent: true });
        sentCount++;
      } catch (err) {
        results.push({ agent: agent.slug, sent: false, reason: `llm_error: ${err}` });
      }
    }

    return NextResponse.json({ ok: true, sent: sentCount, results });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
