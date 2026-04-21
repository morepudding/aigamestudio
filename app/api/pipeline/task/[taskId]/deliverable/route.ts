import { NextRequest, NextResponse } from "next/server";
import { getTaskById, clearTaskDeliverable } from "@/lib/services/pipelineService";

// DELETE /api/pipeline/task/[taskId]/deliverable
// Clears the generated deliverable and resets the task to "ready" for re-execution.
// Only allowed when the task is in "review" status.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;

  const task = await getTaskById(taskId);
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  if (task.status !== "review") {
    return NextResponse.json(
      { error: `Cannot delete deliverable for task in status "${task.status}". Must be "review".` },
      { status: 400 }
    );
  }

  try {
    await clearTaskDeliverable(taskId);
    return NextResponse.json({ taskId, status: "ready" });
  } catch (err) {
    console.error("[pipeline/task/deliverable] Error:", err);
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Failed to delete deliverable: ${errorMessage}` }, { status: 500 });
  }
}
