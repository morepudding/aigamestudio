import { createHash } from "node:crypto";
import { supabase } from "@/lib/supabase/client";
import { normalizeRepoPath } from "@/lib/utils";
import type { Agent } from "@/lib/services/agentService";
import type { Project } from "@/lib/types/project";
import type {
  BacklogPlanningPayload,
  BacklogPlanningResult,
  BacklogPlanningTask,
  BacklogPlanningWave,
  PipelinePlanningRun,
  PlanningRunStatus,
} from "@/lib/types/planning";
import type { DeliverableType } from "@/lib/types/task";

const VALID_DELIVERABLE_TYPES: DeliverableType[] = [
  "markdown",
  "code",
  "json",
  "config",
  "repo-init",
];

function extractJson(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();

  const bare = raw.match(/(\{[\s\S]*\})/);
  if (bare) return bare[1].trim();

  return raw.trim();
}

function inferDeliverableTypeFromPath(path: string): DeliverableType {
  const normalizedPath = normalizeRepoPath(path).toLowerCase();

  if (!normalizedPath) return "code";
  if (normalizedPath.endsWith(".md")) return "markdown";
  if (normalizedPath.endsWith(".json")) return "json";
  if (
    normalizedPath.endsWith(".yml") ||
    normalizedPath.endsWith(".yaml") ||
    normalizedPath.endsWith(".toml") ||
    normalizedPath.endsWith(".ini") ||
    normalizedPath.endsWith(".env") ||
    normalizedPath.includes("config")
  ) {
    return "config";
  }

  if (
    normalizedPath === ".gitignore" ||
    normalizedPath === "package.json" ||
    normalizedPath === "tsconfig.json" ||
    normalizedPath === "next.config.ts"
  ) {
    return "config";
  }

  return "code";
}

function normalizeDeliverableType(
  rawType: string | null | undefined,
  deliverablePath: string
): DeliverableType {
  const normalizedType = rawType?.trim().toLowerCase();
  if (normalizedType && VALID_DELIVERABLE_TYPES.includes(normalizedType as DeliverableType)) {
    return normalizedType as DeliverableType;
  }

  if (normalizedType && ["md", "document", "doc", "docs", "spec"].includes(normalizedType)) {
    return "markdown";
  }

  if (normalizedType && ["repo_init", "repoinit", "repo", "bootstrap"].includes(normalizedType)) {
    return "repo-init";
  }

  return inferDeliverableTypeFromPath(deliverablePath);
}

function toBooleanFlag(value: string | undefined): boolean {
  return ["1", "true", "yes", "on"].includes((value ?? "").trim().toLowerCase());
}

export function isCrewAIBacklogPlannerEnabled(): boolean {
  return toBooleanFlag(process.env.USE_CREWAI_BACKLOG_PLANNER);
}

function getCrewAIBacklogPlannerUrl(): string | null {
  const baseUrl = process.env.CREWAI_ORCHESTRATOR_URL?.trim().replace(/\/+$/, "");
  if (!baseUrl) return null;
  return `${baseUrl}/plan-backlog`;
}

function buildPayload(params: {
  project: Project;
  backlogMarkdown: string;
  documents: { gdd: string | null; techSpec: string | null; dataArch: string | null };
  agents: Agent[];
}): BacklogPlanningPayload {
  const { project, backlogMarkdown, documents, agents } = params;

  return {
    project: {
      id: project.id,
      title: project.title,
      description: project.description,
      genre: project.genre,
      engine: project.engine,
      platforms: project.platforms,
      courseInfo: project.courseInfo,
    },
    documents: {
      backlogMarkdown,
      gdd: documents.gdd,
      techSpec: documents.techSpec,
      dataArch: documents.dataArch,
    },
    agents: agents.map((agent) => ({
      slug: agent.slug,
      name: agent.name,
      department: agent.department,
      specialization: agent.specialization ?? null,
      status: agent.status,
    })),
    constraints: {
      maxTasksPerWave: 5,
      preferSmallSlices: true,
      mustProduceRepoPaths: true,
    },
  };
}

function normalizeTask(rawTask: unknown): BacklogPlanningTask {
  if (!rawTask || typeof rawTask !== "object") {
    throw new Error("Invalid planning task: expected object");
  }

  const task = rawTask as Record<string, unknown>;
  const title = String(task.title ?? "").trim();
  const description = String(task.description ?? "").trim();
  const backlogRef = String(task.backlog_ref ?? "").trim();
  const agentDepartment = String(task.agent_department ?? "").trim();
  const deliverablePath = normalizeRepoPath(String(task.deliverable_path ?? "").trim());

  if (!title || !description || !backlogRef || !agentDepartment || !deliverablePath) {
    throw new Error("Invalid planning task: missing required fields");
  }

  const contextFiles = Array.isArray(task.context_files)
    ? Array.from(
        new Set(
          task.context_files
            .map((filePath) => normalizeRepoPath(String(filePath ?? "").trim()))
            .filter(Boolean)
        )
      )
    : [];

  const dependsOnRefs = Array.isArray(task.depends_on_refs)
    ? Array.from(
        new Set(task.depends_on_refs.map((reference) => String(reference ?? "").trim()).filter(Boolean))
      )
    : [];

  return {
    title,
    description,
    backlog_ref: backlogRef,
    agent_department: agentDepartment,
    specialization:
      task.specialization == null ? null : String(task.specialization).trim() || null,
    deliverable_type: normalizeDeliverableType(
      task.deliverable_type == null ? undefined : String(task.deliverable_type),
      deliverablePath
    ),
    deliverable_path: deliverablePath,
    context_files: contextFiles,
    depends_on_refs: dependsOnRefs,
    planning_notes:
      task.planning_notes == null ? null : String(task.planning_notes).trim() || null,
  };
}

