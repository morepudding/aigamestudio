import { NextRequest, NextResponse } from "next/server";
import { getProjectById } from "@/lib/services/projectService";
import {
  getSessionByProject,
  updateSessionGdd,
} from "@/lib/services/brainstormingService";
import { buildGddV1Prompt, buildGddCritiquePrompt } from "@/lib/prompts/gddReview";
import { callOpenRouter, LLM_MODELS, LLM_PARAMS } from "@/lib/config/llm";
import { buildStudioContext } from "@/lib/services/studioContextService";
import { normalizeMarkdownDeliverable } from "@/lib/utils";
import type { CritiqueQuestion } from "@/lib/types/brainstorming";

// POST /api/gdd-review/[projectId]/start
// 1. Generates GDD V1 from the scope summary (or One Page if available)
// 2. AI self-critiques the V1 and generates structured questions
// Returns: { gddV1, critiqueQuestions }
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;

  const project = await getProjectById(projectId);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const session = await getSessionByProject(projectId);
  if (!session) {
    return NextResponse.json(
      { error: "No brainstorming session found. Complete brainstorming first." },
      { status: 404 }
    );
  }

  if (session.gddFinalized) {
    return NextResponse.json(
      { error: "GDD already finalized." },
      { status: 409 }
    );
  }

  // Return cached V1 + questions if already generated
  if (session.gddV1 && session.gdCritiqueQuestions) {
    return NextResponse.json({
      gddV1: session.gddV1,
      critiqueQuestions: session.gdCritiqueQuestions,
      fromCache: true,
    });
  }

  const { full: studioContext } = await buildStudioContext();

  // Step 1: Generate GDD V1
  // Prefer validated One Page as scope source; fall back to scopeSummary or project.description
  const scopeInput = session.scopeSummary ?? project.description;
  const onePage = session.onePageValidated ? (session.onePage ?? null) : null;

  const v1Prompt = buildGddV1Prompt(project, scopeInput, studioContext, onePage);
  const { content: gddV1Raw } = await callOpenRouter(
    LLM_MODELS.tasks,
    [{ role: "user", content: v1Prompt }],
    { ...LLM_PARAMS.tasks, max_tokens: 4096 }
  );

  const gddV1 = normalizeMarkdownDeliverable(gddV1Raw);

  // Step 2: Self-critique → generate structured questions
  const critiquePrompt = buildGddCritiquePrompt(project, gddV1, studioContext, onePage);
  const { content: critiqueJson } = await callOpenRouter(
    LLM_MODELS.tasks,
    [{ role: "user", content: critiquePrompt }],
    { temperature: 0.3, max_tokens: 1200 }
  );

  let critiqueQuestions: CritiqueQuestion[] = [];
  try {
    const parsed = JSON.parse(critiqueJson.trim());
    critiqueQuestions = Array.isArray(parsed) ? parsed : [];
  } catch {
    critiqueQuestions = [
      {
        id: "q1",
        question: "Y a-t-il des éléments du GDD que tu veux préciser ou modifier ?",
        options: null,
      },
    ];
  }

  await updateSessionGdd(session.id, {
    gddV1,
    gdCritiqueQuestions: critiqueQuestions,
  });

  return NextResponse.json({ gddV1, critiqueQuestions });
}
