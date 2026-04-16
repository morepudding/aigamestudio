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
  decisionsReady?: boolean;
}

export default function PipelineView({ projectId, phase, decisionsReady = true }: PipelineViewProps) {
  // Dev phase has its own dedicated view
  if (phase === "in-dev") {
    return <DevPipelineView projectId={projectId} />;
  }

  return <ConceptPipelineView projectId={projectId} phase={phase} decisionsReady={decisionsReady} />;
}

function ConceptPipelineView({ projectId, phase, decisionsReady = true }: PipelineViewProps) {
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

  const phaseLabel: Record<ProjectPhase, string> = {
    concept: "Pipeline de Conception",
    "in-dev": "Pipeline de Développement",
    released: "Pipeline Post-Launch",
  };

  const conceptLocked = phase === "concept" && !decisionsReady;

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
          <p className="text-sm text-white/40 font-medium">
            {conceptLocked ? "Pipeline verrouillé" : "Pipeline non encore généré"}
          </p>
          <p className="text-xs text-white/25">
            {conceptLocked
              ? "Le cadrage avec Eve doit être validé avant de lancer la rédaction des 5 documents."
              : "Le Producer va analyser le projet et créer les tâches automatiquement."}
          </p>
        </div>
        {conceptLocked ? (
          <Link
            href={`/projects/${projectId}/decisions`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-500/15 border border-indigo-500/25 text-indigo-300 text-sm font-semibold hover:bg-indigo-500/25 transition-colors"
          >
            <Zap className="w-4 h-4" />
            Ouvrir le cadrage Eve
          </Link>
        ) : (
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
        )}
      </div>
    );
  }

  return (
    <>
      <div className="rounded-2xl border border-white/8 bg-white/2 backdrop-blur-md p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white/90">{phaseLabel[phase]}</h3>
          <button
            onClick={load}
            className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-white/5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Actualiser
          </button>
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
                executionLocked={conceptLocked}
                onReview={setReviewTask}
                onExecute={executingId || conceptLocked ? undefined : handleExecute}
                onRetry={executingId || conceptLocked ? undefined : handleRetry}
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
