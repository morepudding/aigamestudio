export type TaskStatus =
  | "created"
  | "ready"
  | "in-progress"
  | "review"
  | "completed"
  | "failed"
  | "retrying";

export type DeliverableType = "markdown" | "code" | "json" | "config" | "repo-init";

// ProjectPhase is identical to ProjectStatus — re-exported as an alias so both names work.
import type { ProjectStatus } from "@/lib/types/project";
export type ProjectPhase = ProjectStatus;

export interface PipelineTask {
  id: string;
  projectId: string;
  title: string;
  description: string;
  backlogRef: string | null;
  projectPhase: ProjectPhase;
  waveNumber: number;
  sortOrder: number;
  status: TaskStatus;
  requiresReview: boolean;
  assignedAgentSlug: string | null;
  agentDepartment: string | null;
  llmModel: string;
  llmPromptTemplate: string | null;
  llmContextFiles: string[];
  deliverableType: DeliverableType;
  deliverablePath: string | null;
  deliverableContent: string | null;
  dependsOn: string[];
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskExecution {
  id: string;
  taskId: string;
  attemptNumber: number;
  status: "running" | "success" | "error";
  llmInput: string | null;
  llmOutput: string | null;
  errorMessage: string | null;
  tokensUsed: number | null;
  durationMs: number | null;
  createdAt: string;
}

export interface Wave {
  number: number;
  tasks: PipelineTask[];
  allCompleted: boolean;
}

export interface Pipeline {
  projectId: string;
  phase: ProjectPhase;
  waves: Wave[];
  progress: {
    total: number;
    completed: number;
    inProgress: number;
    failed: number;
    percentage: number;
  };
}
