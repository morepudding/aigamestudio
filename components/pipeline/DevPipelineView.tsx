"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Loader2,
  RefreshCw,
  UserPlus,
  Layers,
  X,
  Zap,
  AlertCircle,
  Play,
  FileText,
  ChevronDown,
  ChevronRight,
  Users,
  Bot,
  TriangleAlert,
  GitBranch,
} from "lucide-react";
import { getLatestPlanningRun } from "@/lib/services/backlogPlanningService";
import { getTasksByWave, getPipelineProgress } from "@/lib/services/pipelineService";
import type { Wave, PipelineTask } from "@/lib/types/task";
import type { BacklogPlanningWave, PipelinePlanningRun } from "@/lib/types/planning";
import type { WaveReview } from "@/lib/services/waveReviewService";
import { normalizeRepoPath } from "@/lib/utils";
import ProgressBar from "./ProgressBar";
import TaskReview from "./TaskReview";
import WaveReviewPanel from "./WaveReviewPanel";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Agent {
  slug: string;
  name: string;
  department: string;
  portrait_url?: string | null;
  icon_url?: string | null;
}

interface DevPipelineViewProps {
  projectId: string;
}

interface ExecutionStatus {
  taskId: string;
  status: "running" | "success" | "error";
  filesWritten?: string[];
  summary?: string;
  tokensUsed?: number;
  iterations?: number;
  durationMs?: number;
  errorMessage?: string;
}

interface PlanningTaskMeta {
  notes: string | null;
  contextFiles: string[];
}

interface PlanningBannerProps {
  run: PipelinePlanningRun | null;
  generating: boolean;
}

const REDUNDANT_PLANNING_WARNING_PATTERNS = [
  /engine not yet defined/i,
  /assuming godot/i,
  /platform targets not specified/i,
  /defaulting to web export/i,
];

// ── Simplified status mapping ─────────────────────────────────────────────────

type SimpleStatus = "todo" | "running" | "done" | "error";

function toSimpleStatus(s: string): SimpleStatus {
  switch (s) {
    case "completed":
      return "done";
    case "in-progress":
    case "retrying":
      return "running";
    case "failed":
      return "error";
    default:
      return "todo";
  }
}

const SIMPLE_LABEL: Record<SimpleStatus, string> = {
  todo: "À faire",
  running: "En cours",
  done: "Terminé",
  error: "Échoué",
};

const SIMPLE_STYLE: Record<SimpleStatus, string> = {
  todo: "text-white/40 bg-white/4 border-white/10",
  running: "text-violet-400 bg-violet-500/10 border-violet-500/25",
  done: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  error: "text-red-400 bg-red-500/10 border-red-500/20",
};

function formatPlanningDuration(durationMs: number | null): string | null {
  if (durationMs == null || Number.isNaN(durationMs)) return null;
  if (durationMs < 1000) return `${durationMs} ms`;
  return `${(durationMs / 1000).toFixed(1)} s`;
}

function getPlanningTaskMeta(
  task: PipelineTask,
  planningWave: BacklogPlanningWave | null | undefined
): PlanningTaskMeta | null {
  if (!planningWave) return null;

  const normalizedTaskPath = normalizeRepoPath(task.deliverablePath);
  const candidate = planningWave.tasks.find((planningTask) => {
    if (task.backlogRef && planningTask.backlog_ref === task.backlogRef) {
      return true;
    }

    if (normalizedTaskPath && planningTask.deliverable_path === normalizedTaskPath) {
      return true;
    }

    return planningTask.title.trim().toLowerCase() === task.title.trim().toLowerCase();
  });

  if (!candidate) return null;

  return {
    notes: candidate.planning_notes,
    contextFiles: candidate.context_files,
  };
}

