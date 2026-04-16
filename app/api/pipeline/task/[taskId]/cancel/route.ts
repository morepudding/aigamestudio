import { NextRequest, NextResponse } from "next/server";
import { getTaskById, updateTaskStatus } from "@/lib/services/pipelineService";
import { cancelTask } from "@/lib/services/codingAgentService";

// POST /api/pipeline/task/[taskId]/cancel
// Cancels a running task: aborts the agent loop and resets status to "ready".
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;

  const task = await getTaskById(taskId);
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  if (task.status !== "in-progress" && task.status !== "retrying") {
    return NextResponse.json(
      { error: `Task cannot be cancelled in status "${task.status}". Must be "in-progress" or "retrying".` },
      { status: 400 }
    );
  }

  // Abort the running agent loop (if still in memory)
  const aborted = cancelTask(taskId);

  // Reset task to "ready" so it can be relaunched
  await updateTaskStatus(taskId, "ready", {
    startedAt: undefined,
  });

  return NextResponse.json({
    taskId,
    status: "ready",
    aborted,
  });
}
