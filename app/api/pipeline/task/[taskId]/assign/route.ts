import { NextRequest, NextResponse } from "next/server";
import { getTaskById } from "@/lib/services/pipelineService";
import { supabase } from "@/lib/supabase/client";

// PATCH /api/pipeline/task/[taskId]/assign
// Updates the assigned_agent_slug (and optionally status) of a task.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;

  const task = await getTaskById(taskId);
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const body = await req.json();
  const { agentSlug, status } = body as { agentSlug?: string | null; status?: string };

  const patch: Record<string, unknown> = {
    assigned_agent_slug: agentSlug ?? null,
  };
  if (status) patch.status = status;

  const { error } = await supabase
    .from("pipeline_tasks")
    .update(patch)
    .eq("id", taskId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ taskId, agentSlug: agentSlug ?? null });
}
