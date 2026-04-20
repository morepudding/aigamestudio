import { NextRequest, NextResponse } from "next/server";
import { callOpenRouter, LLM_MODELS, LLM_PARAMS } from "@/lib/config/llm";
import type { GameGenre, SessionDuration } from "@/lib/types/brainstorming";

const GENRE_LABELS: Record<GameGenre, string> = {
  action: "Action",
  puzzle: "Puzzle / Réflexion",
  stealth: "Stealth / Infiltration",
  arcade: "Arcade",
  rpg: "RPG",
  autre: "Autre",
};

const DURATION_LABELS: Record<SessionDuration, string> = {
  "2min": "moins de 2 minutes",
  "5min": "5 minutes",
  "15min": "10 à 15 minutes",
};

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { type, genre, sessionDuration, theme } = body as {
    type: "theme" | "reference";
    genre: GameGenre;
    sessionDuration: SessionDuration;
    theme?: string;
  };

  if (!type || !genre || !sessionDuration) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (type === "theme") {
    const prompt = `Tu es consultant game design pour un studio de mini-jeux espion pédagogiques.
Genre mécanique : ${GENRE_LABELS[genre]}
Durée de session : ${DURATION_LABELS[sessionDuration]}

Propose 4 univers / thèmes espion différents et originaux adaptés à ce genre et cette durée.
Chaque thème doit être une phrase courte (5-10 mots max), évocatrice, avec un contexte historique ou fictif précis.
Exemples de format : "Espion médiéval — séduction et assassinat", "Agent soviétique — guerre froide et désinformation"

Réponds UNIQUEMENT avec un tableau JSON de 4 strings. Pas d'explication, pas de markdown.
Format : ["thème 1", "thème 2", "thème 3", "thème 4"]`;

    const result = await callOpenRouter(
      LLM_MODELS.tasks,
      [{ role: "user", content: prompt }],
      { temperature: 0.8, max_tokens: 200 }
    );

    let suggestions: string[] = [];
    try {
      const raw = result.content.trim().replace(/```json|```/g, "").trim();
      suggestions = JSON.parse(raw);
    } catch {
      suggestions = [];
    }

    return NextResponse.json({ suggestions });
  }

  if (type === "reference") {
    const prompt = `Tu es consultant game design senior.
Genre mécanique : ${GENRE_LABELS[genre]}
Durée de session : ${DURATION_LABELS[sessionDuration]}
${theme ? `Univers / thème : ${theme}` : ""}

Propose 4 jeux vidéo existants qui peuvent servir de référence de game design pour un jeu avec ces caractéristiques.
Choisis des jeux connus, variés, avec des mécaniques pertinentes — pas forcément du même univers.

Réponds UNIQUEMENT avec un tableau JSON. Pas d'explication, pas de markdown.
Format : [{"title": "Nom du jeu", "why": "Pourquoi c'est une bonne référence (1 phrase courte)"}]`;

    const result = await callOpenRouter(
      LLM_MODELS.tasks,
      [{ role: "user", content: prompt }],
      { temperature: 0.6, max_tokens: 300 }
    );

    let suggestions: { title: string; why: string }[] = [];
    try {
      const raw = result.content.trim().replace(/```json|```/g, "").trim();
      suggestions = JSON.parse(raw);
    } catch {
      suggestions = [];
    }

    return NextResponse.json({ suggestions });
  }

  return NextResponse.json({ error: "Unknown suggestion type" }, { status: 400 });
}
