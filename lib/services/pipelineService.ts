import { supabase } from "@/lib/supabase/client";
import type {
  PipelineTask,
  TaskExecution,
  Wave,
  Pipeline,
  ProjectPhase,
  TaskStatus,
} from "@/lib/types/task";
import { getWaveReview } from "@/lib/services/waveReviewService";

// ============================================================
// DB row → TypeScript type helpers
// ============================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToTask(row: any): PipelineTask {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    description: row.description,
    backlogRef: row.backlog_ref ?? null,
    projectPhase: row.project_phase,
    waveNumber: row.wave_number,
    sortOrder: row.sort_order,
    status: row.status,
    requiresReview: row.requires_review,
    assignedAgentSlug: row.assigned_agent_slug ?? null,
    agentDepartment: row.agent_department ?? null,
    llmModel: row.llm_model,
    llmPromptTemplate: row.llm_prompt_template ?? null,
    llmContextFiles: row.llm_context_files ?? [],
    deliverableType: row.deliverable_type,
    deliverablePath: row.deliverable_path ?? null,
    deliverableContent: row.deliverable_content ?? null,
    dependsOn: row.depends_on ?? [],
    startedAt: row.started_at ?? null,
    completedAt: row.completed_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToExecution(row: any): TaskExecution {
  return {
    id: row.id,
    taskId: row.task_id,
    attemptNumber: row.attempt_number,
    status: row.status,
    llmInput: row.llm_input ?? null,
    llmOutput: row.llm_output ?? null,
    errorMessage: row.error_message ?? null,
    tokensUsed: row.tokens_used ?? null,
    durationMs: row.duration_ms ?? null,
    createdAt: row.created_at,
  };
}

// ============================================================
// Queries
// ============================================================

export async function getTaskById(taskId: string): Promise<PipelineTask | null> {
  const { data, error } = await supabase
    .from("pipeline_tasks")
    .select("*")
    .eq("id", taskId)
    .single();

  if (error || !data) return null;
  return rowToTask(data);
}

export async function getTasksByProject(
  projectId: string,
  phase?: ProjectPhase
): Promise<PipelineTask[]> {
  let query = supabase
    .from("pipeline_tasks")
    .select("*")
    .eq("project_id", projectId)
    .order("wave_number", { ascending: true })
    .order("sort_order", { ascending: true });

  if (phase) {
    query = query.eq("project_phase", phase);
  }

  const { data, error } = await query;
  if (error || !data) return [];
  return data.map(rowToTask);
}

export async function getReadyTasks(projectId: string): Promise<PipelineTask[]> {
  const { data, error } = await supabase
    .from("pipeline_tasks")
    .select("*")
    .eq("project_id", projectId)
    .eq("status", "ready")
    .order("wave_number", { ascending: true })
    .order("sort_order", { ascending: true });

  if (error || !data) return [];
  return data.map(rowToTask);
}

export async function getTasksInReview(projectId: string): Promise<PipelineTask[]> {
  const { data, error } = await supabase
    .from("pipeline_tasks")
    .select("*")
    .eq("project_id", projectId)
    .eq("status", "review")
    .order("sort_order", { ascending: true });

  if (error || !data) return [];
  return data.map(rowToTask);
}

export async function getTaskExecutions(taskId: string): Promise<TaskExecution[]> {
  const { data, error } = await supabase
    .from("task_executions")
    .select("*")
    .eq("task_id", taskId)
    .order("attempt_number", { ascending: true });

  if (error || !data) return [];
  return data.map(rowToExecution);
}

// ============================================================
// CRUD
// ============================================================

export async function createTask(
  task: Omit<PipelineTask, "id" | "createdAt" | "updatedAt" | "startedAt" | "completedAt">
): Promise<PipelineTask> {
  const { data, error } = await supabase
    .from("pipeline_tasks")
    .insert({
      project_id: task.projectId,
      title: task.title,
      description: task.description,
      backlog_ref: task.backlogRef,
      project_phase: task.projectPhase,
      wave_number: task.waveNumber,
      sort_order: task.sortOrder,
      status: task.status,
      requires_review: task.requiresReview,
      assigned_agent_slug: task.assignedAgentSlug,
      agent_department: task.agentDepartment,
      llm_model: task.llmModel,
      llm_prompt_template: task.llmPromptTemplate,
      llm_context_files: task.llmContextFiles,
      deliverable_type: task.deliverableType,
      deliverable_path: task.deliverablePath,
      deliverable_content: task.deliverableContent,
      depends_on: task.dependsOn,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Failed to create task: ${error?.message}`);
  }
  return rowToTask(data);
}

export async function updateTaskStatus(
  taskId: string,
  status: TaskStatus,
  extras?: { deliverableContent?: string; startedAt?: string; completedAt?: string }
): Promise<void> {
  const patch: Record<string, unknown> = { status };
  if (extras?.deliverableContent !== undefined) {
    patch.deliverable_content = extras.deliverableContent;
  }
  if (extras?.startedAt !== undefined) patch.started_at = extras.startedAt;
  if (extras?.completedAt !== undefined) patch.completed_at = extras.completedAt;

  const { error } = await supabase
    .from("pipeline_tasks")
    .update(patch)
    .eq("id", taskId);

  if (error) {
    throw new Error(`Failed to update task status: ${error.message}`);
  }
}

export async function updateTaskPrompt(
  taskId: string,
  llmPromptTemplate: string
): Promise<void> {
  const { error } = await supabase
    .from("pipeline_tasks")
    .update({ llm_prompt_template: llmPromptTemplate })
    .eq("id", taskId);

  if (error) {
    throw new Error(`Failed to update task prompt: ${error.message}`);
  }
}

export async function updateTaskDeliverableContent(
  taskId: string,
  deliverableContent: string
): Promise<void> {
  const { error } = await supabase
    .from("pipeline_tasks")
    .update({ deliverable_content: deliverableContent })
    .eq("id", taskId);

  if (error) {
    throw new Error(`Failed to update task deliverable: ${error.message}`);
  }
}

/**
 * Clear the deliverable content of a task and reset it to "ready" so it can
 * be re-executed. Only allowed when the task is in "review" status.
 */
export async function clearTaskDeliverable(taskId: string): Promise<void> {
  const { error } = await supabase
    .from("pipeline_tasks")
    .update({
      deliverable_content: null,
      deliverable_path: null,
      status: "ready",
      started_at: null,
      completed_at: null,
    })
    .eq("id", taskId);

  if (error) {
    throw new Error(`Failed to clear deliverable: ${error.message}`);
  }
}

export async function deleteTask(taskId: string): Promise<void> {
  const { error } = await supabase
    .from("pipeline_tasks")
    .delete()
    .eq("id", taskId);

  if (error) {
    throw new Error(`Failed to delete task: ${error.message}`);
  }
}

export async function createExecution(
  execution: Omit<TaskExecution, "id" | "createdAt">
): Promise<TaskExecution> {
  const { data, error } = await supabase
    .from("task_executions")
    .insert({
      task_id: execution.taskId,
      attempt_number: execution.attemptNumber,
      status: execution.status,
      llm_input: execution.llmInput,
      llm_output: execution.llmOutput,
      error_message: execution.errorMessage,
      tokens_used: execution.tokensUsed,
      duration_ms: execution.durationMs,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Failed to create execution log: ${error?.message}`);
  }
  return rowToExecution(data);
}

