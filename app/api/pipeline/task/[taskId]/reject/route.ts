import { NextRequest, NextResponse } from "next/server";
import { getTaskById, rejectTask } from "@/lib/services/pipelineService";

// POST /api/pipeline/task/[taskId]/reject
// Rejects a task in "review" status → retrying, with optional feedback appended to the prompt.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;

  const task = await getTaskById(taskId);
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  if (task.status !== "review") {
    return NextResponse.json(
      { error: `Task cannot be rejected in status "${task.status}". Must be "review".` },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const feedback: string = typeof body.feedback === "string" ? body.feedback.trim() : "";

  try {
    await rejectTask(taskId, feedback);
    return NextResponse.json({ taskId, status: "retrying", feedback: feedback || null });
  } catch (err) {
    console.error("[pipeline/task/reject] Error:", err);
    return NextResponse.json({ error: "Failed to reject task" }, { status: 500 });
  }
}
