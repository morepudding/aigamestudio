"use client";

import { motion } from "framer-motion";
import {
  CheckCircle2,
  Clock,
  Loader2,
  AlertCircle,
  Eye,
  RotateCcw,
  FileText,
  Code2,
  FileJson,
  Settings2,
  GitBranch,
  User,
  Bot,
  Play,
} from "lucide-react";
import type { PipelineTask, TaskStatus } from "@/lib/types/task";

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  TaskStatus,
  { label: string; color: string; bgColor: string; borderColor: string; icon: React.ReactNode }
> = {
  created: {
    label: "Planifiée",
    color: "text-white/40",
    bgColor: "bg-white/4",
    borderColor: "border-white/10",
    icon: <Clock className="w-3 h-3" />,
  },
  ready: {
    label: "Prête",
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/20",
    icon: <Clock className="w-3 h-3" />,
  },
  "in-progress": {
    label: "En cours",
    color: "text-violet-400",
    bgColor: "bg-violet-500/10",
    borderColor: "border-violet-500/25",
    icon: <Loader2 className="w-3 h-3 animate-spin" />,
  },
  review: {
    label: "En review",
    color: "text-orange-400",
    bgColor: "bg-orange-500/10",
    borderColor: "border-orange-500/25",
    icon: <Eye className="w-3 h-3" />,
  },
  completed: {
    label: "Terminée",
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/20",
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
  failed: {
    label: "Échouée",
    color: "text-red-400",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/20",
    icon: <AlertCircle className="w-3 h-3" />,
  },
  retrying: {
    label: "Nouvelle tentative",
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/20",
    icon: <RotateCcw className="w-3 h-3 animate-spin" />,
  },
};

// ── Deliverable icon ──────────────────────────────────────────────────────────

function DeliverableIcon({ type }: { type: PipelineTask["deliverableType"] }) {
  switch (type) {
    case "markdown":
      return <FileText className="w-3 h-3 shrink-0" />;
    case "code":
      return <Code2 className="w-3 h-3 shrink-0" />;
    case "json":
      return <FileJson className="w-3 h-3 shrink-0" />;
    case "config":
      return <Settings2 className="w-3 h-3 shrink-0" />;
    case "repo-init":
      return <GitBranch className="w-3 h-3 shrink-0" />;
  }
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface TaskCardProps {
  task: PipelineTask;
  index?: number;
  isExecuting?: boolean;
  executionLocked?: boolean;
  onReview?: (task: PipelineTask) => void;
  onExecute?: (task: PipelineTask) => void;
  onRetry?: (task: PipelineTask) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function TaskCard({
  task,
  index = 0,
  isExecuting = false,
  executionLocked = false,
  onReview,
  onExecute,
  onRetry,
}: TaskCardProps) {
  const cfg = STATUS_CONFIG[task.status];
  const isActive = task.status === "in-progress" || task.status === "retrying";
  const isReview = task.status === "review";
  const isReady = task.status === "ready";
  const isCompleted = task.status === "completed";
  const isFailed = task.status === "failed";
  const isBlocked = task.status === "created" && task.dependsOn.length > 0;
  const canReview = isReview && !!onReview;
  const canPreview = isCompleted && !!task.deliverableContent && !!onReview;
  const canExecute = isReady && !executionLocked && !!onExecute;
  const canRetry = isFailed && !executionLocked && !!onRetry;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.06, ease: "easeOut" }}
      className={[
        "relative group rounded-xl border p-4 transition-all duration-200",
        "backdrop-blur-md bg-white/3",
        cfg.borderColor,
        isActive ? "shadow-[0_0_24px_-4px] shadow-violet-500/20" : "",
        isReview ? "shadow-[0_0_24px_-4px] shadow-orange-500/20" : "",
        isCompleted && !canPreview ? "opacity-75" : isCompleted ? "opacity-90" : "",
        isBlocked ? "opacity-50" : "",
        canReview || canExecute || canPreview
          ? "cursor-pointer hover:bg-white/6"
          : canRetry
          ? "cursor-pointer hover:bg-white/6"
          : "",
      ].join(" ")}
      onClick={() => {
        if (canReview) onReview?.(task);
        else if (canPreview) onReview?.(task);
        else if (canExecute) onExecute?.(task);
        else if (canRetry) onRetry?.(task);
      }}
    >
      {/* Executing overlay */}
      {isExecuting && (
        <div className="absolute inset-0 rounded-xl bg-violet-500/10 backdrop-blur-[1px] flex items-center justify-center z-10 pointer-events-none">
          <div className="flex items-center gap-2 bg-black/60 rounded-lg px-3 py-1.5 border border-violet-500/30">
            <Loader2 className="w-3.5 h-3.5 text-violet-400 animate-spin" />
            <span className="text-xs font-semibold text-violet-300">En cours…</span>
          </div>
        </div>
      )}

      {/* Active shimmer border */}
      {isActive && (
        <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
          <motion.div
            className="absolute inset-0 rounded-xl border border-violet-500/40"
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
      )}

      <div className="flex items-start gap-3">
        {/* Status icon */}
        <div
          className={[
            "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
            cfg.bgColor,
            cfg.color,
          ].join(" ")}
        >
          {cfg.icon}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-1.5">
          {/* Title row */}
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold leading-snug text-white/90 truncate">
              {task.title}
            </p>
            {/* Status badge */}
            <span
              className={[
                "shrink-0 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold border",
                cfg.color,
                cfg.bgColor,
                cfg.borderColor,
              ].join(" ")}
            >
              {cfg.icon}
              {cfg.label}
            </span>
          </div>

          {/* Backlog ref */}
          {task.backlogRef && (
            <span className="inline-block text-[10px] font-mono text-white/30 bg-white/5 px-1.5 py-0.5 rounded">
              {task.backlogRef}
            </span>
          )}

          {/* Meta row */}
          <div className="flex items-center gap-3 text-xs text-white/40">
            {/* Agent */}
            <span className="flex items-center gap-1">
              {task.assignedAgentSlug ? (
                <Bot className="w-3 h-3" />
              ) : (
                <User className="w-3 h-3" />
              )}
              <span className="truncate max-w-25">
                {task.assignedAgentSlug ?? task.agentDepartment ?? "Non assigné"}
              </span>
            </span>

            {/* Deliverable path */}
            {task.deliverablePath && (
              <span className="flex items-center gap-1 truncate max-w-40">
                <DeliverableIcon type={task.deliverableType} />
                <span className="truncate font-mono">{task.deliverablePath}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Preview CTA (completed) */}
      {canPreview && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="mt-3 pt-3 border-t border-emerald-500/15 flex items-center justify-between"
        >
          <span className="text-xs text-emerald-400/60">Document disponible</span>
          <button
            className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1"
            onClick={(e) => {
              e.stopPropagation();
              onReview?.(task);
            }}
          >
            <Eye className="w-3 h-3" />
            Voir
          </button>
        </motion.div>
      )}

      {/* Review CTA */}
      {isReview && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="mt-3 pt-3 border-t border-orange-500/20 flex items-center justify-between"
        >
          <span className="text-xs text-orange-400/80">
            Livrable généré — en attente de validation
          </span>
          <button
            className="text-xs font-semibold text-orange-400 hover:text-orange-300 transition-colors flex items-center gap-1"
            onClick={(e) => {
              e.stopPropagation();
              onReview?.(task);
            }}
          >
            <Eye className="w-3 h-3" />
            Réviser
          </button>
        </motion.div>
      )}

      {/* Execute CTA */}
      {isReady && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="mt-3 pt-3 border-t border-blue-500/20 flex items-center justify-between"
        >
          <span className="text-xs text-blue-400/80">
            {executionLocked ? "En attente du cadrage Eve" : "Prête à exécuter"}
          </span>
          {canExecute ? (
            <button
              className="text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
              onClick={(e) => {
                e.stopPropagation();
                onExecute?.(task);
              }}
            >
              <Play className="w-3 h-3" />
              Exécuter
            </button>
          ) : null}
        </motion.div>
      )}

      {/* Retry CTA */}
      {isFailed && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="mt-3 pt-3 border-t border-red-500/20 flex items-center justify-between"
        >
          <span className="text-xs text-red-400/80">
            {executionLocked ? "Bloquée tant que le cadrage n'est pas validé" : "Tâche échouée"}
          </span>
          {canRetry ? (
            <button
              className="text-xs font-semibold text-red-400 hover:text-red-300 transition-colors flex items-center gap-1"
              onClick={(e) => {
                e.stopPropagation();
                onRetry?.(task);
              }}
            >
              <RotateCcw className="w-3 h-3" />
              Relancer
            </button>
          ) : null}
        </motion.div>
      )}
    </motion.div>
  );
}
