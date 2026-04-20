import { NextRequest, NextResponse } from "next/server";
import { getActiveSkillPrompt } from "@/lib/services/agentSkillPromptService";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const safeSlug = slug.replace(/[^a-z0-9_-]/gi, "");
  if (!safeSlug) {
    return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
  }

  const prompt = await getActiveSkillPrompt(safeSlug);
  return NextResponse.json({ prompt });
}
