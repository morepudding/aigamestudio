import { NextRequest, NextResponse } from "next/server";
import { callOpenRouter, LLM_MODELS, LLM_PARAMS } from "@/lib/config/llm";
import { getAllAgents } from "@/lib/services/agentService";
import { getProjectById } from "@/lib/services/projectService";
import { getSessionByProject } from "@/lib/services/brainstormingService";
import { normalizeGameBrief, type GameGenre, type SessionDuration } from "@/lib/types/brainstorming";

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
  const { type, genre, sessionDuration, theme, projectId, referenceGame, prototypeRef } = body as {
    type: "theme" | "reference" | "scope";
    genre: GameGenre;
    sessionDuration: SessionDuration;
    theme?: string;
    projectId?: string;
    referenceGame?: string;
    prototypeRef?: string;
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

  if (type === "scope") {
    if (!projectId) {
      return NextResponse.json({ error: "projectId is required for scope suggestions" }, { status: 400 });
    }

    const [project, session, agents] = await Promise.all([
      getProjectById(projectId),
      getSessionByProject(projectId),
      getAllAgents(),
    ]);

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const normalizedBrief = normalizeGameBrief(session?.gameBrief);
    const lockedDecisions = normalizedBrief?.lockedDecisions ?? [];
    const scopeSource = {
      genre,
      sessionDuration,
      theme: theme?.trim() || normalizedBrief?.theme || "",
      referenceGame: referenceGame?.trim() || normalizedBrief?.referenceGame || "",
      prototypeRef: prototypeRef?.trim() || normalizedBrief?.prototypeRef || "",
      currentScopeNote: normalizedBrief?.scopeNote || "",
    };

    const studioContext = agents
      .filter((agent) => ["game-design", "programming", "production", "qa", "art"].includes(agent.department))
      .slice(0, 8)
      .map((agent) => {
        const taskNames = agent.tasks.slice(0, 2).map((task) => task.task_name).join(", ");
        return `- ${agent.name} (${agent.department}${agent.position ? `, ${agent.position}` : ""})${taskNames ? ` — tâches: ${taskNames}` : ""}`;
      })
      .join("\n");

    const projectContext = [
      `Projet: ${project.title}`,
      `Description: ${project.description || "Aucune description"}`,
      project.courseInfo
        ? `Contexte pédagogique: ${project.courseInfo.courseName} | module ${project.courseInfo.vnModule} | mécaniques ${project.courseInfo.mechanics.join(", ") || "aucune"}`
        : null,
      project.team.length > 0 ? `Équipe assignée: ${project.team.join(", ")}` : "Équipe assignée: aucune",
      `Genre/mécanique visé: ${GENRE_LABELS[genre]}`,
      `Durée cible: ${DURATION_LABELS[sessionDuration]}`,
      `Thème choisi: ${scopeSource.theme || "non défini"}`,
      `Référence choisie: ${scopeSource.referenceGame || scopeSource.prototypeRef || "non définie"}`,
      scopeSource.currentScopeNote ? `Scope actuel: ${scopeSource.currentScopeNote}` : null,
      lockedDecisions.length > 0
        ? `Décisions déjà verrouillées:\n${lockedDecisions.map((decision) => `- ${decision}`).join("\n")}`
        : "Décisions déjà verrouillées: aucune",
      studioContext ? `Contexte studio disponible:\n${studioContext}` : "Contexte studio disponible: non renseigné",
    ]
      .filter(Boolean)
      .join("\n");

    const prompt = `Tu es producteur IA d'Eden Studio.
Tu dois suggérer des scopes V1 réalistes pour un mini-jeu web très compact.

Contraintes de travail:
- Proposer des scopes faisables pour un V1 studio court, pas des visions long terme.
- Tenir compte du contexte studio, du genre, de la durée, de la référence et des décisions déjà prises.
- Les propositions doivent être spécifiques, concrètes et immédiatement actionnables.
- Éviter les formules vagues comme "faire simple" ou "MVP réduit" sans détail.

${projectContext}

Réponds UNIQUEMENT avec un tableau JSON de 3 objets.
Format:
[
  {"scope": "une seule map, une garde, une extraction, pas d'inventaire", "why": "raison courte"},
  {"scope": "...", "why": "..."},
  {"scope": "...", "why": "..."}
]

Chaque champ scope doit tenir en une phrase concise.`;

    let suggestions: { scope: string; why: string }[] = [];

    try {
      const result = await callOpenRouter(
        LLM_MODELS.tasks,
        [{ role: "user", content: prompt }],
        { ...LLM_PARAMS.tasks, temperature: 0.45, max_tokens: 350 }
      );

      const raw = result.content.trim().replace(/```json|```/g, "").trim();
      suggestions = JSON.parse(raw);
    } catch {
      suggestions = [
        {
          scope: `une seule boucle ${genre}, une seule scène jouable, objectif clair, sans progression secondaire`,
          why: "Réduit le périmètre au coeur du gameplay pour un premier test jouable.",
        },
        {
          scope: `un niveau unique de ${sessionDuration}, une seule mécanique dominante, feedback minimal, fin rapide`,
          why: "Aligne le contenu avec la durée cible et limite les dépendances de production.",
        },
        {
          scope: `prototype centré sur ${theme?.trim() || "le thème choisi"}, une victoire, un échec, aucune feature système annexe`,
          why: "Garde la fantasy du projet sans ouvrir de sous-systèmes coûteux trop tôt.",
        },
      ];
    }

    return NextResponse.json({ suggestions });
  }

  return NextResponse.json({ error: "Unknown suggestion type" }, { status: 400 });
}
