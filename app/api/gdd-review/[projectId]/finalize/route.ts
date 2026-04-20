import { NextRequest, NextResponse } from "next/server";
import { getProjectById, updateProject } from "@/lib/services/projectService";
import {
  getSessionByProject,
  updateSessionGdd,
} from "@/lib/services/brainstormingService";
import { buildGddV2Prompt } from "@/lib/prompts/gddReview";
import { callOpenRouter, LLM_MODELS, LLM_PARAMS } from "@/lib/config/llm";
import { buildStudioContext } from "@/lib/services/studioContextService";
import { normalizeMarkdownDeliverable } from "@/lib/utils";

// POST /api/gdd-review/[projectId]/finalize
// 1. Generates GDD V2 from V1 + director's answers
// 2. Marks GDD as finalized (decisionsReady = true)
// Returns: { gddV2 }
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
    return NextResponse.json({ error: "No brainstorming session found" }, { status: 404 });
  }

  if (!session.gddV1) {
    return NextResponse.json(
      { error: "GDD V1 not generated. Call /start first." },
      { status: 409 }
    );
  }

  if (session.gddFinalized && session.gddV2) {
    return NextResponse.json({ gddV2: session.gddV2, fromCache: true });
  }

  const questions = session.gdCritiqueQuestions ?? [];
  const answers = session.gddAnswers ?? {};

  const unanswered = questions.filter((q) => !answers[q.id]);
  if (unanswered.length > 0) {
    return NextResponse.json(
      {
        error: "All critique questions must be answered before finalizing.",
        unanswered: unanswered.map((q) => q.id),
      },
      { status: 422 }
    );
  }

  const { full: studioContext } = await buildStudioContext();

  const v2Prompt = buildGddV2Prompt(project, session.gddV1, questions, answers, studioContext);
  const { content: gddV2Raw } = await callOpenRouter(
    LLM_MODELS.tasks,
    [{ role: "user", content: v2Prompt }],
    { ...LLM_PARAMS.tasks, max_tokens: 4096 }
  );

  const gddV2 = normalizeMarkdownDeliverable(gddV2Raw);

  await updateSessionGdd(session.id, {
    gddV2,
    gddFinalized: true,
  });

  await updateProject(projectId, { decisionsReady: true });

  return NextResponse.json({ gddV2 });
}
