import { NextRequest, NextResponse } from "next/server";
import { NO_DIDASCALIE_RULE } from "@/lib/prompts/rules";
import { buildStudioContext } from "@/lib/services/studioContextService";
import { LLM_MODELS } from "@/lib/config/llm";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

/**
 * Generates a spontaneous (unsolicited) message from an agent.
 * Types:
 * - "idle": agent hasn't talked to boss in a while, reaches out personally
 * - "thinking_of_you": agent thought of boss for personal/romantic reason
 * - "personal": agent shares something about their life/feelings
 * - "memory_callback": agent references something boss said previously
 * - "event_reaction": agent reacts to a studio event with personal angle
 */
export async function POST(req: NextRequest) {
  const apiKey = process.env.OPEN_ROUTE_SERVICE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Missing API key" }, { status: 500 });
  }

  const body = await req.json();
  const {
    name,
    role,
    gender,
    personalityPrimary,
    personalityNuance,
    backstory,
    memories,
    mood,
    moodCause,
    confidenceLevel,
    type,
    eventContext,
  } = body as {
    name: string;
    role: string;
    gender: string;
    personalityPrimary: string;
    personalityNuance: string;
    backstory: string;
    memories?: string;
    mood?: string;
    moodCause?: string;
    confidenceLevel?: number;
    type: "idle" | "thinking_of_you" | "personal" | "memory_callback" | "event_reaction";
    eventContext?: string;
  };

  if (!name || !personalityPrimary || !type) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const cl = confidenceLevel ?? 0;

  const memoryBlock = memories
    ? `\nCe que tu sais de ton boss :\n${memories}`
    : "";

  const moodBlock = mood && mood !== "neutre"
    ? `\nTon humeur actuelle : ${mood}${moodCause ? ` (${moodCause})` : ""}.`
    : "";

  // Build studio context server-side
  const studio = await buildStudioContext();

  const typeInstructions: Record<string, string> = {
    idle: `Tu n'as pas parlé à ton boss depuis un moment. Envoie-lui un message court et naturel — comme un collègue qui pense à quelqu'un.`,

    thinking_of_you: `Un truc t'a fait penser à ton boss (une chanson, un souvenir de conversation, un truc anodin). Partage-le simplement.
${memories ? `Utilise ce que tu sais de lui si pertinent.` : ""}`,

    personal: cl >= 60
      ? `Partage quelque chose de personnel — un souvenir, une réflexion, un moment de vulnérabilité. Vous êtes proches.`
      : cl >= 40
      ? `Partage un petit truc sur toi — ton humeur, ce que tu fais, un guilty pleasure.`
      : `Partage un détail anodin sur toi — prétexte naturel pour discuter.`,

    memory_callback: memories
      ? `Rebondis sur un truc que ton boss t'a dit, après coup. Pioche dans ce que tu sais : ${memories}`
      : `Envoie un message perso à ton boss.`,

    event_reaction: `Un truc vient de se passer au studio : ${eventContext ?? "un événement récent"}.
Réagis-y avec ta personnalité — comment ça te touche, ce que t'en penses.`,
  };

  const systemPrompt = `Tu es ${name}, ${role} chez Eden Studio.
Personnalité : ${personalityPrimary}${personalityNuance ? ` (${personalityNuance})` : ""}.
Background : ${backstory ?? "Membre de l'équipe."}${memoryBlock}${moodBlock}

${studio.full}

Tu envoies un message spontané à ton boss — c'est toi qui initie.

${typeInstructions[type] ?? typeInstructions.idle}

RÈGLES :
- Français uniquement. Pas de caractères non-latins.
- 1 à 2 phrases MAX.
- 1 émoji max. Tu tutoies ton boss.
- N'invente pas de faits sur le studio ou le boss.
${NO_DIDASCALIE_RULE}`;

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
        { role: "user", content: "Envoie un message spontané à ton boss." },
      ],
      max_tokens: 150,
      temperature: 0.9,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    return NextResponse.json({ error: errText }, { status: res.status });
  }

  const data = await res.json();
  let message: string = data.choices?.[0]?.message?.content ?? "";

  message = message
    .replace(
      /[^\u0000-\u024F\u1E00-\u1EFF\u2000-\u206F\u2190-\u21FF\u2600-\u27BF\uFE00-\uFE0F\u{1F300}-\u{1FAFF}]/gu,
      ""
    )
    .trim();

  // Suggest a mood update based on the message type
  let suggestedMood: string | null = null;
  if (type === "thinking_of_you") suggestedMood = "romantique";
  else if (type === "personal" && cl >= 60) suggestedMood = "nostalgique";
  else if (type === "personal") suggestedMood = "ouvert";
  else if (type === "memory_callback") suggestedMood = "attentionné";
  else if (type === "idle") suggestedMood = "impatient";
  else if (type === "event_reaction") suggestedMood = "curieux";

  return NextResponse.json({ message, suggestedMood });
}
