import { NextRequest, NextResponse } from "next/server";
import { LLM_MODELS } from "@/lib/config/llm";
import { buildEveOnboardingSystemPrompt, EVE_ONBOARDING_STEPS } from "@/lib/prompts/eveOnboarding";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

interface Message {
  sender: string;
  content: string;
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPEN_ROUTE_SERVICE_API_KEY;
  const body = await req.json();
  const { step, playerChoice, conversationHistory = [] } = body as {
    step: number;
    playerChoice: string;
    conversationHistory: Message[];
  };

  if (!step || !playerChoice) {
    return NextResponse.json({ message: "Noté." });
  }

  if (!apiKey) return NextResponse.json({ message: "Noté." });

  const stepData = EVE_ONBOARDING_STEPS[step];
  const systemPrompt = buildEveOnboardingSystemPrompt(step);

  const historyText = conversationHistory.length > 0
    ? "\n\nCONVERSATION PRÉCÉDENTE :\n" + conversationHistory
        .map((m) => `${m.sender === "user" ? "Boss" : "Eve"}: ${m.content}`)
        .join("\n")
    : "";

  const userPrompt = `${historyText}

Le boss vient de répondre : "${playerChoice}"

CONTEXTE DE TA RÉACTION : ${stepData.reactionContext}

Réponds en tant qu'Eve. 1-3 phrases max. Naturel, direct, honnête. Pas de formules vides.`;

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
        temperature: 0.7,
      }),
    });

    if (!res.ok) return NextResponse.json({ message: "Noté." });

    const data = await res.json();
    const message = (data.choices?.[0]?.message?.content ?? "").trim();
    return NextResponse.json({ message: message || "Noté." });
  } catch {
    return NextResponse.json({ message: "Noté." });
  }
}
