import { NextRequest, NextResponse } from "next/server";
import { getProjectById } from "@/lib/services/projectService";
import {
  getSessionByProject,
  createSession,
  getSessionMessages,
} from "@/lib/services/brainstormingService";
import type { GameBrief } from "@/lib/types/brainstorming";

// GET /api/brainstorming/[projectId]/session
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
// Body: { agentSlugs: string[], gameBrief: GameBrief }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const body = await req.json();
  const { agentSlugs, gameBrief } = body as { agentSlugs: string[]; gameBrief?: GameBrief };

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

  const session = await createSession(projectId, agentSlugs, gameBrief);
  if (!session) {
    return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
  }

  return NextResponse.json({ session, messages: [] }, { status: 201 });
}
