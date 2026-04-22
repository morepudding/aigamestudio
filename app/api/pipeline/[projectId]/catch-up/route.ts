import { NextRequest, NextResponse } from "next/server";
import { getProjectById } from "@/lib/services/projectService";
import { getTasksByProject, deleteTasksByProjectPhase } from "@/lib/services/pipelineService";
import { generateDevWaves, regenerateProjectDocsFromRepo } from "@/lib/services/producerService";

// POST /api/pipeline/[projectId]/catch-up
// Refreshes project docs from the live GitHub repo, clears current dev waves,
// then rebuilds the dev backlog from scratch so planning can be re-run.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;

  const project = await getProjectById(projectId);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  if (project.status !== "in-dev") {
    return NextResponse.json(
      { error: "Catch-up n'est disponible que pour les projets en développement." },
      { status: 400 }
    );
  }

  try {
    const existingTasks = await getTasksByProject(projectId, "in-dev");
    const hasRunningTasks = existingTasks.some(
      (task) => task.status === "in-progress" || task.status === "retrying"
    );

    if (hasRunningTasks) {
      return NextResponse.json(
        {
          error:
            "Impossible de relancer le backlog pendant qu'une tâche de développement est en cours.",
        },
        { status: 409 }
      );
    }

    const docs = await regenerateProjectDocsFromRepo(projectId, project);
    await deleteTasksByProjectPhase(projectId, "in-dev");
    const tasks = await generateDevWaves(projectId, project);

    return NextResponse.json(
      {
        phase: "in-dev",
        replanned: true,
        docsUpdated: true,
        nextWaveNumber: tasks[0]?.waveNumber ?? null,
        tasksCreated: tasks.length,
        tasks,
        docs,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[pipeline/catch-up] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to replan dev backlog" },
      { status: 500 }
    );
  }
}
