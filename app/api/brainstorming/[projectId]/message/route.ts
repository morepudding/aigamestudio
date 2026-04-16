import { NextRequest, NextResponse } from "next/server";
import { getProjectById } from "@/lib/services/projectService";
import {
  getSessionByProject,
  getSessionMessages,
  addMessage,
  getConversationTranscript,
  updateSessionPhase,
} from "@/lib/services/brainstormingService";
import { getAgentBySlug, getAllAgents } from "@/lib/services/agentService";
import type { Agent } from "@/lib/services/agentService";
import {
  buildNextQuestionPrompt,
  buildDynamicQuestionsPrompt,
  buildDynamicQuestionAskPrompt,
  GAME_DESIGN_QUESTIONS,
  PROGRAMMING_QUESTIONS,
  ART_QUESTIONS,
  type TemplateQuestion,
} from "@/lib/prompts/brainstorming";
import { callOpenRouter, LLM_MODELS } from "@/lib/config/llm";
import type { BrainstormingPhase } from "@/lib/types/brainstorming";
import { getNextPhase, PHASE_DEPARTMENT } from "@/lib/types/brainstorming";

// POST /api/brainstorming/[projectId]/message
// Sends a user message and returns the next agent message.
// Handles phase transitions automatically.
// Body: { content: string }

const PHASE_QUESTIONS: Record<string, TemplateQuestion[]> = {
  "game-design": GAME_DESIGN_QUESTIONS,
  "programming": PROGRAMMING_QUESTIONS,
  "art": ART_QUESTIONS,
};

