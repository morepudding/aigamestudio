import { NextRequest, NextResponse } from "next/server";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

// Singleton types — only 1 entry allowed per agent
const SINGLETON_TYPES = ["relationship", "nickname", "confidence"] as const;

interface ConsolidatedMemory {
  type:
    | "summary"
    | "decision"
    | "preference"
    | "progress"
    | "relationship"
    | "nickname"
    | "confidence"
    | "boss_profile"
    | "family"
    | "hobbies"
    | "dreams"
    | "social"
    | "fears"
    | "personal_event";
  content: string;
  importance: number; // 3-5
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPEN_ROUTE_SERVICE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Missing API key" }, { status: 500 });
  }

  const body = await req.json();
  const { agentName, agentRole, memories } = body as {
    agentName: string;
    agentRole: string;
    memories: { type: string; content: string; importance?: number }[];
  };

  if (!agentName || !memories?.length) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const memoryDump = memories
    .map((m) => `[${m.type}] (importance:${m.importance ?? 3}) ${m.content}`)
    .join("\n");

  const systemPrompt = `Tu es un système de gestion de mémoire pour ${agentName} (${agentRole}), un agent IA dans un studio de jeux vidéo.

Tu reçois TOUS les souvenirs accumulés de cet agent. Ton travail est de les CONSOLIDER :
- Fusionne les souvenirs redondants ou similaires en un seul résumé concis
- Garde OBLIGATOIREMENT les informations avec importance >= 4
- Supprime les infos triviales, obsolètes ou doublons
- Objectif : 8-12 souvenirs maximum, aucune info critique perdue

TYPES SINGLETON (${SINGLETON_TYPES.join(", ")}) : émet EXACTEMENT 1 entrée par type si des données existent. C'est l'état actuel, pas l'historique.

TYPES NORMAUX : fusionne les entrées similaires en gardant les plus récentes et importantes.

Chaque entrée consolidée doit avoir "importance" (3-5) :
- 5 : Critique / irremplaçable
- 4 : Utile et durable
- 3 : Secondaire mais pertinent

Réponds UNIQUEMENT avec un tableau JSON valide. Chaque entrée : "type", "content" (1-2 phrases max), "importance" (3-5).

Exemple :
[
  {"type": "preference", "content": "Le boss veut du pixel art rétro avec une palette de 16 couleurs, inspiré de Celeste", "importance": 5},
  {"type": "progress", "content": "Le prototype du niveau 1 est terminé, passage au level design du niveau 2", "importance": 4},
  {"type": "decision", "content": "Mécaniques roguelike confirmées : permadeath soft + progression méta entre les runs", "importance": 5},
  {"type": "relationship", "content": "Relation détendue et complice, le boss apprécie l'humour de l'agent", "importance": 3}
]`;

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "deepseek/deepseek-chat-v3-0324",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Voici les ${memories.length} souvenirs à consolider :\n\n${memoryDump}` },
      ],
      max_tokens: 800,
      temperature: 0.2,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    return NextResponse.json({ error: errText }, { status: res.status });
  }

  const data = await res.json();
  const raw: string = data.choices?.[0]?.message?.content ?? "[]";

  // Extract JSON array
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    return NextResponse.json({ consolidated: [] });
  }

  try {
    const parsed: ConsolidatedMemory[] = JSON.parse(jsonMatch[0]);
    const validTypes = [
      "summary",
      "decision",
      "preference",
      "progress",
      "relationship",
      "nickname",
      "confidence",
      "boss_profile",
      "family",
      "hobbies",
      "dreams",
      "social",
      "fears",
      "personal_event",
    ];
    const validated = parsed.filter(
      (m) =>
        validTypes.includes(m.type) &&
        typeof m.content === "string" &&
        m.content.trim() &&
        typeof m.importance === "number" &&
        m.importance >= 3
    );
    // Normalise importance to 3-5
    const normalised = validated.map((m) => ({
      ...m,
      importance: Math.max(3, Math.min(5, Math.round(m.importance))),
    }));
    return NextResponse.json({ consolidated: normalised });
  } catch {
    return NextResponse.json({ consolidated: [] });
  }
}
