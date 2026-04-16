import { NextRequest, NextResponse } from "next/server";
import { LLM_MODELS } from "@/lib/config/llm";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPEN_ROUTE_SERVICE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Missing API key" }, { status: 500 });
  }

  const body = await req.json();
  const { department, gender, personality, appearance } = body;

  const appearanceDesc = Object.entries(appearance)
    .map(([key, val]) => `${key}: ${val}`)
    .join(", ");

  const prompt = `Crée un personnage pour l'équipe d'Eden Studio.

Caractéristiques :
- Département : ${department}
- Genre : ${gender}
- Personnalité : ${personality.primary} avec nuance ${personality.nuance}
- Apparence : ${appearanceDesc}

Génère :
1. Un prénom (${gender === "femme" ? "féminin" : "masculin"}) original et mémorable
2. Un nom de famille
3. Un résumé court (2-3 phrases) décrivant ce collègue de façon naturelle et crédible.

Réponds UNIQUEMENT en JSON valide, sans backticks :
{"firstName": "...", "lastName": "...", "summary": "..."}`;

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: LLM_MODELS.tasks,
      messages: [
        { role: "system", content: "Tu génères des profils de personnages. Réponds uniquement en JSON valide." },
        { role: "user", content: prompt },
      ],
      max_tokens: 300,
      temperature: 0.9,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    return NextResponse.json({ error: errText }, { status: res.status });
  }

  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content ?? "{}";

  try {
    const parsed = JSON.parse(raw);
    return NextResponse.json(parsed);
  } catch {
    // Try to extract JSON from response
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]);
        return NextResponse.json(parsed);
      } catch {
        return NextResponse.json({ error: "Failed to parse AI response", raw }, { status: 500 });
      }
    }
    return NextResponse.json({ error: "Failed to parse AI response", raw }, { status: 500 });
  }
}
