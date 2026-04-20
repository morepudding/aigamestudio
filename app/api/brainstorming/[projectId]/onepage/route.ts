import { NextRequest, NextResponse } from "next/server";
import { getProjectById } from "@/lib/services/projectService";
import {
  getSessionByProject,
  updateSessionOnePage,
} from "@/lib/services/brainstormingService";
import { getAgentBySlug } from "@/lib/services/agentService";
import { buildOnePageGeneratePrompt } from "@/lib/prompts/onePage";
import { callOpenRouter, LLM_MODELS, LLM_PARAMS } from "@/lib/config/llm";
import { buildStudioContext } from "@/lib/services/studioContextService";
import type { OnePageComments } from "@/lib/types/brainstorming";

// POST /api/brainstorming/[projectId]/onepage
// Body: { action: "generate" | "regenerate", comments?: OnePageComments }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const body = await req.json();
  const { action, comments } = body as {
    action: "generate" | "regenerate";
    comments?: OnePageComments;
  };

  const project = await getProjectById(projectId);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const session = await getSessionByProject(projectId);
  if (!session) {
    return NextResponse.json({ error: "No brainstorming session found" }, { status: 404 });
  }

  if (!session.gameBrief) {
    return NextResponse.json({ error: "No game brief found on session" }, { status: 400 });
  }

  const agentSlug = session.agentSlugs[0];
  const agent = await getAgentBySlug(agentSlug);
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const { full: studioContext } = await buildStudioContext();

  const prompt = buildOnePageGeneratePrompt(
    agent,
    project,
    session.gameBrief,
    studioContext,
    action === "regenerate" ? (comments ?? session.onePageComments) : null,
    action === "regenerate" ? session.onePage : null
  );

  const { content: onePage } = await callOpenRouter(
    LLM_MODELS.tasks,
    [{ role: "user", content: prompt }],
    LLM_PARAMS.tasks
  );

  await updateSessionOnePage(session.id, {
    onePage,
    onePageComments: null,
    currentPhase: "one-page",
  });

  return NextResponse.json({ onePage });
}

// PATCH /api/brainstorming/[projectId]/onepage
// Body: { action: "comment", comments: OnePageComments } | { action: "validate" }
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const body = await req.json();
  const { action, comments } = body as {
    action: "comment" | "validate";
    comments?: OnePageComments;
  };

  const session = await getSessionByProject(projectId);
  if (!session) {
    return NextResponse.json({ error: "No brainstorming session found" }, { status: 404 });
  }

  if (action === "comment") {
    await updateSessionOnePage(session.id, { onePageComments: comments ?? null });
    return NextResponse.json({ ok: true });
  }

  if (action === "validate") {
    await updateSessionOnePage(session.id, {
      onePageValidated: true,
      currentPhase: "completed",
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
