import { NextRequest, NextResponse } from "next/server";
import { getProjectById } from "@/lib/services/projectService";
import { generateNextDevWave, regenerateProjectDocsFromRepo } from "@/lib/services/producerService";

// POST /api/pipeline/[projectId]/catch-up
// Regenerates placeholder project docs from the live GitHub repo when needed,
// then creates the next in-dev wave once all current tasks are completed.
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
    const docs = await regenerateProjectDocsFromRepo(projectId, project);
    const tasks = await generateNextDevWave(projectId, project);

    return NextResponse.json(
      {
        phase: "in-dev",
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
      { error: err instanceof Error ? err.message : "Failed to run catch-up pipeline" },
      { status: 500 }
    );
  }
}
