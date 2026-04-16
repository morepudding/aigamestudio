import { NextRequest, NextResponse } from "next/server";
import { getTaskById, updateTaskStatus } from "@/lib/services/pipelineService";

// POST /api/pipeline/task/[taskId]/retry
// Resets a failed task to "retrying" then triggers execution.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;

  const task = await getTaskById(taskId);
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  if (task.status !== "failed") {
    return NextResponse.json(
      { error: `Task cannot be retried in status "${task.status}". Must be "failed".` },
      { status: 400 }
    );
  }

  // Reset to retrying
  await updateTaskStatus(taskId, "retrying");

  // Trigger execution via internal fetch
  const baseUrl = req.nextUrl.origin;
  const execRes = await fetch(`${baseUrl}/api/pipeline/task/${taskId}/execute`, {
    method: "POST",
  });

  if (!execRes.ok) {
    const body = await execRes.json().catch(() => ({}));
    return NextResponse.json(
      { error: "Execution failed to start", details: body },
      { status: execRes.status }
    );
  }

  return NextResponse.json({ ok: true });
}
