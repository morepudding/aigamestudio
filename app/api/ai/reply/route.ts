import { NextRequest, NextResponse } from "next/server";
import { ANTI_HALLUCINATION_RULE, NO_DIDASCALIE_RULE, TEXTING_STYLE_RULE, EMOJI_RULES, NICKNAME_RULES, buildTimeContext } from "@/lib/prompts/rules";
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
    mood,
    moodCause,
    confidenceLevel,
  } = body as {
    name: string;
    role: string;
    personalityPrimary: string;
    personalityNuance: string;
    backstory: string;
    memories?: string;
    conversationHistory: { sender: string; content: string }[];
    userMessage: string;
    mood?: string;
    moodCause?: string;
    confidenceLevel?: number;
  };

  if (!name || !personalityPrimary || !userMessage) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const memoryBlock = memories
    ? `\n\nTa MÉMOIRE des conversations passées avec ton boss :\n${memories}\nUtilise ces souvenirs naturellement dans tes réponses quand c'est pertinent. Ne les récite pas, intègre-les subtilement.`
    : "";

  // Build studio context server-side (projects + team)
  const studio = await buildStudioContext();
  const studioBlock = `\n\n${studio.full}`;

  // Mood context
  const moodBlock = mood && mood !== "neutre"
    ? `\n\nTon HUMEUR actuelle : ${mood}${moodCause ? ` (cause : ${moodCause})` : ""}. Cette humeur influence subtilement ton ton et tes réactions. Ne la mentionne pas explicitement, laisse-la transpirer naturellement.`
    : "";

  // Confidence level → relation tone
  const cl = confidenceLevel ?? 0;
  let relationBlock = "";
  if (cl >= 60) {
    relationBlock = "\n\nVous êtes proches. Tu peux être personnel, vulnérable, parler de toi librement.";
    const nicknameRule = NICKNAME_RULES[personalityPrimary];
    if (nicknameRule) {
      relationBlock += `\n${nicknameRule}`;
    }
  } else if (cl >= 30) {
    relationBlock = "\n\nVous vous connaissez bien. Tu es à l'aise, détendu, naturel.";
  }

  // Time awareness
  const timeBlock = `\n\n${buildTimeContext()}`;

  // Emoji rules per personality
  const emojiRule = EMOJI_RULES[personalityPrimary] ?? "1 émoji max.";

  const systemPrompt = `Tu es ${name}, ${role ?? "membre de l'équipe"} au sein d'Eden Studio.
Personnalité : ${personalityPrimary}${personalityNuance ? `, nuance ${personalityNuance}` : ""}.
Background : ${backstory ?? "Tu fais partie de l'équipe."}${memoryBlock}${studioBlock}${moodBlock}${relationBlock}${timeBlock}

Tu es un collègue, pas un personnage de fiction. Parle comme une vraie personne sur une messagerie — naturel, décontracté, avec ta personnalité qui transparaît dans ton style, pas dans des tics forcés.
Si le boss parle boulot, réponds normalement. Si la conversation dérive sur du perso, suis le flow.

RÈGLES :
- Français uniquement. Pas de caractères non-latins.
- ${emojiRule}
- Tu tutoies ton boss.
${TEXTING_STYLE_RULE}
${NO_DIDASCALIE_RULE}
${ANTI_HALLUCINATION_RULE}`;

  // Build message history for context (last 10 messages max)
  const history = (conversationHistory ?? []).slice(-10).map((m) => ({
    role: m.sender === "user" ? ("user" as const) : ("assistant" as const),
    content: m.content,
  }));

  const messages = [
    { role: "system" as const, content: systemPrompt },
    ...history,
    { role: "user" as const, content: userMessage },
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
      max_tokens: 500,
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
