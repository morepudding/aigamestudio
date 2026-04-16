import { NextRequest, NextResponse } from "next/server";
import { LLM_MODELS } from "@/lib/config/llm";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

/**
 * Generates a mood update for an agent based on recent context.
 * Called after conversations, events, or periodically.
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
    personalityPrimary,
    personalityNuance,
    currentMood,
    recentMessages,
    recentEvent,
    memories,
  } = body as {
    name: string;
    role: string;
    personalityPrimary: string;
    personalityNuance: string;
    currentMood: string;
    recentMessages?: { sender: string; content: string }[];
    recentEvent?: string;
    memories?: string;
  };

  if (!name || !personalityPrimary) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const contextParts: string[] = [];
  if (recentMessages?.length) {
    const transcript = recentMessages.slice(-6).map(
      (m) => `${m.sender === "user" ? "Boss" : name}: ${m.content}`
    ).join("\n");
    contextParts.push(`Derniers échanges :\n${transcript}`);
  }
  if (recentEvent) {
    contextParts.push(`Événement récent : ${recentEvent}`);
  }
  if (memories) {
    contextParts.push(`Mémoire de l'agent :\n${memories}`);
  }

  const systemPrompt = `Tu es un système d'analyse émotionnelle.

L'agent ${name} (${role}) a la personnalité : ${personalityPrimary} avec nuance ${personalityNuance ?? "aucune"}.
Humeur actuelle : ${currentMood ?? "neutre"}.

Analyse le contexte ci-dessous et détermine la nouvelle humeur.

HUMEURS POSSIBLES (choisis-en UNE) :
- "neutre" : état par défaut, rien de notable
- "enthousiaste" : excité, motivé, content d'un succès ou d'une bonne nouvelle
- "frustré" : quelque chose l'agace, un problème non résolu, ignoré trop longtemps
- "curieux" : intrigué par un sujet, veut en savoir plus
- "fier" : satisfait d'un accomplissement, a reçu un compliment
- "inquiet" : préoccupé par un deadline, un problème, une tension
- "joueur" : d'humeur taquine, envie de plaisanter
- "nostalgique" : pense au passé, mélancolique mais doux
- "inspiré" : a une idée, créatif, dans un état de flow
- "agacé" : irrité mais pas en colère, petit frustration

Réponds UNIQUEMENT avec un JSON valide :
{"mood": "...", "cause": "explication en 1 phrase courte"}

La cause doit être une phrase naturelle du point de vue de l'agent (ex: "Le boss a adoré mon idée", "Personne ne m'a parlé depuis longtemps", "Le nouveau projet m'inspire").

IMPORTANT :
- L'humeur doit être COHÉRENTE avec la personnalité (un timide devient rarement "joueur", un sarcastique sera souvent "agacé" même pour du positif)
- Si rien de notable ne s'est passé, garde "neutre"
- Ne change pas l'humeur à chaque interaction, seulement quand il y a une vraie raison`;

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: LLM_MODELS.tasks,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: contextParts.join("\n\n") || "Aucun contexte récent." },
      ],
      max_tokens: 100,
      temperature: 0.4,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    return NextResponse.json({ error: errText }, { status: res.status });
  }

  const data = await res.json();
  const raw: string = data.choices?.[0]?.message?.content ?? "";

  // Extract JSON from response
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return NextResponse.json({ mood: "neutre", cause: null });
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]) as { mood: string; cause?: string };
    const validMoods = [
      "neutre", "enthousiaste", "frustré", "curieux", "fier",
      "inquiet", "joueur", "nostalgique", "inspiré", "agacé",
    ];
    if (!validMoods.includes(parsed.mood)) {
      return NextResponse.json({ mood: "neutre", cause: null });
    }
    return NextResponse.json({
      mood: parsed.mood,
      cause: parsed.cause?.trim() ?? null,
    });
  } catch {
    return NextResponse.json({ mood: "neutre", cause: null });
  }
}
