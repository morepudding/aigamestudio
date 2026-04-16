import { NextRequest, NextResponse } from "next/server";
import { getProjectById } from "@/lib/services/projectService";
import {
  getSessionByProject,
  getSessionMessages,
  addMessage,
  getConversationTranscript,
  updateSessionPhase,
} from "@/lib/services/brainstormingService";
import { getAllAgents } from "@/lib/services/agentService";
import type { Agent } from "@/lib/services/agentService";
import {
  buildAdaptiveFilterPrompt,
  buildAdaptiveQuestionPrompt,
  type TemplateQuestion,
} from "@/lib/prompts/brainstorming";
import { callOpenRouter, LLM_MODELS } from "@/lib/config/llm";

// POST /api/brainstorming/[projectId]/message
// Sends a user message and returns the next agent message.
// Uses adaptive flow: after first answer, AI filters questions by project complexity.
// Eve (or lead agent) handles the entire brainstorming.
// Body: { content: string }

const ADAPTED_PLAN_KEY = "__adapted_plan__";
const ADAPTED_PLAN_PREFIX = "__ADAPTED_PLAN__";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const body = await req.json();
  const { content } = body as { content: string };

  if (!content?.trim()) {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }

  const project = await getProjectById(projectId);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const session = await getSessionByProject(projectId);
  if (!session) {
    return NextResponse.json({ error: "No brainstorming session found" }, { status: 404 });
  }

  if (session.currentPhase === "completed" || session.currentPhase === "synthesis") {
    return NextResponse.json(
      { error: "Brainstorming already completed" },
      { status: 409 }
    );
  }

  // Load agents — use first session agent (Eve / lead) for the entire brainstorming
  const allAgents = await getAllAgents();
  const sessionAgents = session.agentSlugs
    .map((slug) => allAgents.find((a) => a.slug === slug))
    .filter(Boolean) as Agent[];
  const leadAgent = sessionAgents[0];

  if (!leadAgent) {
    return NextResponse.json({ error: "No valid agents found" }, { status: 400 });
  }

  // Save user message
  const userMsg = await addMessage({
    sessionId: session.id,
    role: "user",
    agentSlug: null,
    phase: session.currentPhase,
    content: content.trim(),
  });

  // Get all messages
  const messages = await getSessionMessages(session.id);

  // Check if we already have an adapted plan
  const adaptedPlanMsg = messages.find((m) => m.questionKey === ADAPTED_PLAN_KEY);

  // ────────────────────────────────────────────────
  // No adapted plan yet → generate one after first user answer
  // ────────────────────────────────────────────────
  if (!adaptedPlanMsg) {
    const transcript = messages
      .map((m) => {
        const speaker = m.role === "user" ? "Directeur" : m.agentSlug ?? "Système";
        return `[${speaker}]: ${m.content}`;
      })
      .join("\n\n");

    // Ask LLM to filter & adapt questions based on project complexity
    const filterMessages = buildAdaptiveFilterPrompt(leadAgent, project, transcript);
    const { content: filterJson } = await callOpenRouter(
      LLM_MODELS.tasks,
      filterMessages,
      { temperature: 0.4, max_tokens: 1000 }
    );

    // Parse the adapted plan
    let adaptedPlan: { complexity: string; questions: TemplateQuestion[] };
    try {
      adaptedPlan = JSON.parse(filterJson.trim());
      if (!Array.isArray(adaptedPlan.questions)) throw new Error("invalid questions");
    } catch {
      // Fallback: 3 essential questions for a simple project
      adaptedPlan = {
        complexity: "simple",
        questions: [
          { key: "fallback_1", text: "Sur quelle plateforme tu veux sortir ça ? (Web, mobile, PC)" },
          { key: "fallback_2", text: "Quel style visuel tu imagines ? (pixel art, minimaliste, cartoon…)" },
          { key: "fallback_3", text: "C'est quoi ta deadline ou ton timeframe idéal pour la V1 ?" },
        ],
      };
    }

    // Store adapted plan as system message
    await addMessage({
      sessionId: session.id,
      role: "system",
      agentSlug: null,
      phase: session.currentPhase,
      content: `${ADAPTED_PLAN_PREFIX}${JSON.stringify(adaptedPlan)}`,
      questionKey: ADAPTED_PLAN_KEY,
    });

    // If no questions needed (very simple), go straight to synthesis
    if (adaptedPlan.questions.length === 0) {
      await updateSessionPhase(session.id, "synthesis", session.currentPhase);
      return NextResponse.json({
        userMessage: userMsg,
        agentMessage: null,
        phaseChanged: true,
        currentPhase: "synthesis",
        readyForSynthesis: true,
      });
    }

    // Ask the first adapted question
    const firstQ = adaptedPlan.questions[0];
    const askMessages = buildAdaptiveQuestionPrompt(leadAgent, firstQ, transcript);
    const { content: reply } = await callOpenRouter(
      LLM_MODELS.chat,
      askMessages,
      { temperature: 0.8, max_tokens: 300 }
    );

    const agentMsg = await addMessage({
      sessionId: session.id,
      role: "agent",
      agentSlug: leadAgent.slug,
      phase: session.currentPhase,
      content: reply,
      isDynamic: false,
      questionKey: firstQ.key,
    });

    return NextResponse.json({
      userMessage: userMsg,
      agentMessage: agentMsg,
      phaseChanged: false,
      currentPhase: session.currentPhase,
      adaptedComplexity: adaptedPlan.complexity,
    });
  }

  // ────────────────────────────────────────────────
  // Adapted plan exists → continue asking adapted questions
  // ────────────────────────────────────────────────
  let adaptedPlan: { complexity: string; questions: TemplateQuestion[] };
  try {
    adaptedPlan = JSON.parse(
      adaptedPlanMsg.content.replace(ADAPTED_PLAN_PREFIX, "")
    );
  } catch {
    // Corrupted plan, go to synthesis
    await updateSessionPhase(session.id, "synthesis", session.currentPhase);
    return NextResponse.json({
      userMessage: userMsg,
      agentMessage: null,
      phaseChanged: true,
      currentPhase: "synthesis",
      readyForSynthesis: true,
    });
  }

  // Count user answers AFTER the adapted plan was stored
  const planSortOrder = adaptedPlanMsg.sortOrder;
  const adaptedAnsweredCount = messages.filter(
    (m) => m.role === "user" && m.sortOrder > planSortOrder
  ).length;

  if (adaptedAnsweredCount < adaptedPlan.questions.length) {
    // Ask next adapted question
    const nextQ = adaptedPlan.questions[adaptedAnsweredCount];

    const transcript = messages
      .filter((m) => m.questionKey !== ADAPTED_PLAN_KEY)
      .map((m) => {
        const speaker = m.role === "user" ? "Directeur" : m.agentSlug ?? "Système";
        return `[${speaker}]: ${m.content}`;
      })
      .join("\n\n");

    const askMessages = buildAdaptiveQuestionPrompt(leadAgent, nextQ, transcript);
    const { content: reply } = await callOpenRouter(
      LLM_MODELS.chat,
      askMessages,
      { temperature: 0.8, max_tokens: 300 }
    );

    const agentMsg = await addMessage({
      sessionId: session.id,
      role: "agent",
      agentSlug: leadAgent.slug,
      phase: session.currentPhase,
      content: reply,
      isDynamic: false,
      questionKey: nextQ.key,
    });

    return NextResponse.json({
      userMessage: userMsg,
      agentMessage: agentMsg,
      phaseChanged: false,
      currentPhase: session.currentPhase,
    });
  }

  // All adapted questions answered → go to synthesis
  await updateSessionPhase(session.id, "synthesis", session.currentPhase);

  return NextResponse.json({
    userMessage: userMsg,
    agentMessage: null,
    phaseChanged: true,
    currentPhase: "synthesis",
    readyForSynthesis: true,
  });
}
