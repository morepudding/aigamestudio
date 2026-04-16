"use client";

import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, ChevronDown, ChevronRight, Layers } from "lucide-react";
import { useState } from "react";
import TaskCard from "./TaskCard";
import type { Wave, PipelineTask } from "@/lib/types/task";

interface WaveGroupProps {
  wave: Wave;
  defaultOpen?: boolean;
  executingId?: string | null;
  executionLocked?: boolean;
  onReview?: (task: PipelineTask) => void;
  onExecute?: (task: PipelineTask) => void;
  onRetry?: (task: PipelineTask) => void;
}

export default function WaveGroup({
  wave,
  defaultOpen = true,
  executingId,
  executionLocked = false,
  onReview,
  onExecute,
  onRetry,
}: WaveGroupProps) {
  const [open, setOpen] = useState(defaultOpen);

  const completedCount = wave.tasks.filter((t) => t.status === "completed").length;
  const inProgressCount = wave.tasks.filter((t) => t.status === "in-progress").length;
  const reviewCount = wave.tasks.filter((t) => t.status === "review").length;
  const total = wave.tasks.length;

  // Wave state label
  const waveLabel = wave.allCompleted
    ? "Terminée"
    : inProgressCount > 0
    ? "En cours"
    : reviewCount > 0
    ? "En review"
    : completedCount > 0
    ? `${completedCount}/${total} complétées`
    : "En attente";

  const waveAccent = wave.allCompleted
    ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
    : inProgressCount > 0
    ? "text-violet-400 bg-violet-500/10 border-violet-500/20"
    : reviewCount > 0
    ? "text-orange-400 bg-orange-500/10 border-orange-500/20"
    : "text-white/40 bg-white/4 border-white/10";

  const waveTitle = wave.number === 0 ? "Pipeline de Conception" : `Wave ${wave.number}`;

  return (
    <div className="space-y-2">
      {/* Wave header */}
      <button
        className="w-full flex items-center justify-between group py-1"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-3">
          {/* Icon */}
          <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/40 group-hover:text-white/70 transition-colors">
            {wave.allCompleted ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <Layers className="w-4 h-4" />
            )}
          </div>

          {/* Title */}
          <div className="text-left">
            <p className="text-sm font-bold text-white/90 group-hover:text-white transition-colors">
              {waveTitle}
            </p>
            <p className="text-xs text-white/40">{total} tâche{total > 1 ? "s" : ""}</p>
          </div>

          {/* Status badge */}
          <span
            className={[
              "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold border",
              waveAccent,
            ].join(" ")}
          >
            {wave.allCompleted && <CheckCircle2 className="w-2.5 h-2.5" />}
            {waveLabel}
          </span>
        </div>

        {/* Progress + chevron */}
        <div className="flex items-center gap-3">
          {/* Mini progress bar */}
          <div className="hidden sm:block w-24 h-1.5 rounded-full bg-white/6 overflow-hidden">
            <motion.div
              className={[
                "h-full rounded-full",
                wave.allCompleted
                  ? "bg-emerald-500"
                  : "bg-linear-to-r from-violet-500 to-indigo-500",
              ].join(" ")}
              initial={{ width: 0 }}
              animate={{
                width: `${total > 0 ? (completedCount / total) * 100 : 0}%`,
              }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            />
          </div>

          {open ? (
            <ChevronDown className="w-4 h-4 text-white/30 group-hover:text-white/60 transition-colors" />
          ) : (
            <ChevronRight className="w-4 h-4 text-white/30 group-hover:text-white/60 transition-colors" />
          )}
        </div>
      </button>

      {/* Task grid */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="tasks"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pl-4 border-l border-white/6 ml-4 pb-2">
              {wave.tasks.map((task, i) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  index={i}
                  isExecuting={executingId === task.id}
                  executionLocked={executionLocked}
                  onReview={onReview}
                  onExecute={onExecute}
                  onRetry={onRetry}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
