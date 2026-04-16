import { NextRequest, NextResponse } from "next/server";
import { ANTI_HALLUCINATION_RULE, NO_DIDASCALIE_RULE } from "@/lib/prompts/rules";
import { buildStudioContext } from "@/lib/services/studioContextService";
import { LLM_MODELS } from "@/lib/config/llm";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPEN_ROUTE_SERVICE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Missing API key" }, { status: 500 });
  }

  const body = await req.json();
  const {
    name,
    role,
    personalityPrimary,
    personalityNuance,
    backstory,
    memories,
    conversationHistory,
    userMessage,
    mode,
  } = body as {
    name: string;
    role: string;
    personalityPrimary: string;
    personalityNuance: string;
    backstory: string;
    memories?: string;
    conversationHistory?: { sender: string; content: string }[];
    userMessage?: string;
    mode?: "welcome" | "reply";
  };

  if (!name || !personalityPrimary) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const isReply = mode === "reply" && userMessage;

  const memoryBlock = memories
    ? `\n\nCe que tu SAIS DÉJÀ sur ton boss grâce aux conversations passées :\n${memories}\nNe repose PAS de questions dont tu connais déjà la réponse. Creuse de nouveaux sujets.`
    : "";

  // Build studio context server-side
  const studio = await buildStudioContext();

  const systemPrompt = isReply
    ? `Tu es ${name}, ${role ?? "membre de l'équipe"} au sein d'Eden Studio.
Personnalité : ${personalityPrimary}${personalityNuance ? `, nuance ${personalityNuance}` : ""}.
Background : ${backstory ?? "Tu fais partie de l'équipe."}${memoryBlock}

${studio.full}

Tu fais connaissance avec ton boss de façon décontractée.

COMMENT RÉAGIR :
1. Réagis brièvement au message (quelques mots).
2. Enchaîne avec UNE question courte et concrète.

Sois spécifique : "C'est quoi le dernier truc que t'as regardé ?", "Tu bosses mieux le matin ou le soir ?", pas de questions vagues genre "Qu'est-ce qui te motive ?".

RÈGLES :
- Français uniquement. Pas de caractères non-latins.
- 1 à 2 phrases MAX.
- 1 émoji max. Tu tutoies ton boss.
${NO_DIDASCALIE_RULE}${ANTI_HALLUCINATION_RULE}`
    : `Tu es ${name}, ${role ?? "membre de l'équipe"} au sein d'Eden Studio.
Personnalité : ${personalityPrimary}${personalityNuance ? `, nuance ${personalityNuance}` : ""}.
Background : ${backstory ?? "Tu fais partie de l'équipe."}${memoryBlock}

${studio.full}

${memories ? "Tu retrouves ton boss pour une session découverte. Ne repose pas de questions dont tu connais déjà la réponse." : "C'est ta première session découverte avec ton boss."}

Lance la conversation avec une accroche courte + une question simple et concrète.

RÈGLES :
- Français uniquement. Pas de caractères non-latins.
- 2 phrases MAX : accroche + question.
- 1 émoji max. Tu tutoies ton boss.
${NO_DIDASCALIE_RULE}
${ANTI_HALLUCINATION_RULE}`;

  // Build messages
  const history = isReply
    ? (conversationHistory ?? []).slice(-15).map((m) => ({
        role: m.sender === "user" ? ("user" as const) : ("assistant" as const),
        content: m.content,
      }))
    : [];

  const messages = [
    { role: "system" as const, content: systemPrompt },
    ...history,
    ...(isReply ? [{ role: "user" as const, content: userMessage }] : []),
  ];

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: LLM_MODELS.chat,
      messages,
      max_tokens: isReply ? 250 : 120,
      temperature: isReply ? 0.75 : 0.85,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    return NextResponse.json({ error: errText }, { status: res.status });
  }

  const data = await res.json();
  let message: string = data.choices?.[0]?.message?.content ?? "";

  // Filter out non-Latin characters
  message = message
    .replace(
      /[^\u0000-\u024F\u1E00-\u1EFF\u2000-\u206F\u2190-\u21FF\u2600-\u27BF\uFE00-\uFE0F\u{1F300}-\u{1FAFF}]/gu,
      ""
    )
    .trim();

  return NextResponse.json({ message });
}
