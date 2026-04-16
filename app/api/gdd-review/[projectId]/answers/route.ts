import { NextRequest, NextResponse } from "next/server";
import {
  getSessionByProject,
  updateSessionGdd,
} from "@/lib/services/brainstormingService";

// PATCH /api/gdd-review/[projectId]/answers
// Saves the director's answers to critique questions.
// Body: { answers: Record<string, string> }
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const body = await req.json();
  const { answers } = body as { answers: Record<string, string> };

  if (!answers || typeof answers !== "object") {
    return NextResponse.json({ error: "answers object is required" }, { status: 400 });
  }

  const session = await getSessionByProject(projectId);
  if (!session) {
    return NextResponse.json({ error: "No brainstorming session found" }, { status: 404 });
  }

  if (session.gddFinalized) {
    return NextResponse.json({ error: "GDD already finalized" }, { status: 409 });
  }

  // Merge with existing answers
  const mergedAnswers = { ...(session.gddAnswers ?? {}), ...answers };

  await updateSessionGdd(session.id, { gddAnswers: mergedAnswers });

  return NextResponse.json({ ok: true, answers: mergedAnswers });
}
