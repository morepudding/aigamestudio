/**
 * POST /api/post-mortem/[projectId]/generate-skill-prompt
 *
 * Eve lit les reviews d'un agent pour un projet et génère un prompt compétence LEAN.
 * Le prompt est sauvegardé en statut "draft" — il doit être validé manuellement.
 *
 * Body: { agent_slug: string }
 * Returns: { prompt: AgentSkillPrompt }
 */

import { NextRequest, NextResponse } from "next/server";
import { callOpenRouter, LLM_MODELS, LLM_PARAMS } from "@/lib/config/llm";
import { getAgentBySlug } from "@/lib/services/agentService";
import { getProjectById } from "@/lib/services/projectService";
import { getReviewsByProject } from "@/lib/services/taskReviewService";
import {
  createSkillPromptDraft,
  getActiveSkillPrompt,
} from "@/lib/services/agentSkillPromptService";
import { buildEveSkillPromptSystem, buildEveSkillPromptUser } from "@/lib/prompts/eveSkillPromptGen";
import { supabase } from "@/lib/supabase/client";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const body = await req.json();
  const { agent_slug } = body;

  if (!agent_slug) {
    return NextResponse.json({ error: "agent_slug is required" }, { status: 400 });
  }

  // Charger l'agent et le projet en parallèle
  const [agent, project] = await Promise.all([
    getAgentBySlug(agent_slug),
    getProjectById(projectId),
  ]);

  if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  // Récupérer les reviews de ce projet pour cet agent
  const allReviews = await getReviewsByProject(projectId);
  const agentReviews = allReviews.filter((r) => r.agent_slug === agent_slug);

  if (agentReviews.length === 0) {
    return NextResponse.json(
      { error: "Aucune review trouvée pour cet agent sur ce projet. Évalue au moins une tâche avant de générer." },
      { status: 422 }
    );
  }

  // Récupérer les titres des tâches reviewées
  const taskIds = agentReviews.map((r) => r.task_id);
  const { data: tasks } = await supabase
    .from("pipeline_tasks")
    .select("id, title")
    .in("id", taskIds);

  const taskTitles: Record<string, string> = {};
  for (const t of tasks ?? []) {
    taskTitles[t.id] = t.title;
  }

  // Récupérer le prompt compétence actif précédent (pour le versioning)
  const previousPrompt = await getActiveSkillPrompt(agent_slug);

  // Construire les messages pour Eve
  const systemPrompt = buildEveSkillPromptSystem();
  const userMessage = buildEveSkillPromptUser(
    {
      name: agent.name,
      slug: agent.slug,
      department: agent.department,
      position: agent.position ?? null,
      specialization: agent.specialization ?? null,
    },
    project.title,
    agentReviews,
    previousPrompt,
    taskTitles
  );

  try {
    const response = await callOpenRouter(
      LLM_MODELS.tasks,
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      { temperature: 0.3, max_tokens: LLM_PARAMS.tasks.max_tokens }
    );

    const content = response.content.trim();
    if (!content) {
      throw new Error("Eve n'a pas généré de contenu.");
    }

    // Sauvegarder en draft
    const draft = await createSkillPromptDraft(agent_slug, projectId, content);

    return NextResponse.json({ prompt: draft });
  } catch (err) {
    console.error("[post-mortem/generate-skill-prompt]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Génération échouée" },
      { status: 500 }
    );
  }
}
