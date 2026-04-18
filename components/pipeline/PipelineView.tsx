"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Zap, RefreshCw, Loader2 } from "lucide-react";
import {
  getTasksByWave,
  getPipelineProgress,
} from "@/lib/services/pipelineService";
import type { Wave, Pipeline, PipelineTask, ProjectPhase } from "@/lib/types/task";
import ProgressBar from "./ProgressBar";
import WaveGroup from "./WaveGroup";
import TaskReview from "./TaskReview";
import DevPipelineView from "./DevPipelineView";

interface PipelineViewProps {
  projectId: string;
  phase: ProjectPhase;
}

export default function PipelineView({ projectId, phase }: PipelineViewProps) {
  // Dev phase has its own dedicated view
  if (phase === "in-dev") {
    return <DevPipelineView projectId={projectId} />;
  }

  return <ConceptPipelineView projectId={projectId} phase={phase} />;
}

function ConceptPipelineView({ projectId, phase }: PipelineViewProps) {
  const [waves, setWaves] = useState<Wave[]>([]);
  const [progress, setProgress] = useState<Pipeline["progress"]>({
    total: 0,
    completed: 0,
    inProgress: 0,
    failed: 0,
    percentage: 0,
  });
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [runningAll, setRunningAll] = useState(false);
  const [reviewTask, setReviewTask] = useState<PipelineTask | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Advance pipeline first so any stuck "created" tasks get promoted to "ready"
      await fetch(`/api/pipeline/${projectId}/advance`, { method: "POST" });
      const [wavesData, progressData] = await Promise.all([
        getTasksByWave(projectId, phase),
        getPipelineProgress(projectId, phase),
      ]);
      setWaves(wavesData);
      setProgress(progressData);
    } finally {
      setLoading(false);
    }
  }, [projectId, phase]);

  useEffect(() => {
    load();
  }, [load]);

  const handleReviewClose = () => {
    setReviewTask(null);
    load(); // refresh after action
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await fetch(`/api/pipeline/${projectId}/generate`, { method: "POST" });
      await load();
    } finally {
      setGenerating(false);
    }
  };

  const handleExecute = async (task: PipelineTask) => {
    setExecutingId(task.id);
    try {
      await fetch(`/api/pipeline/task/${task.id}/execute`, { method: "POST" });
      await load();
    } finally {
      setExecutingId(null);
    }
  };

  const handleRetry = async (task: PipelineTask) => {
    setExecutingId(task.id);
    try {
      await fetch(`/api/pipeline/task/${task.id}/retry`, { method: "POST" });
      await load();
    } finally {
      setExecutingId(null);
    }
  };

  const handleRunAll = async () => {
    setRunningAll(true);
    try {
      let hasMore = true;
      while (hasMore) {
        await fetch(`/api/pipeline/${projectId}/advance`, { method: "POST" });
        const wavesData = await getTasksByWave(projectId, phase);
        setWaves(wavesData);

        const allTasks = wavesData.flatMap((w) => w.tasks);
        const readyTasks = allTasks.filter((t) => t.status === "ready");
        const reviewTasks = allTasks.filter((t) => t.status === "review");

        // Auto-approve tasks waiting for review
        if (reviewTasks.length > 0) {
          for (const task of reviewTasks) {
            setExecutingId(task.id);
            await fetch(`/api/pipeline/task/${task.id}/approve`, { method: "POST" });
            setExecutingId(null);
          }
          continue; // re-loop to advance and pick up newly unlocked tasks
        }

        if (readyTasks.length === 0) {
          hasMore = false;
          break;
        }

        for (const task of readyTasks) {
          setExecutingId(task.id);
          await fetch(`/api/pipeline/task/${task.id}/execute`, { method: "POST" });
          setExecutingId(null);
        }
      }
    } finally {
      setRunningAll(false);
      setExecutingId(null);
      await load();
    }
  };

  const phaseLabel: Record<ProjectPhase, string> = {
    concept: "Pipeline de Conception",
    "in-dev": "Pipeline de Développement",
    released: "Pipeline Post-Launch",
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/8 bg-white/2 backdrop-blur-md p-6 space-y-4 animate-pulse">
        <div className="h-5 w-48 bg-white/10 rounded-lg" />
        <div className="h-3 w-full bg-white/6 rounded-full" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-white/4" />
          ))}
        </div>
      </div>
    );
  }

  if (waves.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center space-y-4">
        <Zap className="w-8 h-8 text-white/20 mx-auto" />
        <div className="space-y-1">
          <p className="text-sm text-white/40 font-medium">Pipeline non encore généré</p>
          <p className="text-xs text-white/25">
            Le Producer va analyser le projet et créer les tâches automatiquement.
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
            {generating ? "Génération en cours…" : "Générer le pipeline"}
          </button>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-2xl border border-white/8 bg-white/2 backdrop-blur-md p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white/90">{phaseLabel[phase]}</h3>
          <div className="flex items-center gap-2">
            <button
                onClick={handleRunAll}
                disabled={runningAll || !!executingId}
                className="flex items-center gap-1.5 text-xs text-violet-300 hover:text-violet-200 transition-colors px-2.5 py-1.5 rounded-lg bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {runningAll ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Zap className="w-3.5 h-3.5" />
                )}
                {runningAll ? "En cours…" : "Lancer tout"}
              </button>
            <button
              onClick={load}
              disabled={runningAll}
              className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Actualiser
            </button>
          </div>
        </div>

        {/* Progress bar */}
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
          {waves.map((wave, i) => (
            <div key={wave.number} className={i > 0 ? "pt-6" : ""}>
              <WaveGroup
                wave={wave}
                defaultOpen={!wave.allCompleted}
                executingId={executingId}
                executionLocked={false}
                onReview={setReviewTask}
                onExecute={executingId || runningAll ? undefined : handleExecute}
                onRetry={executingId || runningAll ? undefined : handleRetry}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Task Review slide-over */}
      <TaskReview
        task={reviewTask}
        onClose={handleReviewClose}
      />
    </>
  );
}