function PlanningBanner({ run, generating }: PlanningBannerProps) {
  if (!generating && !run) return null;

  const planningSummary = run?.normalizedOutput?.planningSummary?.trim() || null;
  const warnings = (run?.warnings ?? []).filter(
    (warning) => !REDUNDANT_PLANNING_WARNING_PATTERNS.some((pattern) => pattern.test(warning))
  );
  const waveCount = run?.normalizedOutput?.waves.length ?? 0;
  const durationLabel = formatPlanningDuration(run?.durationMs ?? null);
  const tokenLabel = run?.tokenUsage != null ? `${run.tokenUsage.toLocaleString()} tokens` : null;

  return (
    <div className="rounded-2xl border border-cyan-400/20 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),rgba(8,47,73,0.22)_42%,rgba(8,47,73,0.08)_100%)] p-4 sm:p-5 space-y-3 shadow-[0_18px_60px_rgba(6,182,212,0.12)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-cyan-200">
            {generating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Bot className="w-4 h-4" />
            )}
            <p className="text-sm font-semibold">
              {generating ? "Planification IA en cours" : "Planification IA"}
            </p>
          </div>
          <p className="text-xs text-cyan-100/75">
            {generating
              ? "Analyse backlog, recentrage du scope arcade web, découpage des waves et validation des dépendances."
              : waveCount > 0
              ? `${waveCount} wave(s) préparée(s)${run?.fallbackUsed ? " avec fallback" : ""}.`
              : run?.fallbackUsed
              ? "Le run CrewAI a échoué et la génération locale a pris le relais."
              : "Dernier run de planification enregistré."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
          <span className="inline-flex items-center gap-1 rounded-full border border-cyan-400/25 bg-cyan-500/10 px-2.5 py-1 text-cyan-100">
            <GitBranch className="w-3 h-3" />
            CrewAI
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-2.5 py-1 text-emerald-100">
            Web only
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-fuchsia-400/25 bg-fuchsia-500/10 px-2.5 py-1 text-fuchsia-100">
            Scope arcade
          </span>
          {run?.fallbackUsed && !generating && (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/25 bg-amber-500/10 px-2.5 py-1 text-amber-200">
              <TriangleAlert className="w-3 h-3" />
              Fallback actif
            </span>
          )}
          {durationLabel && !generating && (
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-white/65">
              {durationLabel}
            </span>
          )}
          {tokenLabel && !generating && (
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-white/65">
              {tokenLabel}
            </span>
          )}
        </div>
      </div>

      {!generating && (
        <div className="grid gap-2 text-[11px] text-white/72 sm:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-black/15 px-3 py-2">
            Boucle de jeu simple, lisible et jouable vite
          </div>
          <div className="rounded-xl border border-white/10 bg-black/15 px-3 py-2">
            UI nette et repo structure pour sortir un vrai build
          </div>
          <div className="rounded-xl border border-white/10 bg-black/15 px-3 py-2">
            Integration VN et postMessage des la planification
          </div>
        </div>
      )}

      {planningSummary && !generating && (
        <p className="text-sm text-white/80 leading-relaxed">{planningSummary}</p>
      )}

      {warnings.length > 0 && !generating && (
        <div className="rounded-xl border border-amber-400/20 bg-amber-500/8 px-3 py-3 space-y-1.5">
          <p className="text-xs font-semibold text-amber-100">Warnings de planification</p>
          {warnings.map((warning) => (
            <p key={warning} className="text-xs text-amber-100/80">
              {warning}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

// ── AgentPicker ───────────────────────────────────────────────────────────────

function AgentPicker({
  agents,
  currentSlug,
  onSelect,
  onClose,
}: {
  agents: Agent[];
  currentSlug: string | null;
  onSelect: (slug: string | null) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute z-50 top-full mt-1 right-0 w-52 rounded-xl border border-white/12 bg-zinc-900/95 backdrop-blur-xl shadow-2xl py-1"
    >
      <button
        onClick={() => onSelect(null)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors"
      >
        <X className="w-3 h-3" />
        Retirer l&apos;assignation
      </button>
      <div className="my-1 border-t border-white/8" />
      {agents.map((a) => (
        <button
          key={a.slug}
          onClick={() => onSelect(a.slug)}
          className={[
            "w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left transition-colors hover:bg-white/5",
            a.slug === currentSlug ? "text-white bg-white/5" : "text-white/70",
          ].join(" ")}
        >
          <div className="w-6 h-6 rounded-full bg-linear-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-[9px] font-bold text-white shrink-0">
            {a.name.charAt(0)}
          </div>
          <div className="min-w-0">
            <p className="font-medium truncate">{a.name}</p>
            <p className="text-white/35 capitalize truncate">{a.department}</p>
          </div>
          {a.slug === currentSlug && (
            <CheckCircle2 className="w-3 h-3 text-emerald-400 ml-auto shrink-0" />
          )}
        </button>
      ))}
    </div>
  );
}

// ── Execution Log (compact inline) ────────────────────────────────────────────

function ExecutionLog({ status }: { status: ExecutionStatus }) {
  if (status.status === "running") {
    return (
      <div className="mt-2 px-3 py-2 rounded-lg bg-violet-500/5 border border-violet-500/15 text-xs space-y-1">
        <div className="flex items-center gap-2 text-violet-300">
          <Loader2 className="w-3 h-3 animate-spin" />
          <span className="font-medium">Agent en cours d&apos;exécution…</span>
        </div>
      </div>
    );
  }

  if (status.status === "error") {
    return (
      <div className="mt-2 px-3 py-2 rounded-lg bg-red-500/5 border border-red-500/15 text-xs space-y-1">
        <div className="flex items-center gap-2 text-red-400">
          <AlertCircle className="w-3 h-3" />
          <span className="font-medium">Erreur</span>
        </div>
        {status.errorMessage && (
          <p className="text-red-300/70 pl-5 line-clamp-2">{status.errorMessage}</p>
        )}
      </div>
    );
  }

  // success
  return (
    <div className="mt-2 px-3 py-2 rounded-lg bg-emerald-500/5 border border-emerald-500/15 text-xs space-y-1.5">
      <div className="flex items-center gap-2 text-emerald-400">
        <CheckCircle2 className="w-3 h-3" />
        <span className="font-medium">Terminé</span>
        {status.durationMs && (
          <span className="text-white/30 ml-auto">
            {(status.durationMs / 1000).toFixed(1)}s
          </span>
        )}
      </div>
      {status.summary && (
        <p className="text-white/50 pl-5 line-clamp-3">{status.summary}</p>
      )}
      {status.filesWritten && status.filesWritten.length > 0 && (
        <div className="pl-5 text-white/35 space-y-0.5">
          {status.filesWritten.map((f) => (
            <p key={f} className="font-mono truncate">
              📄 {f}
            </p>
          ))}
        </div>
      )}
      {status.tokensUsed != null && (
        <p className="text-white/25 pl-5">{status.tokensUsed.toLocaleString()} tokens</p>
      )}
    </div>
  );
}

// ── DevTaskRow ────────────────────────────────────────────────────────────────

function DevTaskRow({
  task,
  agents,
  executionStatus,
  planningMeta,
  onAssign,
  onReview,
  onExecute,
  onCancel,
}: {
  task: PipelineTask;
  agents: Agent[];
  executionStatus?: ExecutionStatus;
  planningMeta?: PlanningTaskMeta | null;
  onAssign: (taskId: string, slug: string | null) => Promise<void>;
  onReview: (task: PipelineTask) => void;
  onExecute: (task: PipelineTask) => void;
  onCancel: (task: PipelineTask) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [assigning, setAssigning] = useState(false);

  const assignedAgent = agents.find((a) => a.slug === task.assignedAgentSlug);
  const simple = toSimpleStatus(task.status);
  const style = SIMPLE_STYLE[simple];
  const isRunning = simple === "running";
  const isDone = simple === "done";
  const canExecute =
    (task.status === "ready" || task.status === "failed") &&
    task.assignedAgentSlug != null &&
    !executionStatus;
  const canReview = task.status === "review" || (isDone && task.deliverableContent);

  async function handleAssign(slug: string | null) {
    setPickerOpen(false);
    setAssigning(true);
    await onAssign(task.id, slug);
    setAssigning(false);
  }

  return (
    <div
      className={[
        "relative flex items-start gap-3 rounded-xl border p-3.5 transition-all duration-200 bg-white/2 backdrop-blur-sm",
        isDone ? "border-white/6 opacity-70" : "border-white/8",
        isRunning ? "border-violet-500/25 shadow-[0_0_20px_-4px] shadow-violet-500/15" : "",
      ].join(" ")}
    >
      {/* Status indicator */}
      <div className="mt-0.5 shrink-0 w-7 h-7 flex items-center justify-center rounded-lg">
        {isRunning ? (
          <Loader2 className="w-4 h-4 text-violet-400 animate-spin" />
        ) : isDone ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
        ) : simple === "error" ? (
          <AlertCircle className="w-4 h-4 text-red-400" />
        ) : (
          <div className="w-3 h-3 rounded-full border-2 border-white/20" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p
              className={[
                "text-sm font-semibold leading-snug",
                isDone ? "line-through text-white/40" : "text-white/90",
              ].join(" ")}
            >
              {task.title}
            </p>
            {task.backlogRef && (
              <p className="text-[10px] font-mono text-white/30 mt-0.5">{task.backlogRef}</p>
            )}
          </div>

          <span
            className={[
              "shrink-0 inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold border",
              style,
            ].join(" ")}
          >
            {SIMPLE_LABEL[simple]}
          </span>
        </div>

        {task.description && (
          <p className="text-xs text-white/40 leading-relaxed line-clamp-2">
            {task.description}
          </p>
        )}

        {planningMeta && (
          <div className="space-y-2 rounded-lg border border-cyan-500/15 bg-cyan-500/6 px-3 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full border border-cyan-400/20 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-100">
                <Bot className="w-3 h-3" />
                Proposée par CrewAI
              </span>
              {task.backlogRef && (
                <span className="text-[10px] font-mono text-cyan-100/60">{task.backlogRef}</span>
              )}
            </div>

            {planningMeta.notes && (
              <p className="text-xs text-cyan-50/80 leading-relaxed">{planningMeta.notes}</p>
            )}

            {planningMeta.contextFiles.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {planningMeta.contextFiles.map((filePath) => (
                  <span
                    key={filePath}
                    className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-mono text-white/55"
                  >
                    {filePath}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Footer: assignee + actions */}
        <div className="flex items-center justify-between pt-1 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {assignedAgent ? (
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-full bg-linear-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-[9px] font-bold text-white">
                  {assignedAgent.name.charAt(0)}
                </div>
                <span className="text-xs text-white/50 truncate">{assignedAgent.name}</span>
              </div>
            ) : (
              <span className="text-xs text-white/25 italic">Non assigné</span>
            )}

            {/* Assign button */}
            <div className="relative">
              <button
                onClick={() => setPickerOpen((v) => !v)}
                disabled={assigning || isDone}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium text-white/40 hover:text-white/70 hover:bg-white/6 transition-colors disabled:opacity-30"
              >
                {assigning ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <UserPlus className="w-3 h-3" />
                )}
              </button>

              {pickerOpen && (
                <AgentPicker
                  agents={agents}
                  currentSlug={task.assignedAgentSlug}
                  onSelect={handleAssign}
                  onClose={() => setPickerOpen(false)}
                />
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            {isRunning && (
              <button
                onClick={() => onCancel(task)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500/15 text-red-300 border border-red-500/25 hover:bg-red-500/25 transition-colors"
              >
                <X className="w-3 h-3" />
                Annuler
              </button>
            )}
            {canExecute && (
              <button
                onClick={() => onExecute(task)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-violet-500/15 text-violet-300 border border-violet-500/25 hover:bg-violet-500/25 transition-colors"
              >
                <Play className="w-3 h-3" />
                Lancer
              </button>
            )}
            {canReview && (
              <button
                onClick={() => onReview(task)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/5 text-white/60 border border-white/10 hover:bg-white/10 transition-colors"
              >
                <FileText className="w-3 h-3" />
                Voir
              </button>
            )}
          </div>
        </div>

        {/* Execution status (compact, inline) */}
        {executionStatus && <ExecutionLog status={executionStatus} />}
      </div>
    </div>
  );
}

// ── Backlog Summary ───────────────────────────────────────────────────────────

function BacklogSummary({ projectId, refreshKey }: { projectId: string; refreshKey: number }) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        // Fetch the backlog from the concept phase pipeline task
        const conceptWaves = await getTasksByWave(projectId, "concept");
        const backlogTask = conceptWaves
          .flatMap((w) => w.tasks)
          .find((t) => t.deliverablePath === "docs/backlog.md" && t.deliverableContent);
        if (backlogTask?.deliverableContent) {
          setContent(backlogTask.deliverableContent);
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [projectId, refreshKey]);

  if (loading || !content) return null;

  // Show first ~500 chars or full if expanded
  const preview = content.length > 500 ? content.slice(0, 500) + "…" : content;

  return (
    <div className="rounded-xl border border-white/8 bg-white/2 p-4 space-y-2">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-2 text-sm font-semibold text-white/70 hover:text-white/90 transition-colors w-full text-left"
      >
        {expanded ? (
          <ChevronDown className="w-4 h-4 shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 shrink-0" />
        )}
        📋 Backlog du projet
      </button>
      {expanded && (
        <pre className="text-xs text-white/40 whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto font-mono">
          {content}
        </pre>
      )}
      {!expanded && (
        <p className="text-xs text-white/30 leading-relaxed line-clamp-3 pl-6">
          {preview}
        </p>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DevPipelineView({ projectId }: DevPipelineViewProps) {
  const [waves, setWaves] = useState<Wave[]>([]);
  const [progress, setProgress] = useState({
    total: 0,
    completed: 0,
    inProgress: 0,
    failed: 0,
    percentage: 0,
  });
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [autoAssigning, setAutoAssigning] = useState(false);
  const [runningAll, setRunningAll] = useState(false);
  const [reviewTask, setReviewTask] = useState<PipelineTask | null>(null);
  const [planningRun, setPlanningRun] = useState<PipelinePlanningRun | null>(null);
  const [waveReviews, setWaveReviews] = useState<Map<number, WaveReview>>(new Map());
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionInfo, setActionInfo] = useState<string | null>(null);
  const [executionStatuses, setExecutionStatuses] = useState<Map<string, ExecutionStatus>>(
    new Map()
  );
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wavesRef = useRef(waves);
  wavesRef.current = waves;

  // Start polling imperatively — safe to call multiple times
  const startPolling = useCallback(() => {
    if (pollingRef.current) return;
    pollingRef.current = setInterval(async () => {
      const currentWaves = wavesRef.current;
      const hasRunning = currentWaves
        .flatMap((w) => w.tasks)
        .some((t) => t.status === "in-progress" || t.status === "retrying");

      if (!hasRunning) {
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
        return;
      }

      const [wavesData, progressData] = await Promise.all([
        getTasksByWave(projectId, "in-dev"),
        getPipelineProgress(projectId, "in-dev"),
      ]);
      setWaves(wavesData);
      setProgress(progressData);

      // Check if previously running tasks are now done
      const allTasks = wavesData.flatMap((w: Wave) => w.tasks);
      setExecutionStatuses((prev) => {
        const next = new Map(prev);
        let changed = false;
        for (const [taskId, status] of prev) {
          if (status.status === "running") {
            const task = allTasks.find((t: PipelineTask) => t.id === taskId);
            if (task && task.status !== "in-progress" && task.status !== "retrying") {
              changed = true;
              next.set(taskId, {
                ...status,
                status: task.status === "completed" || task.status === "review" ? "success" : "error",
                summary: task.status === "completed" ? "Tâche terminée avec succès" : undefined,
                errorMessage: task.status === "failed" ? "Échec de l'exécution" : undefined,
              });
            }
          }
        }
        return changed ? next : prev;
      });
    }, 5000);
  }, [projectId]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [wavesData, progressData, agentsRes, latestPlanningRun] = await Promise.all([
        getTasksByWave(projectId, "in-dev"),
        getPipelineProgress(projectId, "in-dev"),
        fetch("/api/agents").then((r) => r.json()),
        getLatestPlanningRun(projectId),
      ]);
      setWaves(wavesData);
      setProgress(progressData);
      setAgents(agentsRes ?? []);
      setPlanningRun(latestPlanningRun);

      // Load wave reviews for completed waves
      const completedWaveNumbers = wavesData
        .filter((w: Wave) => w.allCompleted && w.number > 0)
        .map((w: Wave) => w.number);
      if (completedWaveNumbers.length > 0) {
        const reviews = await Promise.all(
          completedWaveNumbers.map((n: number) =>
            fetch(`/api/pipeline/${projectId}/wave-review?wave=${n}`)
              .then((r) => (r.ok ? r.json() : null))
              .then((d) => (d?.review ? ([n, d.review] as [number, WaveReview]) : null))
              .catch(() => null)
          )
        );
        const reviewMap = new Map<number, WaveReview>();
        for (const entry of reviews) {
          if (entry) reviewMap.set(entry[0], entry[1]);
        }
        setWaveReviews(reviewMap);
      }

      // Auto-start polling if tasks are running
      const hasRunning = wavesData
        .flatMap((w: Wave) => w.tasks)
        .some((t: PipelineTask) => t.status === "in-progress" || t.status === "retrying");
      if (hasRunning) {
        startPolling();
      }
    } finally {
      setLoading(false);
    }
  }, [projectId, startPolling]);

  useEffect(() => {
    load();
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [load]);

  const handleGenerate = async () => {
    setGenerating(true);
    setActionError(null);
    setActionInfo(null);
    try {
      const res = await fetch(`/api/pipeline/${projectId}/generate`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Impossible de générer les waves");
      }
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setGenerating(false);
    }
  };

  const handleReplayBacklog = async () => {
    setGenerating(true);
    setActionError(null);
    setActionInfo(null);
    try {
      const res = await fetch(`/api/pipeline/${projectId}/catch-up`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Impossible de relancer le backlog de développement");
      }
      setActionInfo("Backlog relancé. Les waves ont été recalculées depuis le repo.");
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setGenerating(false);
    }
  };

  const handleAssign = async (taskId: string, slug: string | null) => {
    setActionError(null);
    setActionInfo(null);

    const res = await fetch(`/api/pipeline/task/${taskId}/assign`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentSlug: slug }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(data?.error ?? "Impossible d'assigner la tâche");
    }

    await load();
  };

  const handleAutoAssign = async () => {
    setAutoAssigning(true);
    setActionError(null);
    setActionInfo(null);
    try {
      const res = await fetch(`/api/pipeline/${projectId}/auto-assign`, { method: "POST" });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error ?? "Erreur lors de l'auto-assignation");
      }

      const assigned = typeof data?.assigned === "number" ? data.assigned : 0;
      const total = typeof data?.total === "number" ? data.total : assigned;

      if (assigned === 0) {
        setActionInfo(
          total > 0
            ? "Aucune tâche n'a pu être assignée automatiquement pour ce projet."
            : "Aucune tâche non assignée n'a été trouvée."
        );
      } else {
        setActionInfo(
          assigned === total
            ? `${assigned} tâche(s) assignée(s) automatiquement.`
            : `${assigned} tâche(s) assignée(s), ${total - assigned} ignorée(s).`
        );
      }

      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Erreur lors de l'auto-assignation");
    } finally {
      setAutoAssigning(false);
    }
  };

  const handleExecute = async (task: PipelineTask) => {
    // Mark as running in local state immediately
    setExecutionStatuses((prev) => {
      const next = new Map(prev);
      next.set(task.id, { taskId: task.id, status: "running" });
      return next;
    });

    // Start polling now that a task is running
    startPolling();

    try {
      const endpoint =
        task.status === "failed"
          ? `/api/pipeline/task/${task.id}/retry`
          : `/api/pipeline/task/${task.id}/execute`;

      const res = await fetch(endpoint, {
        method: "POST",
      });
      const data = await res.json();

      setExecutionStatuses((prev) => {
        const next = new Map(prev);
        if (res.ok) {
          next.set(task.id, {
            taskId: task.id,
            status: "success",
            summary: data.summary,
            filesWritten: data.filesWritten,
            tokensUsed: data.tokensUsed,
            durationMs: data.durationMs,
            iterations: data.iterations,
          });
        } else {
          next.set(task.id, {
            taskId: task.id,
            status: "error",
            errorMessage: data.error ?? "Erreur inconnue",
          });
        }
        return next;
      });

      await load();
    } catch (err) {
      setExecutionStatuses((prev) => {
        const next = new Map(prev);
        next.set(task.id, {
          taskId: task.id,
          status: "error",
          errorMessage: err instanceof Error ? err.message : "Erreur réseau",
        });
        return next;
      });
    }
  };

  // Execute a single task and update execution status (shared helper for run-all)
  const executeTaskSilent = async (task: PipelineTask) => {
    setExecutionStatuses((prev) => {
      const next = new Map(prev);
      next.set(task.id, { taskId: task.id, status: "running" });
      return next;
    });
    startPolling();
    const endpoint =
      task.status === "failed"
        ? `/api/pipeline/task/${task.id}/retry`
        : `/api/pipeline/task/${task.id}/execute`;
    const res = await fetch(endpoint, { method: "POST" });
    const data = await res.json();
    setExecutionStatuses((prev) => {
      const next = new Map(prev);
      if (res.ok) {
        next.set(task.id, {
          taskId: task.id,
          status: "success",
          summary: data.summary,
          filesWritten: data.filesWritten,
          tokensUsed: data.tokensUsed,
          durationMs: data.durationMs,
        });
      } else {
        next.set(task.id, {
          taskId: task.id,
          status: "error",
          errorMessage: data.error ?? "Erreur inconnue",
        });
      }
      return next;
    });
    return res.ok;
  };

  const handleRunAll = async () => {
    setRunningAll(true);
    setActionError(null);
    try {
      // Get a fresh snapshot of all waves sorted by wave number
      const freshWaves = await getTasksByWave(projectId, "in-dev");
      const sortedWaves = [...freshWaves].sort((a, b) => a.number - b.number);

      for (const wave of sortedWaves) {
        if (wave.allCompleted) continue;

        // Process this wave until all tasks are done or we're stuck
        let stuck = false;
        while (!stuck) {
          await fetch(`/api/pipeline/${projectId}/advance`, { method: "POST" });
          const refreshed = await getTasksByWave(projectId, "in-dev");
          setWaves(refreshed);

          const currentWave = refreshed.find((w) => w.number === wave.number);
          if (!currentWave) break;

          const allTasks = currentWave.tasks;

          if (allTasks.every((t) => t.status === "completed")) break;

          // Any failed task → abort
          const failedTasks = allTasks.filter((t) => t.status === "failed");
          if (failedTasks.length > 0) {
            setActionError(`Wave ${wave.number} : ${failedTasks.length} tâche(s) échouée(s)`);
            stuck = true;
            break;
          }

          // Auto-approve review tasks first
          const reviewTasks = allTasks.filter((t) => t.status === "review");
          for (const task of reviewTasks) {
            setExecutionStatuses((prev) => {
              const next = new Map(prev);
              next.set(task.id, { taskId: task.id, status: "running" });
              return next;
            });
            await fetch(`/api/pipeline/task/${task.id}/approve`, { method: "POST" });
            setExecutionStatuses((prev) => {
              const next = new Map(prev);
              next.set(task.id, { taskId: task.id, status: "success", summary: "Approuvé automatiquement" });
              return next;
            });
          }
          if (reviewTasks.length > 0) continue;

          // Execute ready tasks
          const readyTasks = allTasks.filter((t) => t.status === "ready");
          if (readyTasks.length === 0) {
            // Nothing ready and not all done → something is in-progress or planned, wait
            const anyActive = allTasks.some((t) => t.status === "in-progress" || t.status === "retrying");
            if (!anyActive) stuck = true; // deadlock
            break;
          }

          for (const task of readyTasks) {
            const ok = await executeTaskSilent(task);
            if (!ok) {
              setActionError(`Échec lors de la tâche : ${task.title}`);
              stuck = true;
              break;
            }
          }

          if (stuck) break;
        }

        if (stuck) break;
      }
    } finally {
      setRunningAll(false);
      await load();
    }
  };

  const handleCancel = async (task: PipelineTask) => {
    try {
      const res = await fetch(`/api/pipeline/task/${task.id}/cancel`, {
        method: "POST",
      });

      if (res.ok) {
        // Clear execution status for this task
        setExecutionStatuses((prev) => {
          const next = new Map(prev);
          next.delete(task.id);
          return next;
        });
        await load();
      }
    } catch {
      // silently fail — poll will catch up
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/8 bg-white/2 backdrop-blur-md p-6 space-y-4 animate-pulse">
        <div className="h-5 w-48 bg-white/10 rounded-lg" />
        <div className="h-3 w-full bg-white/6 rounded-full" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 rounded-xl bg-white/4" />
        ))}
      </div>
    );
  }

  // ── Empty: no dev tasks yet ────────────────────────────────────────────────
  if (waves.length === 0) {
    return (
      <div className="space-y-4">
        <BacklogSummary projectId={projectId} refreshKey={progress.total} />
        <PlanningBanner run={planningRun} generating={generating} />
        <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center space-y-4">
          <Layers className="w-8 h-8 text-white/20 mx-auto" />
          <div className="space-y-1">
            <p className="text-sm text-white/40 font-medium">Backlog non encore importé</p>
            <p className="text-xs text-white/25">
              Le Producer va lire le backlog validé et créer les waves de développement.
            </p>
          </div>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-500/15 border border-violet-500/25 text-violet-300 text-sm font-semibold hover:bg-violet-500/25 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Zap className="w-4 h-4" />
            )}
            {generating ? "Génération des waves…" : "Importer le backlog"}
          </button>


        </div>
      </div>
    );
  }

  // ── Main render ──────────────────────────────────────────────────────────────
  return (
    <>
      <div className="space-y-4">
        <BacklogSummary projectId={projectId} refreshKey={progress.total} />
        <PlanningBanner run={planningRun} generating={generating} />

        <div className="rounded-2xl border border-white/8 bg-white/2 backdrop-blur-md p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h3 className="text-base font-bold text-white/90">Pipeline de Développement</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={handleAutoAssign}
                disabled={autoAssigning || runningAll || generating}
                className="flex items-center gap-1.5 text-xs font-semibold text-indigo-300 hover:text-indigo-200 transition-colors px-2.5 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {autoAssigning ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Users className="w-3.5 h-3.5" />
                )}
                {autoAssigning ? "Assignation…" : "Assigner par rôle"}
              </button>
              <button
                onClick={handleRunAll}
                disabled={runningAll || generating}
                className="flex items-center gap-1.5 text-xs font-semibold text-violet-300 hover:text-violet-200 transition-colors px-2.5 py-1.5 rounded-lg bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {runningAll ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Zap className="w-3.5 h-3.5" />
                )}
                {runningAll ? "En cours…" : "Lancer tout"}
              </button>
              <button
                onClick={handleReplayBacklog}
                disabled={generating || runningAll}
                className="flex items-center gap-1.5 text-xs font-semibold text-white/40 hover:text-white/70 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-white/5 disabled:opacity-30"
              >
                {generating ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Zap className="w-3.5 h-3.5" />
                )}
                Relancer backlog
              </button>
              <button
                onClick={load}
                disabled={runningAll}
                className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-white/5 disabled:opacity-40"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Actualiser
              </button>
            </div>
          </div>

          {/* Error banner */}
          {actionError && (
            <div className="flex items-center gap-2 rounded-xl border border-red-500/25 bg-red-500/8 px-4 py-3 text-sm text-red-300">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {actionError}
            </div>
          )}

          {actionInfo && (
            <div className="flex items-center gap-2 rounded-xl border border-amber-500/25 bg-amber-500/8 px-4 py-3 text-sm text-amber-200">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {actionInfo}
            </div>
          )}

          {/* Progress */}
          <ProgressBar
            percentage={progress.percentage}
            total={progress.total}
            completed={progress.completed}
            inProgress={progress.inProgress}
            failed={progress.failed}
            waves={waves}
          />

          {/* Waves */}
          <div className="space-y-6 divide-y divide-white/4">
            {waves.map((wave, i) => {
              const waveTitle =
                wave.number === 0 ? "Pipeline de Conception" : `Wave ${wave.number}`;
              const planningWave = planningRun?.normalizedOutput?.waves.find(
                (candidate) => candidate.number === wave.number
              );
              const showCheckpoint = wave.allCompleted && wave.number > 0;
              return (
                <div key={wave.number} className={i > 0 ? "pt-6 space-y-2" : "space-y-2"}>
                  {/* Wave header */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center">
                      {wave.allCompleted ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Layers className="w-4 h-4 text-white/40" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white/90">{waveTitle}</p>
                      <p className="text-xs text-white/40">
                        {wave.tasks.length} tâche{wave.tasks.length > 1 ? "s" : ""}
                      </p>
                      {planningWave?.goal && (
                        <p className="text-xs text-cyan-100/75 mt-1">{planningWave.goal}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-2 mt-1.5">
                        {planningWave && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-cyan-400/20 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-100">
                            <Bot className="w-3 h-3" />
                            Source CrewAI
                          </span>
                        )}
                        {planningRun?.fallbackUsed && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-200">
                            <TriangleAlert className="w-3 h-3" />
                            Fallback utilisé
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Tasks */}
                  <div className="space-y-2">
                    {wave.tasks.map((task) => (
                      <DevTaskRow
                        key={task.id}
                        task={task}
                        agents={agents}
                        executionStatus={executionStatuses.get(task.id)}
                        planningMeta={getPlanningTaskMeta(task, planningWave)}
                        onAssign={handleAssign}
                        onReview={setReviewTask}
                        onExecute={handleExecute}
                        onCancel={handleCancel}
                      />
                    ))}
                  </div>

                  {/* Checkpoint visuel après chaque wave de dev terminée */}
                  {showCheckpoint && (
                    <WaveReviewPanel
                      projectId={projectId}
                      waveNumber={wave.number}
                      review={waveReviews.get(wave.number) ?? null}
                      onReviewCreated={(review) => {
                        setWaveReviews((prev) => new Map(prev).set(wave.number, review));
                      }}
                      onDecision={(review) => {
                        setWaveReviews((prev) => new Map(prev).set(wave.number, review));
                        load();
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Task review modal */}
      <TaskReview task={reviewTask} onClose={() => { setReviewTask(null); load(); }} />
    </>
  );
}