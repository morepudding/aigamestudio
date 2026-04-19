import { NextRequest, NextResponse } from "next/server";
import { getTaskById, updateTaskStatus, createExecution, advancePipeline, getTaskExecutions } from "@/lib/services/pipelineService";
import { executeConceptTask, enrichNextTaskPrompt } from "@/lib/services/producerService";
import { executeCodeTask } from "@/lib/services/codingAgentService";
import { getFileContent } from "@/lib/services/githubService";
import { getProjectById } from "@/lib/services/projectService";
import { pushFile } from "@/lib/services/githubService";
import { normalizeMarkdownDeliverable, unwrapCodeFence } from "@/lib/utils";
import { getSessionByProject } from "@/lib/services/brainstormingService";
import { reviewWave, isWaveFullyCompleted } from "@/lib/services/waveReviewerService";
import { getTasksByProject } from "@/lib/services/pipelineService";
import { getActiveSkillPrompt } from "@/lib/services/agentSkillPromptService";

// POST /api/pipeline/task/[taskId]/execute
// Executes a task: calls DeepSeek, saves content to DB.
// Concept tasks: may go to "review" (requiresReview) or "completed" (auto).
// In-dev tasks: always auto-complete, push code to GitHub, then advance pipeline.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;

  const task = await getTaskById(taskId);
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  if (task.status !== "ready" && task.status !== "retrying") {
    return NextResponse.json(
      { error: `Task cannot be executed in status "${task.status}". Must be "ready" or "retrying".` },
      { status: 400 }
    );
  }

  if (task.projectPhase === "concept") {
    const session = await getSessionByProject(task.projectId);
    if (!session?.gddFinalized) {
      return NextResponse.json(
        { error: "Le GDD doit être finalisé via le brainstorming avant de générer les documents." },
        { status: 409 }
      );
    }
  }

  // Mark as in-progress
  await updateTaskStatus(taskId, "in-progress", {
    startedAt: new Date().toISOString(),
  });

  // Determine attempt number from existing executions
  const previousExecutions = await getTaskExecutions(taskId);
  const attemptNumber = previousExecutions.length + 1;

  const startedAt = Date.now();
  let llmOutput: string | null = null;
  let tokensUsed: number | null = null;

  try {
    const project = await getProjectById(task.projectId);
    if (!project) throw new Error("Project not found");

    // Dispatch to the correct executor based on phase
    let result: { content: string; tokensUsed: number | null };
    if (task.projectPhase === "in-dev") {
      // Load concept docs from GitHub for full context
      const repoName = project.githubRepoName ?? "";
      const [gdd, techSpec, dataArch, activeSkillPrompt] = await Promise.all([
        repoName ? getFileContent(repoName, "docs/gdd.md") : null,
        repoName ? getFileContent(repoName, "docs/tech-spec.md") : null,
        repoName ? getFileContent(repoName, "docs/data-arch.md") : null,
        task.assignedAgentSlug ? getActiveSkillPrompt(task.assignedAgentSlug) : null,
      ]);

      const codingResult = await executeCodeTask(
        task,
        project,
        { gdd, techSpec, dataArch },
        [],
        activeSkillPrompt?.content ?? null
      );

      // Produced a structured result — map to the common shape
      result = {
        content: codingResult.summary,
        tokensUsed: codingResult.tokensUsed,
      };
    } else {
      result = await executeConceptTask(task);
    }

    const isMarkdownDeliverable =
      task.deliverableType === "markdown" || task.deliverablePath?.endsWith(".md");

    llmOutput = isMarkdownDeliverable
      ? normalizeMarkdownDeliverable(result.content)
      : unwrapCodeFence(result.content);
    tokensUsed = result.tokensUsed;
    const durationMs = Date.now() - startedAt;

    // Save execution log
    await createExecution({
      taskId,
      attemptNumber,
      status: "success",
      llmInput: task.llmPromptTemplate,
      llmOutput,
      errorMessage: null,
      tokensUsed,
      durationMs,
    });

    // Determine next status
    const nextStatus = task.requiresReview ? "review" : "completed";

    await updateTaskStatus(taskId, nextStatus, {
      deliverableContent: llmOutput,
      completedAt: nextStatus === "completed" ? new Date().toISOString() : undefined,
    });

    // Push to GitHub if completed and has a deliverable path
    if (nextStatus === "completed" && task.deliverablePath && project.githubRepoName) {
      const commitMessage = `[eden] ${task.assignedAgentSlug ?? "agent"}: ${task.title}`;
      await pushFile(project.githubRepoName, task.deliverablePath, llmOutput, commitMessage);
    }

    // Post-completion: advance pipeline and enrich next task
    let waveReview = null;
    if (nextStatus === "completed") {
      if (task.projectPhase === "concept") {
        await enrichNextTaskPrompt(task.projectId, project);
      } else if (task.projectPhase === "in-dev") {
        // Check if the entire wave is now done — if so, run the reviewer before unlocking next wave
        const allTasks = await getTasksByProject(task.projectId, "in-dev");
        if (isWaveFullyCompleted(allTasks, task.waveNumber)) {
          waveReview = await reviewWave(project, task.waveNumber);
        }
        // Unlock dependent tasks regardless of review result — review is informational for now
        await advancePipeline(task.projectId);
      }
    }

    return NextResponse.json({
      taskId,
      status: nextStatus,
      deliverablePath: task.deliverablePath,
      tokensUsed,
      durationMs,
      waveReview,
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const durationMs = Date.now() - startedAt;

    await createExecution({
      taskId,
      attemptNumber,
      status: "error",
      llmInput: task.llmPromptTemplate,
      llmOutput,
      errorMessage,
      tokensUsed,
      durationMs,
    });

    await updateTaskStatus(taskId, "failed");

    console.error("[pipeline/task/execute] Error:", errorMessage);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