// ============================================================
// Wave computation
// ============================================================

/**
 * Group tasks by wave number and return Wave objects.
 */
export async function getTasksByWave(
  projectId: string,
  phase: ProjectPhase
): Promise<Wave[]> {
  const tasks = await getTasksByProject(projectId, phase);

  const waveMap = new Map<number, PipelineTask[]>();
  for (const task of tasks) {
    const existing = waveMap.get(task.waveNumber) ?? [];
    existing.push(task);
    waveMap.set(task.waveNumber, existing);
  }

  const waves: Wave[] = [];
  const sortedNumbers = Array.from(waveMap.keys()).sort((a, b) => a - b);
  for (const num of sortedNumbers) {
    const waveTasks = waveMap.get(num)!;
    waves.push({
      number: num,
      tasks: waveTasks,
      allCompleted: waveTasks.every((t) => t.status === "completed"),
    });
  }

  return waves;
}

/**
 * Compute pipeline progress for a project's current phase.
 */
export async function getPipelineProgress(
  projectId: string,
  phase?: ProjectPhase
): Promise<Pipeline["progress"]> {
  const tasks = await getTasksByProject(projectId, phase);

  const total = tasks.length;
  const completed = tasks.filter((t) => t.status === "completed").length;
  const inProgress = tasks.filter((t) => t.status === "in-progress").length;
  const failed = tasks.filter((t) => t.status === "failed").length;
  const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);

  return { total, completed, inProgress, failed, percentage };
}

// ============================================================
// Auto-progression engine
// ============================================================

/**
 * After a task completes, check which tasks now have all dependencies
 * satisfied and transition them from "created" → "ready".
 */
export async function advancePipeline(projectId: string): Promise<void> {
  const tasks = await getTasksByProject(projectId);
  const completedIds = new Set(
    tasks.filter((t) => t.status === "completed").map((t) => t.id)
  );

  // Collect wave numbers that require an approved review before unlocking
  const waveNumbers = [...new Set(tasks.map((t) => t.waveNumber))].sort((a, b) => a - b);
  const blockedWaves = new Set<number>();
  for (const wave of waveNumbers) {
    if (wave <= 1) continue;
    const prevReview = await getWaveReview(projectId, wave - 1);
    if (!prevReview || prevReview.status !== "approved") {
      blockedWaves.add(wave);
    }
  }

  const toUnlock = tasks.filter(
    (t) =>
      t.status === "created" &&
      !blockedWaves.has(t.waveNumber) &&
      t.dependsOn.length > 0 &&
      t.dependsOn.every((depId) => completedIds.has(depId))
  );

  const noDepCreated = tasks.filter(
    (t) =>
      t.status === "created" &&
      !blockedWaves.has(t.waveNumber) &&
      t.dependsOn.length === 0
  );

  const allToReady = [...toUnlock, ...noDepCreated];

  await Promise.all(allToReady.map((t) => updateTaskStatus(t.id, "ready")));
}

// ============================================================
// Validation (review flow)
// ============================================================

/**
 * Mark a task as completed (review → completed).
 * Triggers pipeline advancement.
 */
export async function approveTask(taskId: string): Promise<void> {
  await updateTaskStatus(taskId, "completed", {
    completedAt: new Date().toISOString(),
  });

  const task = await getTaskById(taskId);
  if (task) {
    await advancePipeline(task.projectId);
  }
}

/**
 * Reject a task (review → retrying) and update its prompt with feedback.
 */
export async function rejectTask(taskId: string, feedback: string): Promise<void> {
  const task = await getTaskById(taskId);
  if (!task) return;

  const updatedPrompt = task.llmPromptTemplate
    ? `${task.llmPromptTemplate}\n\n---\n**Feedback de révision :**\n${feedback}`
    : feedback;

  await Promise.all([
    updateTaskStatus(taskId, "retrying"),
    updateTaskPrompt(taskId, updatedPrompt),
  ]);
}
