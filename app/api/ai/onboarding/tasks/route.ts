import { NextRequest, NextResponse } from "next/server";
import yaml from "js-yaml";
import { getAgentBySlug } from "@/lib/services/agentService";
import { LLM_MODELS } from "@/lib/config/llm";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPEN_ROUTE_SERVICE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Missing API key" }, { status: 500 });
  }

  const body = await req.json();
  const { slug, projectTitle, projectDescription, projectGenre, context, answers, refinement } = body;

  if (!slug) {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  }

  const safeSlug = slug.replace(/[^a-z0-9_-]/gi, "");
  const agent = await getAgentBySlug(safeSlug);
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const isStudioRole = !projectTitle;
  const assignmentContext = isStudioRole
    ? "Cet agent travaille au niveau studio/direction, pas sur un jeu spécifique."
    : `Cet agent est assigné au projet "${projectTitle}" — ${projectDescription}. Genre : ${projectGenre}.`;

  // Build context from free-text input
  let contextBlock = "";
  if (context && typeof context === "string") {
    contextBlock = `\n\nContexte et priorités fournis par le directeur du studio :\n"${context.trim()}"`;
  }

  // Build answers context from precision questions
  let answersBlock = "";
  if (answers && Array.isArray(answers) && answers.length > 0) {
    answersBlock = "\n\nRéponses aux questions de précision :\n" +
      answers.map((a: { question: string; answer: string }) => `- ${a.question} → ${a.answer}`).join("\n");
  }

  let refinementContext = "";
  if (refinement) {
    refinementContext = `\n\nLe directeur a demandé cet ajustement : "${refinement}". Adapte les tâches en conséquence.`;
  }

  const agentKey = agent.name.toLowerCase().replace(/ /g, "_");

  const prompt = `Tu es un expert en gestion de studio de jeux vidéo.

Génère 3-4 tâches d'onboarding concrètes et actionnables pour cet agent qui vient d'être recruté :

- Nom : ${agent.name}
- Rôle : ${agent.role}
- Département : ${agent.department}
- Personnalité : ${agent.personality_primary} avec une nuance de ${agent.personality_nuance}
- ${assignmentContext}${contextBlock}${answersBlock}${refinementContext}

Les tâches doivent être des premières actions concrètes, alignées sur les réponses du directeur.

Réponds UNIQUEMENT en YAML valide sans backticks :

tasks:
  - task_name: "..."
    description: "..."
    expected_output: "..."
    agent: ${agentKey}`;

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
          content:
            "Tu génères des fichiers YAML CrewAI. Réponds uniquement en YAML valide, sans backticks markdown.",
        },
        { role: "user", content: prompt },
      ],
      max_tokens: 1000,
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    return NextResponse.json({ error: errText }, { status: res.status });
  }

  const data = await res.json();
  const tasksYaml = data.choices?.[0]?.message?.content ?? "";

  // Parse tasks for response
  let tasks: { task_name?: string; description?: string; expected_output?: string }[] = [];
  try {
    const cleaned = tasksYaml
      .replace(/^```ya?ml\s*/m, "")
      .replace(/^```\s*$/m, "")
      .trim();
    const parsed = yaml.load(cleaned) as { tasks?: typeof tasks } | null;
    if (parsed && Array.isArray(parsed.tasks)) {
      tasks = parsed.tasks;
    }
  } catch {
    // parse error, return raw
  }

  return NextResponse.json({ success: true, tasks, raw: tasksYaml });
}
