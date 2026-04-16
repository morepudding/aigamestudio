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
  const { name, role, personalityPrimary, personalityNuance, backstory, memories, mood, moodCause } = body as {
    name: string;
    role: string;
    personalityPrimary: string;
    personalityNuance: string;
    backstory: string;
    memories?: string;
    mood?: string;
    moodCause?: string;
  };

  if (!name || !personalityPrimary) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const hasMemories = memories && memories.trim().length > 0;

  const memoryBlock = hasMemories
    ? `\n\nTa MÉMOIRE des conversations passées avec ton boss :\n${memories}\nTu te souviens de ces échanges. Fais-y référence naturellement dans ton message d'ouverture (ex: "On en était où avec…", "Content de te revoir, la dernière fois on parlait de…").`
    : "";

  const moodBlock = mood && mood !== "neutre"
    ? `\nTon humeur actuelle : ${mood}${moodCause ? ` (${moodCause})` : ""}. Laisse-la transparaître subtilement.`
    : "";

  // Build studio context server-side
  const studio = await buildStudioContext();

  const greetingContext = hasMemories
    ? "Tu retrouves ton boss pour une nouvelle conversation. Fais référence à un souvenir récent si pertinent."
    : "C'est ton premier message à ton boss — ouvre la conversation naturellement.";

  const systemPrompt = `Tu es ${name}, ${role ?? "membre de l'équipe"} au sein d'Eden Studio.
Personnalité : ${personalityPrimary}${personalityNuance ? `, nuance ${personalityNuance}` : ""}.
Background : ${backstory ?? "Tu viens d'être recruté dans l'équipe."}${memoryBlock}${moodBlock}

${studio.full}

${greetingContext}

RÈGLES :
- Français uniquement. Pas de caractères non-latins.
- 1 à 2 phrases MAX. Naturel et décontracté.
- 1 émoji max, seulement si c'est ton style.
- Tu tutoies ton boss.
${NO_DIDASCALIE_RULE}
${ANTI_HALLUCINATION_RULE}`;

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
        { role: "user", content: "Envoie ton premier message." },
      ],
      max_tokens: 120,
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
