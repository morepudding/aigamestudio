import { NextRequest, NextResponse } from "next/server";
import { getProjectById } from "@/lib/services/projectService";
import {
  getSessionByProject,
  createSession,
  getSessionMessages,
} from "@/lib/services/brainstormingService";
import { getAgentBySlug } from "@/lib/services/agentService";
import {
  buildPhaseOpeningPrompt,
  GAME_DESIGN_QUESTIONS,
} from "@/lib/prompts/brainstorming";
import { callOpenRouter, LLM_MODELS, LLM_PARAMS } from "@/lib/config/llm";
import { addMessage } from "@/lib/services/brainstormingService";

// GET /api/brainstorming/[projectId]/session
// Returns existing session + messages, or null if none
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const session = await getSessionByProject(projectId);
  if (!session) return NextResponse.json(null);

  const messages = await getSessionMessages(session.id);
  return NextResponse.json({ session, messages });
}

// POST /api/brainstorming/[projectId]/session
// Creates a new brainstorming session and sends the first agent message
// Body: { agentSlugs: string[] }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const body = await req.json();
  const { agentSlugs } = body as { agentSlugs: string[] };

  if (!agentSlugs || agentSlugs.length < 1) {
    return NextResponse.json(
      { error: "agentSlugs must have at least 1 agent" },
      { status: 400 }
    );
  }

  const project = await getProjectById(projectId);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const session = await createSession(projectId, agentSlugs);
  if (!session) {
    return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
  }

  // Find the game-design agent (first in list that matches, or first agent)
  const agentList = await Promise.all(agentSlugs.map((s) => getAgentBySlug(s)));
  const validAgents = agentList.filter(Boolean);

  const gameDesignAgent =
    validAgents.find((a) => a!.department === "game-design") ?? validAgents[0];

  if (!gameDesignAgent) {
    return NextResponse.json({ error: "No valid agents found" }, { status: 400 });
  }

  // Generate the opening message for the game-design phase
  const systemPrompt = buildPhaseOpeningPrompt(
    gameDesignAgent,
    "game-design",
    project,
    GAME_DESIGN_QUESTIONS
  );

  const { content: agentOpening } = await callOpenRouter(
    LLM_MODELS.chat,
    [{ role: "user", content: systemPrompt }],
    { temperature: 0.8, max_tokens: 400 }
  );

  // Save the opening message
  const msg = await addMessage({
    sessionId: session.id,
    role: "agent",
    agentSlug: gameDesignAgent.slug,
    phase: "game-design",
    content: agentOpening,
    isDynamic: false,
    questionKey: "opening",
  });

  return NextResponse.json({ session, messages: [msg] }, { status: 201 });
}