function normalizeWave(rawWave: unknown, fallbackNumber: number): BacklogPlanningWave {
  if (!rawWave || typeof rawWave !== "object") {
    throw new Error("Invalid planning wave: expected object");
  }

  const wave = rawWave as Record<string, unknown>;
  const rawNumber = Number(wave.number);
  const waveNumber = Number.isFinite(rawNumber) && rawNumber > 0 ? rawNumber : fallbackNumber;
  const goal = String(wave.goal ?? `Wave ${waveNumber}`).trim() || `Wave ${waveNumber}`;
  const tasks = Array.isArray(wave.tasks)
    ? wave.tasks.map((task) => normalizeTask(task))
    : [];

  if (tasks.length === 0) {
    throw new Error(`Invalid planning wave ${waveNumber}: missing tasks`);
  }

  return {
    number: waveNumber,
    goal,
    tasks,
  };
}

function normalizeResult(raw: unknown): BacklogPlanningResult {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid planning result: expected object");
  }

  const payload = raw as Record<string, unknown>;
  const waves = Array.isArray(payload.waves)
    ? payload.waves.map((wave, index) => normalizeWave(wave, index + 1))
    : [];

  if (waves.length === 0) {
    throw new Error("Invalid planning result: missing waves array");
  }

  return {
    planningSummary: String(payload.planningSummary ?? payload.planning_summary ?? "").trim(),
    warnings: Array.isArray(payload.warnings)
      ? payload.warnings.map((warning) => String(warning ?? "").trim()).filter(Boolean)
      : [],
    waves,
    provider: "crewai",
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToPlanningRun(row: any): PipelinePlanningRun {
  return {
    id: row.id,
    projectId: row.project_id,
    provider: row.provider,
    status: row.status as PlanningRunStatus,
    inputHash: row.input_hash,
    rawOutput: row.raw_output ?? null,
    normalizedOutput: (row.normalized_output as BacklogPlanningResult | null) ?? null,
    warnings: Array.isArray(row.warnings_json) ? row.warnings_json : [],
    durationMs: row.duration_ms ?? null,
    tokenUsage: row.token_usage ?? null,
    fallbackUsed: Boolean(row.fallback_used),
    errorMessage: row.error_message ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createPlanningRun(params: {
  projectId: string;
  provider: string;
  status: PlanningRunStatus;
  inputHash: string;
  rawOutput?: string | null;
  normalizedOutput?: BacklogPlanningResult | null;
  warnings?: string[];
  durationMs?: number | null;
  tokenUsage?: number | null;
  fallbackUsed?: boolean;
  errorMessage?: string | null;
}): Promise<PipelinePlanningRun | null> {
  const { data, error } = await supabase
    .from("pipeline_planning_runs")
    .insert({
      project_id: params.projectId,
      provider: params.provider,
      status: params.status,
      input_hash: params.inputHash,
      raw_output: params.rawOutput ?? null,
      normalized_output: params.normalizedOutput ?? null,
      warnings_json: params.warnings ?? [],
      duration_ms: params.durationMs ?? null,
      token_usage: params.tokenUsage ?? null,
      fallback_used: params.fallbackUsed ?? false,
      error_message: params.errorMessage ?? null,
    })
    .select()
    .single();

  if (error || !data) {
    console.warn("[backlogPlanningService] Failed to persist planning run:", error?.message);
    return null;
  }

  return rowToPlanningRun(data);
}

export async function getLatestPlanningRun(projectId: string): Promise<PipelinePlanningRun | null> {
  const { data, error } = await supabase
    .from("pipeline_planning_runs")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;
  return rowToPlanningRun(data);
}

export async function planBacklogWithCrewAI(params: {
  project: Project;
  backlogMarkdown: string;
  documents: { gdd: string | null; techSpec: string | null; dataArch: string | null };
  agents: Agent[];
}): Promise<BacklogPlanningResult | null> {
  const plannerUrl = getCrewAIBacklogPlannerUrl();
  if (!plannerUrl) {
    console.warn("[backlogPlanningService] CREWAI_ORCHESTRATOR_URL is not configured. Falling back.");
    return null;
  }

  const payload = buildPayload(params);
  const inputHash = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
  const startedAt = Date.now();

  try {
    const response = await fetch(plannerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const rawOutput = await response.text();
    if (!response.ok) {
      throw new Error(`CrewAI planner error ${response.status}: ${rawOutput}`);
    }

    const parsed = JSON.parse(extractJson(rawOutput));
    const normalized = normalizeResult(parsed);

    await createPlanningRun({
      projectId: params.project.id,
      provider: "crewai",
      status: "success",
      inputHash,
      rawOutput,
      normalizedOutput: normalized,
      warnings: normalized.warnings,
      durationMs: Date.now() - startedAt,
      tokenUsage:
        typeof parsed.token_usage === "number"
          ? parsed.token_usage
          : typeof parsed.tokens_used === "number"
          ? parsed.tokens_used
          : null,
      fallbackUsed: false,
    });

    return normalized;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    await createPlanningRun({
      projectId: params.project.id,
      provider: "crewai",
      status: "failed",
      inputHash,
      durationMs: Date.now() - startedAt,
      fallbackUsed: true,
      errorMessage,
    });

    console.warn("[backlogPlanningService] CrewAI planning failed, falling back:", errorMessage);
    return null;
  }
}