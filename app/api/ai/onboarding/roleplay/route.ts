import { NextRequest, NextResponse } from "next/server";
import { ANTI_HALLUCINATION_RULE } from "@/lib/prompts/rules";
import { LLM_MODELS } from "@/lib/config/llm";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

/**
 * Onboarding RP conversation: the agent "comes to life" and introduces themselves.
 * Supports two modes:
 * - "welcome": generates the agent's first RP message (their arrival at the studio)
 * - "reply": agent replies to the boss during the RP conversation
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
    department,
    appearance,
    conversationHistory,
    userMessage,
    mode,
  } = body as {
    name: string;
    role: string;
    gender: string;
    personalityPrimary: string;
    personalityNuance: string;
    backstory: string;
    department: string;
    appearance?: string;
    conversationHistory?: { sender: string; content: string }[];
    userMessage?: string;
    mode?: "welcome" | "reply";
  };

  if (!name || !personalityPrimary) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const isReply = mode === "reply" && userMessage;

  const genderAdj = gender === "femme" ? "e" : "";

  const welcomePrompt = `Tu es ${name}, ${role} tout juste recruté${genderAdj} au sein d'Eden Studio.
C'est ton premier jour. Tu arrives au studio et tu rencontres ton boss pour la première fois.

Personnalité : ${personalityPrimary}${personalityNuance ? `, nuance ${personalityNuance}` : ""}.
Background : ${backstory}
Département : ${department}

Décris brièvement ton arrivée (1-2 phrases narratives entre *astérisques*), puis adresse-toi à ton boss. Ta personnalité doit se sentir naturellement dans ton ton et tes mots.

Termine par quelque chose qui invite le boss à répondre.

RÈGLES :
- Français uniquement. Pas de caractères non-latins.
- 3 à 5 phrases MAX (narration incluse).
- 1-2 émojis max. Tu tutoies ton boss.
${ANTI_HALLUCINATION_RULE}`;

  const replyPrompt = `Tu es ${name}, ${role} au sein d'Eden Studio.
C'est ton premier jour. Tu continues la conversation avec ton boss.

Personnalité : ${personalityPrimary}${personalityNuance ? `, nuance ${personalityNuance}` : ""}.
Background : ${backstory}

Réagis naturellement. Tu peux donner un détail sur toi, poser une question curieuse, ou partager une anecdote de ton passé.

RÈGLES :
- Français uniquement. Pas de caractères non-latins.
- 2 à 4 phrases MAX. 1-2 émojis max. Tu tutoies ton boss.
${ANTI_HALLUCINATION_RULE}`;

  const systemPrompt = isReply ? replyPrompt : welcomePrompt;

  const history = isReply
    ? (conversationHistory ?? []).slice(-10).map((m) => ({
        role: m.sender === "user" ? ("user" as const) : ("assistant" as const),
        content: m.content,
      }))
    : [];

  const messages = [
    { role: "system" as const, content: systemPrompt },
    ...history,
    ...(isReply
      ? [{ role: "user" as const, content: userMessage }]
      : [{ role: "user" as const, content: "Tu arrives au studio. Présente-toi." }]),
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
      max_tokens: isReply ? 200 : 300,
      temperature: 0.85,
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
