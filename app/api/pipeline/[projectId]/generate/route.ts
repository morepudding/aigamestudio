import { NextRequest, NextResponse } from "next/server";
import { getProjectById, updateProject } from "@/lib/services/projectService";
import { generateConceptPipeline, generateDevWaves } from "@/lib/services/producerService";
import { createRepo, ensureProjectDocs, initRepoStructure } from "@/lib/services/githubService";
import { getSessionByProject } from "@/lib/services/brainstormingService";

// POST /api/pipeline/[projectId]/generate
// Generates the pipeline for a project based on its current phase.
// - concept: creates the 5 sequential doc tasks (idempotent)
// - in-dev: reads the approved backlog and creates wave tasks (idempotent)
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;

  const project = await getProjectById(projectId);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  try {
    if (project.status === "concept") {
      // Gate: GDD must be finalized via brainstorming + review
      const session = await getSessionByProject(projectId);
      if (!session?.gddFinalized) {
        return NextResponse.json(
          { error: "Le GDD doit être finalisé via le brainstorming avant de générer les documents." },
          { status: 409 }
        );
      }

      // Create GitHub repo if it doesn't exist yet
      if (!project.githubRepoName) {
        const repoSlug = project.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");
        const repoName = `eden-${repoSlug}`;
        const { url, fullName } = await createRepo(repoName, project.description);
        // Save repo info immediately so retries don't try to recreate it
        await updateProject(projectId, {
          githubRepoUrl: url,
          githubRepoName: repoName,
        });
        await initRepoStructure(repoName, project.title);
        // Reload project so generateConceptPipeline sees the updated data
        const updated = await getProjectById(projectId);
        if (updated) {
          await ensureProjectDocs(repoName, project.title);
          const tasks = await generateConceptPipeline(updated);
          return NextResponse.json({ tasks, phase: "concept", repoUrl: url }, { status: 201 });
        }
      }

      await ensureProjectDocs(project.githubRepoName ?? "", project.title);

      const tasks = await generateConceptPipeline(project);
      return NextResponse.json({ tasks, phase: "concept" }, { status: 201 });
    }

    if (project.status === "in-dev") {
      // Gate: courseInfo must be complete before generating dev waves
      const ci = project.courseInfo;
      if (!ci || !ci.courseName || ci.mechanics.length === 0 || !ci.webEngine) {
        return NextResponse.json(
          {
            error:
              "Les informations du cours sont incomplètes. Renseigne le nom du cours, les mécaniques et l'engine web avant de générer les tâches.",
            missingFields: {
              courseName: !ci?.courseName,
              mechanics: !ci || ci.mechanics.length === 0,
              webEngine: !ci?.webEngine,
            },
          },
          { status: 409 }
        );
      }

      const tasks = await generateDevWaves(projectId, project);
      return NextResponse.json({ tasks, phase: "in-dev" }, { status: 201 });
    }

    return NextResponse.json(
      { error: `Pipeline generation is not available for projects in "${project.status}" phase` },
      { status: 400 }
    );
  } catch (err) {
    console.error("[pipeline/generate] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate pipeline" },
      { status: 500 }
    );
  }
}
