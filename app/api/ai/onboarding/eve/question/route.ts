import { NextRequest, NextResponse } from "next/server";
import { LLM_MODELS } from "@/lib/config/llm";
import { buildEveOnboardingSystemPrompt, EVE_ONBOARDING_STEPS } from "@/lib/prompts/eveOnboarding";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

interface Message {
  sender: string;
  content: string;
}

const FALLBACKS: Record<number, string> = {
  2: "C'est quoi ton truc à toi ? Le truc qui te fait vraiment vibrer — pas ce que t'es censé aimer, ce que t'aimes vraiment.",
  3: "Imagine : quelqu'un sur qui tu comptais te pose un lapin au dernier moment, sans vraiment d'excuse. T'es comment avec ça ?",
  4: "Je vais te dire un truc sur moi d'abord. J'ai tendance à prendre trop sur moi et à pas demander de l'aide avant que ce soit trop tard. Toi, c'est quoi ta zone d'ombre ?",
  5: "T'es comment avec les gens qui bossent avec toi ? Tu leur laisses de l'autonomie ou t'as besoin de savoir où en sont les choses ?",
  6: "Moi je m'engage à être honnête avec toi, même quand c'est pas confortable. Et toi — tu me promets quoi ?",
};

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPEN_ROUTE_SERVICE_API_KEY;
  const body = await req.json();
  const { step, conversationHistory = [], playerName } = body as {
    step: number;
    conversationHistory: Message[];
    playerName?: string;
  };

  if (!step || step < 2 || step > 6) {
    return NextResponse.json({ message: FALLBACKS[step] ?? "" });
  }

  if (!apiKey) return NextResponse.json({ message: FALLBACKS[step] });

  const stepData = EVE_ONBOARDING_STEPS[step];
  const systemPrompt = buildEveOnboardingSystemPrompt(step);

  const historyText =
    conversationHistory.length > 0
      ? "CONVERSATION PRÉCÉDENTE :\n" +
        conversationHistory
          .map((m) => `${m.sender === "user" ? "Boss" : "Eve"}: ${m.content}`)
          .join("\n") +
        "\n\n"
      : "";

  const nameContext = playerName ? `Le boss s'appelle ${playerName}. Utilise son prénom quand c'est naturel.\n\n` : "";

  const userPrompt = `${nameContext}${historyText}CONTEXTE DE CETTE ÉTAPE :
${stepData.eveContext}

Génère le message qu'Eve dit à cette étape — ce qu'elle dit AVANT que le boss réponde. C'est elle qui parle en premier : elle pose sa question, partage quelque chose sur elle, ou crée la situation décrite. 2-4 phrases max. Naturel, direct, personnel. Pas de formules vides.`;

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
        max_tokens: 200,
        temperature: 0.75,
      }),
    });

    if (!res.ok) return NextResponse.json({ message: FALLBACKS[step] });

    const data = await res.json();
    const message = (data.choices?.[0]?.message?.content ?? "").trim();
    return NextResponse.json({ message: message || FALLBACKS[step] });
  } catch {
    return NextResponse.json({ message: FALLBACKS[step] });
  }
}
