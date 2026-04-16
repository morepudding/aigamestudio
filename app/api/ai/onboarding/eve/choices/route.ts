import { NextRequest, NextResponse } from "next/server";
import { LLM_MODELS } from "@/lib/config/llm";
import { buildEveOnboardingSystemPrompt, EVE_ONBOARDING_STEPS } from "@/lib/prompts/eveOnboarding";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

interface Message {
  sender: string;
  content: string;
}

function fallbackChoices(step: number): string[] {
  const defaults: Record<number, string[]> = {
    1: ["Tu peux m'appeler par mon prénom.", "Les gens proches m'appellent autrement — je te le dirai.", "Et toi, tu préfères qu'on t'appelle comment ?"],
    2: ["Il y a un truc qui me consume complètement quand je le fais.", "C'est compliqué à expliquer, mais je vais essayer.", "Et toi d'abord — qu'est-ce qui te fait vibrer ?"],
    3: ["Je le dis clairement que ça me fait quelque chose.", "Je fais comme si ça allait, mais ça me touche quand même.", "Je prends de la distance et je tourne ça en humour."],
    4: ["J'ai une zone d'ombre que j'assume pas toujours.", "Je reste un peu en surface sur ça.", "J'avoue quelque chose avec une pointe d'humour."],
    5: ["Je donne de l'autonomie — je fais confiance.", "J'aime savoir où en sont les choses.", "L'humain avant tout, le reste suit."],
    6: ["Je m'engage à être franc·he, même quand c'est difficile.", "Je promets d'être là vraiment.", "Je reconnaîs mes limites et je m'engage quand même."],
  };
  return defaults[step] ?? ["Je réponds honnêtement.", "Je prends le temps de réfléchir.", "Je renvoie la question."];
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPEN_ROUTE_SERVICE_API_KEY;
  const body = await req.json();
  const { step, conversationHistory = [] } = body as { step: number; conversationHistory: Message[] };

  if (!step || step < 1 || step > 6) {
    return NextResponse.json({ choices: fallbackChoices(step) });
  }

  if (!apiKey) return NextResponse.json({ choices: fallbackChoices(step) });

  const stepData = EVE_ONBOARDING_STEPS[step];
  const systemPrompt = buildEveOnboardingSystemPrompt(step);

  // Build conversation context
  const historyText = conversationHistory.length > 0
    ? "\n\nCONVERSATION PRÉCÉDENTE :\n" + conversationHistory
        .map((m) => `${m.sender === "user" ? "Boss" : "Eve"}: ${m.content}`)
        .join("\n")
    : "";

  const userPrompt = `${historyText}

MAINTENANT : ${stepData.choiceContext}

Génère exactement 3 réponses courtes (1-2 phrases chacune) que le boss pourrait choisir. Format JSON strict :
{"choices": ["réponse A", "réponse B", "réponse C"]}

Les 3 réponses doivent être distinctes, crédibles, naturelles en français.`;

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
        max_tokens: 300,
        temperature: 0.75,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) return NextResponse.json({ choices: fallbackChoices(step) });

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content ?? "";

    try {
      const parsed = JSON.parse(raw);
      const choices = parsed.choices;
      if (Array.isArray(choices) && choices.length >= 3) {
        return NextResponse.json({ choices: choices.slice(0, 3) });
      }
    } catch {
      // fall through
    }

    return NextResponse.json({ choices: fallbackChoices(step) });
  } catch {
    return NextResponse.json({ choices: fallbackChoices(step) });
  }
}
