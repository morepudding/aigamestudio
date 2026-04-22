import type { Agent } from "@/lib/services/agentService";
import type { Project } from "@/lib/types/project";
import type { DeliverableType } from "@/lib/types/task";

export interface BacklogPlanningDocuments {
  backlogMarkdown: string;
  gdd: string | null;
  techSpec: string | null;
  dataArch: string | null;
}

export interface BacklogPlanningContext {
  studioIdentity: string;
  productDirective: string;
  technicalDirective: string;
}

export interface BacklogPlanningPayload {
  project: Pick<
    Project,
    "id" | "title" | "description" | "genre" | "engine" | "platforms" | "courseInfo"
  >;
  documents: BacklogPlanningDocuments;
  agents: Array<
    Pick<Agent, "slug" | "name" | "department" | "specialization" | "status">
  >;
  context: BacklogPlanningContext;
  constraints: {
    maxTasksPerWave: number;
    preferSmallSlices: boolean;
    mustProduceRepoPaths: boolean;
  };
}

export interface BacklogPlanningTask {
  title: string;
  description: string;
  backlog_ref: string;
  agent_department: string;
  specialization: string | null;
  deliverable_type: DeliverableType;
  deliverable_path: string;
  context_files: string[];
  depends_on_refs: string[];
  planning_notes: string | null;
}

export interface BacklogPlanningWave {
  number: number;
  goal: string;
  tasks: BacklogPlanningTask[];
}

export interface BacklogPlanningResult {
  planningSummary: string;
  warnings: string[];
  waves: BacklogPlanningWave[];
  provider: "crewai";
}

export type PlanningRunStatus = "success" | "failed";

export interface PipelinePlanningRun {
  id: string;
  projectId: string;
  provider: string;
  status: PlanningRunStatus;
  inputHash: string;
  rawOutput: string | null;
  normalizedOutput: BacklogPlanningResult | null;
  warnings: string[];
  durationMs: number | null;
  tokenUsage: number | null;
  fallbackUsed: boolean;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}