function getAgentForPhase(phase: string, agents: Agent[]): Agent | null {
  const dept = PHASE_DEPARTMENT[phase];
  if (!dept) return null;
  return agents.find((a) => a.department === dept) ?? agents[0] ?? null;
}

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

  // Load agents for this session
  const allAgents = await getAllAgents();
  const sessionAgents = session.agentSlugs
    .map((slug) => allAgents.find((a) => a.slug === slug))
    .filter(Boolean) as Agent[];

  // Save user message
  const userMsg = await addMessage({
    sessionId: session.id,
    role: "user",
    agentSlug: null,
    phase: session.currentPhase,
    content: content.trim(),
  });

  // Get all messages to determine progress within current phase
  const messages = await getSessionMessages(session.id);
  const phaseMessages = messages.filter((m) => m.phase === session.currentPhase);

  // Count how many template questions have been asked and answered in this phase
  const currentPhaseQuestions = PHASE_QUESTIONS[session.currentPhase] ?? [];
  const answeredCount = phaseMessages.filter((m) => m.role === "user").length;

  const currentAgent = getAgentForPhase(session.currentPhase, sessionAgents);

  // Are there more template questions to ask in this phase?
  if (answeredCount < currentPhaseQuestions.length) {
    const nextQuestion = currentPhaseQuestions[answeredCount];

    const transcript = phaseMessages
      .map((m) => `[${m.role === "user" ? "Directeur" : m.agentSlug ?? "Agent"}]: ${m.content}`)
      .join("\n\n");

    const prompt = buildNextQuestionPrompt(
      currentAgent!,
      session.currentPhase,
      nextQuestion,
      transcript
    );

    const { content: agentReply } = await callOpenRouter(
      LLM_MODELS.chat,
      [{ role: "user", content: prompt }],
      { temperature: 0.8, max_tokens: 300 }
    );

    const agentMsg = await addMessage({
      sessionId: session.id,
      role: "agent",
      agentSlug: currentAgent?.slug ?? null,
      phase: session.currentPhase,
      content: agentReply,
      isDynamic: false,
      questionKey: nextQuestion.key,
    });

    return NextResponse.json({
      userMessage: userMsg,
      agentMessage: agentMsg,
      phaseChanged: false,
      currentPhase: session.currentPhase,
    });
  }

  // All template questions answered — determine what's next

  // If we're in a template phase (game-design / programming / art),
  // transition to dynamic questions if this is the last template phase with dynamics,
  // or to the next template phase.
  const isTemplatePhase = ["game-design", "programming", "art"].includes(session.currentPhase);

  if (isTemplatePhase) {
    const nextPhase = getNextPhase(session.currentPhase as BrainstormingPhase);
    await updateSessionPhase(session.id, nextPhase, session.currentPhase as BrainstormingPhase);

    // If next phase is dynamic, generate dynamic questions from full transcript
    if (nextPhase === "dynamic") {
      const transcript = await getConversationTranscript(session.id);

      // Use the first available agent to generate dynamic questions
      const dynAgent = currentAgent ?? sessionAgents[0];

      const dynPrompt = buildDynamicQuestionsPrompt(dynAgent!, project, transcript);

      const { content: dynJson } = await callOpenRouter(
        LLM_MODELS.tasks,
        [{ role: "user", content: dynPrompt }],
        { temperature: 0.5, max_tokens: 800 }
      );

      // Parse dynamic questions
      let dynamicQuestions: TemplateQuestion[] = [];
      try {
        dynamicQuestions = JSON.parse(dynJson.trim());
      } catch {
        dynamicQuestions = [];
      }

      if (dynamicQuestions.length === 0) {
        // Skip dynamic phase, go to synthesis
        await updateSessionPhase(session.id, "synthesis", "dynamic");
        return NextResponse.json({
          userMessage: userMsg,
          agentMessage: null,
          phaseChanged: true,
          currentPhase: "synthesis",
          readyForSynthesis: true,
        });
      }

      // Ask the first dynamic question
      const transcriptForDyn = await getConversationTranscript(session.id);
      const askPrompt = buildDynamicQuestionAskPrompt(
        dynAgent!,
        dynamicQuestions[0],
        transcriptForDyn
      );

      const { content: dynReply } = await callOpenRouter(
        LLM_MODELS.chat,
        [{ role: "user", content: askPrompt }],
        { temperature: 0.8, max_tokens: 300 }
      );

      // Store dynamic questions in session for later use via a system message
      const dynQuestionsJson = JSON.stringify(dynamicQuestions);
      await addMessage({
        sessionId: session.id,
        role: "system",
        agentSlug: null,
        phase: "dynamic",
        content: `__DYN_QUESTIONS__${dynQuestionsJson}`,
        isDynamic: false,
        questionKey: "__questions_store__",
      });

      const agentMsg = await addMessage({
        sessionId: session.id,
        role: "agent",
        agentSlug: dynAgent?.slug ?? null,
        phase: "dynamic",
        content: dynReply,
        isDynamic: true,
        questionKey: dynamicQuestions[0].key,
      });

      return NextResponse.json({
        userMessage: userMsg,
        agentMessage: agentMsg,
        phaseChanged: true,
        currentPhase: "dynamic",
      });
    }

    // Next phase is another template phase (programming or art)
    const nextAgent = getAgentForPhase(nextPhase, sessionAgents);
    const nextPhaseQuestions = PHASE_QUESTIONS[nextPhase] ?? [];

    if (!nextAgent || nextPhaseQuestions.length === 0) {
      // Skip this phase
      const afterNext = getNextPhase(nextPhase as BrainstormingPhase);
      await updateSessionPhase(session.id, afterNext, nextPhase as BrainstormingPhase);
      return NextResponse.json({
        userMessage: userMsg,
        agentMessage: null,
        phaseChanged: true,
        currentPhase: afterNext,
        readyForSynthesis: afterNext === "synthesis",
      });
    }

    // Agent introduces themselves and asks first question of their phase
    const introPrompt = `Tu es ${nextAgent.name}, ${nextAgent.role}. Personnalité: ${nextAgent.personality_primary}.
Le brainstorming passe maintenant à ta phase: exploration ${nextPhase === "programming" ? "technique" : "artistique"} du projet "${project.title}".
Présente-toi brièvement (1 phrase dans ton style) et pose directement cette première question :
"${nextPhaseQuestions[0].text}"
2-4 phrases max. Français.`;

    const { content: introReply } = await callOpenRouter(
      LLM_MODELS.chat,
      [{ role: "user", content: introPrompt }],
      { temperature: 0.8, max_tokens: 300 }
    );

    const agentMsg = await addMessage({
      sessionId: session.id,
      role: "agent",
      agentSlug: nextAgent.slug,
      phase: nextPhase,
      content: introReply,
      isDynamic: false,
      questionKey: nextPhaseQuestions[0].key,
    });

    return NextResponse.json({
      userMessage: userMsg,
      agentMessage: agentMsg,
      phaseChanged: true,
      currentPhase: nextPhase,
    });
  }

  // We're in the dynamic phase — continue dynamic questions
  if (session.currentPhase === "dynamic") {
    const allMessages = await getSessionMessages(session.id);

    // Retrieve stored dynamic questions
    const storedMsg = allMessages.find((m) => m.questionKey === "__questions_store__");
    let dynamicQuestions: TemplateQuestion[] = [];
    if (storedMsg) {
      try {
        dynamicQuestions = JSON.parse(storedMsg.content.replace("__DYN_QUESTIONS__", ""));
      } catch {
        dynamicQuestions = [];
      }
    }

    const dynAnsweredCount = allMessages.filter(
      (m) => m.phase === "dynamic" && m.role === "user"
    ).length;

    const dynAgent = getAgentForPhase("game-design", sessionAgents) ?? sessionAgents[0];

    if (dynAnsweredCount < dynamicQuestions.length) {
      const nextDynQ = dynamicQuestions[dynAnsweredCount];
      const transcript = allMessages
        .filter((m) => m.questionKey !== "__questions_store__")
        .map((m) => `[${m.role === "user" ? "Directeur" : m.agentSlug ?? "Système"}]: ${m.content}`)
        .join("\n\n");

      const askPrompt = buildDynamicQuestionAskPrompt(dynAgent!, nextDynQ, transcript);
      const { content: dynReply } = await callOpenRouter(
        LLM_MODELS.chat,
        [{ role: "user", content: askPrompt }],
        { temperature: 0.8, max_tokens: 300 }
      );

      const agentMsg = await addMessage({
        sessionId: session.id,
        role: "agent",
        agentSlug: dynAgent?.slug ?? null,
        phase: "dynamic",
        content: dynReply,
        isDynamic: true,
        questionKey: nextDynQ.key,
      });

      return NextResponse.json({
        userMessage: userMsg,
        agentMessage: agentMsg,
        phaseChanged: false,
        currentPhase: "dynamic",
      });
    }

    // All dynamic questions answered — ready for synthesis
    await updateSessionPhase(session.id, "synthesis", "dynamic");

    return NextResponse.json({
      userMessage: userMsg,
      agentMessage: null,
      phaseChanged: true,
      currentPhase: "synthesis",
      readyForSynthesis: true,
    });
  }

  return NextResponse.json({
    userMessage: userMsg,
    agentMessage: null,
    phaseChanged: false,
    currentPhase: session.currentPhase,
  });
}
