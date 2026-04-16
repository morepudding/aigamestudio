import { NextRequest, NextResponse } from "next/server";
import { advancePipeline } from "@/lib/services/pipelineService";

// POST /api/pipeline/[projectId]/advance
// Re-evaluates all tasks and promotes "created" tasks whose dependencies
// are all completed to "ready". Safe to call multiple times (idempotent).
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;

  try {
    await advancePipeline(projectId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
