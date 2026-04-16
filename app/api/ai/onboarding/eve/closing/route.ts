import { NextRequest, NextResponse } from "next/server";
import { LLM_MODELS } from "@/lib/config/llm";
import { EVE_ONBOARDING_BASE_SYSTEM, EVE_ONBOARDING_STEPS } from "@/lib/prompts/eveOnboarding";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const FALLBACK = "Je sais pas encore tout de toi. Mais j'ai assez pour commencer.";

interface Message {
  sender: string;
  content: string;
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPEN_ROUTE_SERVICE_API_KEY;
  const body = await req.json();
  const { conversationHistory = [] } = body as { conversationHistory: Message[] };

  if (!apiKey) return NextResponse.json({ message: FALLBACK });

  const historyText = conversationHistory.length > 0
    ? "TOUT CE QU'EVE A APPRIS SUR LE BOSS :\n" + conversationHistory
        .map((m) => `${m.sender === "user" ? "Boss" : "Eve"}: ${m.content}`)
        .join("\n")
    : "";

  const closingContext = EVE_ONBOARDING_STEPS[7].eveContext;

  const userPrompt = `${historyText}

${closingContext}

Génère la phrase de clôture d'Eve. UNE SEULE phrase. Elle doit :
- Sonner comme la conclusion naturelle d'une vraie conversation
- Être spécifique à cette personne (tenir compte de ce qu'elle a dit)
- Ne pas être un compliment générique
- Être brève et vraie`;

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
          { role: "user", content: userPrompt },
        ],
        max_tokens: 100,
        temperature: 0.8,
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
