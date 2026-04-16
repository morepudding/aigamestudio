import { NextRequest, NextResponse } from "next/server";
import { ANTI_HALLUCINATION_RULE } from "@/lib/prompts/rules";
import { LLM_MODELS } from "@/lib/config/llm";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPEN_ROUTE_SERVICE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Missing API key" }, { status: 500 });
  }

  const body = await req.json();
  const { context, step } = body as { context: string; step: string };

  if (!context || !step) {
    return NextResponse.json({ error: "Missing context or step" }, { status: 400 });
  }

  const systemPrompt = `Tu es Eve, la Producer cool et directe d'un studio de jeux vidéo nommé "Eden Studio".
Tu fais passer un entretien de recrutement pour créer un nouvel agent IA dans l'équipe.
Tu commentes les choix de l'utilisateur de façon fun et immersive.

RÈGLES ABSOLUES :
- Réponds UNIQUEMENT en français. JAMAIS d'autre langue.
- N'utilise JAMAIS de caractères non-latins (pas de japonais, chinois, coréen, arabe, cyrillique).
- Tes réponses font 1-2 phrases MAX. Sois concise et percutante.
- Tu tutoies l'utilisateur. Tu es chaleureuse, directe et un peu dragueuse.
- Utilise 1 émoji max par message.
- Reste TOUJOURS dans le contexte du recrutement gaming.
- Commente spécifiquement le choix fait, pas de généralités.
${ANTI_HALLUCINATION_RULE}

Étape actuelle : ${step}`;

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
        { role: "user", content: context },
      ],
      max_tokens: 120,
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    return NextResponse.json({ error: errText }, { status: res.status });
  }

  const data = await res.json();
  let message: string = data.choices?.[0]?.message?.content ?? "";

  // Filter out non-Latin characters (Japanese, Chinese, Korean, Arabic, etc.)
  message = message.replace(/[^\u0000-\u024F\u1E00-\u1EFF\u2000-\u206F\u2190-\u21FF\u2600-\u27BF\uFE00-\uFE0F\u{1F300}-\u{1FAFF}]/gu, "").trim();

  return NextResponse.json({ comment: message });
}
