import { NextRequest, NextResponse } from "next/server";
import { getTaskById, approveTask, getTasksByProject } from "@/lib/services/pipelineService";
import { enrichNextTaskPrompt, generateDevWaves } from "@/lib/services/producerService";
import { getProjectById, transitionToInDev } from "@/lib/services/projectService";
import { pushFile } from "@/lib/services/githubService";

// POST /api/pipeline/task/[taskId]/approve
// Validates a task in "review" status → completed, then unlocks the next task.
// If this was the last concept task (Backlog), transitions the project to in-dev
// and generates the dev waves automatically.
export async function POST(
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
      { error: `Task cannot be approved in status "${task.status}". Must be "review".` },
      { status: 400 }
    );
  }

  try {
    await approveTask(taskId);

    const project = await getProjectById(task.projectId);

    // Push deliverable to GitHub if the task required review (execute skips this for review tasks)
    if (task.deliverablePath && task.deliverableContent && project?.githubRepoName) {
      const commitMessage = `[eden] ${task.assignedAgentSlug ?? "agent"}: ${task.title}`;
      await pushFile(project.githubRepoName, task.deliverablePath, task.deliverableContent, commitMessage);
    }
    if (!project) {
      return NextResponse.json({ taskId, status: "completed" });
    }

    if (task.projectPhase === "concept") {
      // Enrich next concept task with completed docs context
      await enrichNextTaskPrompt(task.projectId, project);

      // Check if all concept tasks are now completed → transition to in-dev
      const allConceptTasks = await getTasksByProject(task.projectId, "concept");
      const allDone = allConceptTasks.every((t) => t.status === "completed");

      if (allDone && project.status === "concept") {
        const updatedProject = await transitionToInDev(task.projectId);
        if (updatedProject) {
          // Generate dev waves from the approved backlog
          const devTasks = await generateDevWaves(task.projectId, updatedProject);
          return NextResponse.json({
            taskId,
            status: "completed",
            transition: "in-dev",
            devTasksCreated: devTasks.length,
          });
        }
      }
    }

    return NextResponse.json({ taskId, status: "completed" });
  } catch (err) {
    console.error("[pipeline/task/approve] Error:", err);
    return NextResponse.json({ error: "Failed to approve task" }, { status: 500 });
  }
}
