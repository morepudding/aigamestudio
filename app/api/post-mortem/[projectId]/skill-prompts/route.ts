import { NextRequest, NextResponse } from "next/server";
import {
  getAllSkillPrompts,
  activateSkillPrompt,
  updateSkillPromptContent,
} from "@/lib/services/agentSkillPromptService";

// GET /api/post-mortem/[projectId]/skill-prompts?agent_slug=xxx
// Retourne tous les prompts compétence d'un agent
export async function GET(req: NextRequest) {
  const agentSlug = req.nextUrl.searchParams.get("agent_slug");
  if (!agentSlug) {
    return NextResponse.json({ error: "agent_slug query param is required" }, { status: 400 });
  }

  const prompts = await getAllSkillPrompts(agentSlug);
  return NextResponse.json(prompts);
}

// PATCH /api/post-mortem/[projectId]/skill-prompts
// Actions : activate | update-content
// Body activate  : { prompt_id, action: "activate" }
// Body update    : { prompt_id, action: "update-content", content }
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { prompt_id, action, content } = body;

  if (!prompt_id || !action) {
    return NextResponse.json({ error: "prompt_id and action are required" }, { status: 400 });
  }

  try {
    if (action === "activate") {
      const updated = await activateSkillPrompt(prompt_id);
      return NextResponse.json(updated);
    }

    if (action === "update-content") {
      if (!content || typeof content !== "string") {
        return NextResponse.json({ error: "content is required for update-content" }, { status: 400 });
      }
      const updated = await updateSkillPromptContent(prompt_id, content);
      return NextResponse.json(updated);
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update skill prompt" },
      { status: 500 }
    );
  }
}
