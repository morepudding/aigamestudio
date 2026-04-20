import { NextRequest, NextResponse } from "next/server";
import { getTasksByProject } from "@/lib/services/pipelineService";
import { getAllAgents } from "@/lib/services/agentService";
import { pickAgent } from "@/lib/services/producerService";
import { supabase } from "@/lib/supabase/client";

// POST /api/pipeline/[projectId]/auto-assign
// Assigns unassigned tasks using pickAgent (department + specialization + seniority).
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;

  const [tasks, agents] = await Promise.all([
    getTasksByProject(projectId),
    getAllAgents(),
  ]);

  const unassigned = tasks.filter(
    (t) => !t.assignedAgentSlug && t.status !== "completed" && t.agentDepartment
  );

  if (unassigned.length === 0) {
    return NextResponse.json({ assigned: 0 });
  }

  const updates = unassigned
    .map((task) => {
      const agent = pickAgent(task.agentDepartment!, agents, task.title);
      if (!agent) return null;
      return { id: task.id, slug: agent.slug };
    })
    .filter((u): u is { id: string; slug: string } => u !== null);

  await Promise.all(
    updates.map(({ id, slug }) =>
      supabase
        .from("pipeline_tasks")
        .update({ assigned_agent_slug: slug })
        .eq("id", id)
    )
  );

  return NextResponse.json({ assigned: updates.length });
}
