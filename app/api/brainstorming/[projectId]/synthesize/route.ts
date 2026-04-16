import { NextRequest, NextResponse } from "next/server";
import { getProjectById } from "@/lib/services/projectService";
import {
  getSessionByProject,
  getConversationTranscript,
  updateSessionScope,
  addMessage,
} from "@/lib/services/brainstormingService";
import { getAllAgents } from "@/lib/services/agentService";
import type { Agent } from "@/lib/services/agentService";
import { buildSynthesisPrompt } from "@/lib/prompts/brainstorming";
import { callOpenRouter, LLM_MODELS, LLM_PARAMS } from "@/lib/config/llm";

// POST /api/brainstorming/[projectId]/synthesize
// Generates a scope summary from the brainstorming transcript.
// No body required — uses existing session messages.
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

  if (session.currentPhase !== "synthesis") {
    return NextResponse.json(
      { error: `Cannot synthesize in phase "${session.currentPhase}". Must be "synthesis".` },
      { status: 409 }
    );
  }

  // Get full conversation transcript
  const transcript = await getConversationTranscript(session.id);

  // Get agent names for attribution
  const allAgents = await getAllAgents();
  const sessionAgents = session.agentSlugs
    .map((slug) => allAgents.find((a) => a.slug === slug))
    .filter(Boolean) as Agent[];
  const agentNames = sessionAgents.map((a) => a.name);

  // Build synthesis prompt
  const prompt = buildSynthesisPrompt(project, transcript, agentNames);

  const { content: scopeSummary } = await callOpenRouter(
    LLM_MODELS.tasks,
    [{ role: "user", content: prompt }],
    { ...LLM_PARAMS.tasks, max_tokens: 2000 }
  );

  // Save scope summary and mark brainstorming as completed
  await updateSessionScope(session.id, scopeSummary);

  // Add a system message marking the end of brainstorming
  await addMessage({
    sessionId: session.id,
    role: "system",
    agentSlug: null,
    phase: "synthesis",
    content: scopeSummary,
    questionKey: "__scope_summary__",
  });

  return NextResponse.json({
    scopeSummary,
    sessionId: session.id,
  });
}
