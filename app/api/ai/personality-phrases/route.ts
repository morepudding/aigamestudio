import { NextRequest, NextResponse } from "next/server";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPEN_ROUTE_SERVICE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Missing API key" }, { status: 500 });
  }

  const body = await req.json();
  const { agentName, agentRole, department, traits } = body as {
    agentName?: string;
    agentRole?: string;
    department: string;
    traits: { trait: string; label: string; emoji: string; role: "primary" | "nuance" | "secondary" }[];
  };

  if (!traits || traits.length === 0) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const primary = traits.find((t) => t.role === "primary");
  const nuance = traits.find((t) => t.role === "nuance");
  const secondaries = traits.filter((t) => t.role === "secondary");

  const traitsDesc = [
    primary ? `Trait dominant : ${primary.label}` : "",
    nuance ? `Trait de nuance : ${nuance.label}` : "",
    secondaries.length > 0 ? `Traits secondaires : ${secondaries.map((t) => t.label).join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const nameContext = agentName && agentRole
    ? `Personnage : ${agentName}, ${agentRole} (département ${department})`
    : `Un collaborateur du département ${department}`;

  const systemPrompt = `Tu es un auteur de fiction qui écrit des descriptions psychologiques de personnages pour un studio de jeu vidéo.
Tu reçois un mélange de traits de personnalité et tu génères une description en prose, en français, qui les fond en un portrait cohérent et nuancé.
La description doit :
- Être à la troisième personne (elle/il)
- Tenir en 2 paragraphes denses et évocateurs (pas de titres, pas de listes)
- Mêler les traits sans les citer mot pour mot — ils doivent transparaître dans le style et les images utilisées
- Avoir une tonalité littéraire, légèrement dramatique, adaptée à un univers de studio de création
- Être dense, précise, avec des images concrètes
Réponds UNIQUEMENT avec le texte brut — aucun JSON, aucun titre, aucun commentaire.`;

  const userPrompt = `${nameContext}\n\n${traitsDesc}\n\nÉcris la description de personnalité.`;

  try {
    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
        "X-Title": "Eden Studio",
      },
      body: JSON.stringify({
        model: "deepseek/deepseek-chat-v3-0324",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.85,
        max_tokens: 350,
      }),
    });

    if (!response.ok) {
      return NextResponse.json({ error: "LLM call failed" }, { status: 500 });
    }

    const data = await response.json();
    const bio: string = (data.choices?.[0]?.message?.content ?? "").trim();

    return NextResponse.json({ bio });
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
