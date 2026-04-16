import { NextRequest, NextResponse } from "next/server";
import { getAgentBySlug } from "@/lib/services/agentService";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPEN_ROUTE_SERVICE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Missing API key" }, { status: 500 });
  }

  const body = await req.json();
  const { slug, projectTitle, projectDescription, projectGenre, context } = body;

  if (!slug) {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  }

  const safeSlug = slug.replace(/[^a-z0-9_-]/gi, "");
  const agent = await getAgentBySlug(safeSlug);
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const isStudioRole = agent.assigned_project === "studio" || !projectTitle;
  const assignmentContext = isStudioRole
    ? "Cet agent a un rôle studio/direction transversal."
    : `Cet agent est assigné au projet "${projectTitle}" — ${projectDescription}. Genre du jeu : ${projectGenre}.`;

  let contextBlock = "";
  if (context && typeof context === "string" && context.trim()) {
    contextBlock = `\n\nLe directeur du studio a fourni ce cadrage libre :\n"${context.trim()}"`;
  }

  const promptSections = [
    'Tu es un assistant de configuration pour un studio de jeux vidéo "Eden Studio".',
    "",
    "Le directeur vient de recruter un nouvel agent et a fourni un cadrage initial (ou pas). Tu dois poser 1 à 2 questions de précision courtes pour affiner la configuration des premières tâches.",
    "",
    "L'agent :",
    `- Nom : ${agent.name}`,
    `- Rôle : ${agent.role}`,
    `- Département : ${agent.department}`,
    `- ${assignmentContext}`,
    contextBlock,
    "",
    "Règles :",
    "- Pose exactement 1 ou 2 questions (pas plus)",
    "- Chaque question doit proposer 3-4 options courtes prédéfinies",
    "- Les questions doivent compléter le cadrage du directeur, pas le répéter",
    "- Si le directeur a déjà bien cadré, pose des questions plus fines (priorité, méthode, délai…)",
    "- Si aucun cadrage n'a été fourni, pose des questions sur les priorités et le périmètre",
    "- L'utilisateur pourra aussi écrire une réponse libre en plus des options",
    "",
    "Réponds UNIQUEMENT en JSON valide, sans backticks :",
    "{",
    '  "questions": [',
    "    {",
    '      "id": "q1",',
    '      "question": "...",',
    '      "options": ["option 1", "option 2", "option 3"]',
    "    }",
    "  ]",
    "}",
  ];
  const prompt = promptSections.join("\n");

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "deepseek/deepseek-chat-v3-0324",
      messages: [
        {
          role: "system",
          content:
            "Tu es un assistant qui pose 1-2 questions de précision pour configurer un agent IA dans un studio de jeux vidéo. Réponds uniquement en JSON valide, sans backticks markdown, sans texte avant ou après.",
        },
        { role: "user", content: prompt },
      ],
      max_tokens: 600,
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    return NextResponse.json({ error: errText }, { status: res.status });
  }

  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content ?? "{}";

  try {
    const cleaned = raw
      .replace(/^```(?:json)?\s*/m, "")
      .replace(/```\s*$/m, "")
      .trim();
    const parsed = JSON.parse(cleaned);
    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json({ questions: [], raw });
  }
}
