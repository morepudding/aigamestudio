import { NextRequest, NextResponse } from "next/server";
import { getTasksByProject } from "@/lib/services/pipelineService";
import { getAllAgents } from "@/lib/services/agentService";
import { pickAgent } from "@/lib/services/producerService";
import { inferTaskAssignment } from "@/lib/services/taskAssignmentService";
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
    (t) => !t.assignedAgentSlug && t.status !== "completed"
  );

  if (unassigned.length === 0) {
    return NextResponse.json({ assigned: 0, skipped: 0, total: 0 });
  }

  const updates = unassigned
    .map((task) => {
      const assignment = inferTaskAssignment(
        task.title,
        task.description,
        task.agentDepartment ?? undefined
      );
      const agent = pickAgent(
        assignment.agentDepartment,
        agents,
        task.title,
        task.description,
        assignment.specialization
      );
      if (!agent) return null;
      return { id: task.id, slug: agent.slug };
    })
    .filter((u): u is { id: string; slug: string } => u !== null);

  const results = await Promise.all(
    updates.map(async ({ id, slug }) => {
      const { error } = await supabase
        .from("pipeline_tasks")
        .update({ assigned_agent_slug: slug })
        .eq("id", id);

      if (error) {
        return { id, error: error.message };
      }

      return { id, error: null };
    })
  );

  const failed = results.filter((result) => result.error);
  if (failed.length > 0) {
    return NextResponse.json(
      {
        error: "Impossible d'assigner certaines tâches",
        details: failed,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    assigned: updates.length,
    skipped: unassigned.length - updates.length,
    total: unassigned.length,
  });
}
