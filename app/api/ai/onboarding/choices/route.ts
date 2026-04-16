import { NextRequest, NextResponse } from "next/server";
import { LLM_MODELS } from "@/lib/config/llm";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const STEP_THEMES = [
  { step: 1, theme: "Souvenir", question: "C'est quoi le souvenir qui t'a fait devenir ce que tu es ?" },
  { step: 2, theme: "Kiff", question: "C'est quoi le truc que tu kiffes tellement que tu perds la notion du temps ?" },
  { step: 3, theme: "Manie", question: "T'as forcément une manie — un truc que les autres trouvent bizarre chez toi ?" },
  { step: 4, theme: "Allergie", question: "C'est quoi le truc qui te rend dingue, que tu supportes vraiment pas ?" },
  { step: 5, theme: "Deal", question: "Si tu pouvais changer un seul truc dans ta façon de bosser ici, ce serait quoi ?" },
];

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPEN_ROUTE_SERVICE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Missing API key" }, { status: 500 });
  }

  const body = await req.json();
  const { step, agentName, role, department, personalityPrimary, personalityNuance, gender, backstory } = body as {
    step: number;
    agentName: string;
    role: string;
    department: string;
    personalityPrimary: string;
    personalityNuance: string;
    gender: string;
    backstory: string;
  };

  if (!step || step < 1 || step > 5 || !agentName) {
    return NextResponse.json({ error: "Missing or invalid fields" }, { status: 400 });
  }

  const theme = STEP_THEMES[step - 1];
  const genderAdj = gender === "femme" ? "e" : "";

  const prompt = `On fait connaissance avec ${agentName}, ${role} (${department}).

Personnalité : ${personalityPrimary} avec nuance ${personalityNuance}.
Genre: ${gender}. Background: ${backstory}

Question posée : "${theme.question}"

Génère 3 réponses possibles pour définir ce trait. Variées : une drôle, une touchante, une surprenante.

RÈGLES :
- 1 phrase courte par choix, max 15 mots
- Ton familier et naturel
- Cohérent avec la personnalité ${personalityPrimary}
- ${agentName} est ${genderAdj === "e" ? "une femme" : "un homme"}
- Français uniquement

Réponds en JSON array de 3 strings.`;

  try {
    const res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: LLM_MODELS.tasks,
        messages: [
          {
            role: "system",
            content: "Tu génères des choix de dialogue courts et naturels en français. Réponds UNIQUEMENT en JSON valide.",
          },
          { role: "user", content: prompt },
        ],
        max_tokens: 200,
        temperature: 0.8,
      }),
    });

    if (!res.ok) {
      return NextResponse.json({ choices: getFallbackChoices(step) });
    }

    const data = await res.json();
    let content: string = data.choices?.[0]?.message?.content ?? "";

    // Extract JSON array from response
    const match = content.match(/\[[\s\S]*?\]/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]);
        if (Array.isArray(parsed) && parsed.length === 3 && parsed.every((c: unknown) => typeof c === "string")) {
          return NextResponse.json({ choices: parsed, theme: theme.theme, question: theme.question });
        }
      } catch {
        // Fall through to fallback
      }
    }

    return NextResponse.json({ choices: getFallbackChoices(step), theme: theme.theme, question: theme.question });
  } catch {
    return NextResponse.json({ choices: getFallbackChoices(step), theme: theme.theme, question: theme.question });
  }
}

function getFallbackChoices(step: number): string[] {
  const fallbacks: Record<number, string[]> = {
    1: [
      "Un jeu qui m'a bouleversé quand j'étais gamin",
      "Un projet raté qui m'a tout appris",
      "Une rencontre au mauvais moment, au bon endroit",
    ],
    2: [
      "Décortiquer un système de jeu pendant des heures",
      "Créer quelque chose à partir de rien",
      "Regarder les gens réagir à ce que j'ai fait",
    ],
    3: [
      "Je parle tout seul quand je code — genre, des vrais dialogues",
      "Je dois toucher tous les objets sur mon bureau avant de commencer",
      "Je refais 10 fois la même chose jusqu'à ce que ce soit parfait",
    ],
    4: [
      "Les gens qui coupent la parole en réunion",
      "Le code sale qu'on 'corrigera plus tard'",
      "Quand on dit 'c'est impossible' sans avoir essayé",
    ],
    5: [
      "Plus de liberté créative, même si ça fait peur",
      "Un vrai feedback honnête, pas du politiquement correct",
      "Qu'on me fasse confiance sur les deadlines",
    ],
  };
  return fallbacks[step] ?? fallbacks[1];
}
