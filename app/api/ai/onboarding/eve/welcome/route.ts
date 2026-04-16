import { NextResponse } from "next/server";
import { LLM_MODELS } from "@/lib/config/llm";
import { EVE_ONBOARDING_BASE_SYSTEM } from "@/lib/prompts/eveOnboarding";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const FALLBACK =
  "T'es là. Bien. Moi c'est Eve. Maintenant qu'on est juste nous deux — je veux apprendre à te connaître vraiment.";

export async function POST() {
  const apiKey = process.env.OPEN_ROUTE_SERVICE_API_KEY;
  if (!apiKey) return NextResponse.json({ message: FALLBACK });

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
          { role: "system", content: EVE_ONBOARDING_BASE_SYSTEM },
          {
            role: "user",
            content:
              "Écris le premier message d'Eve — celui qu'elle dit quand la personne arrive pour la première fois. 2-3 phrases max. Naturel, direct, sans fioriture. Elle est là, la personne arrive, elle dit quelque chose de vrai.",
          },
        ],
        max_tokens: 150,
        temperature: 0.7,
      }),
    });

    if (!res.ok) return NextResponse.json({ message: FALLBACK });

    const data = await res.json();
    const message = (data.choices?.[0]?.message?.content ?? "").trim();
    return NextResponse.json({ message: message || FALLBACK });
  } catch {
    return NextResponse.json({ message: FALLBACK });
  }
}
