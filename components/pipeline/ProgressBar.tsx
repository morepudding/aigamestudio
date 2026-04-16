"use client";

import { motion } from "framer-motion";
import type { Wave } from "@/lib/types/task";

interface ProgressBarProps {
  percentage: number;
  total: number;
  completed: number;
  inProgress: number;
  failed: number;
  waves?: Wave[];
}

export default function ProgressBar({
  percentage,
  total,
  completed,
  inProgress,
  failed,
  waves = [],
}: ProgressBarProps) {
  const waveSegments = waves.map((wave) => {
    const waveTotal = wave.tasks.length;
    const waveCompleted = wave.tasks.filter((t) => t.status === "completed").length;
    const waveInProgress = wave.tasks.filter((t) => t.status === "in-progress").length;
    const waveReview = wave.tasks.filter((t) => t.status === "review").length;
    const waveWidth = total > 0 ? (waveTotal / total) * 100 : 0;
    const fillPct =
      waveTotal > 0
        ? ((waveCompleted + waveInProgress * 0.5 + waveReview * 0.8) / waveTotal) * 100
        : 0;
    return { wave, waveWidth, fillPct, waveCompleted, waveTotal };
  });

  return (
    <div className="space-y-3">
      {/* Stats row */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-4">
          <span className="text-white/40 text-xs">
            {completed}/{total} tâches
          </span>
          {inProgress > 0 && (
            <span className="flex items-center gap-1.5 text-xs text-violet-400">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
              {inProgress} en cours
            </span>
          )}
          {failed > 0 && (
            <span className="text-xs text-red-400">{failed} échoué{failed > 1 ? "s" : ""}</span>
          )}
        </div>
        <span className="text-2xl font-extrabold tabular-nums text-white">
          {percentage}%
        </span>
      </div>

      {/* Main bar */}
      <div className="relative h-3 w-full rounded-full bg-white/6 overflow-hidden">
        {waves.length > 0 ? (
          // Segmented bar by wave
          <div className="absolute inset-0 flex gap-px">
            {waveSegments.map(({ wave, waveWidth, fillPct }) => (
              <div
                key={wave.number}
                className="relative h-full rounded-sm overflow-hidden"
                style={{ width: `${waveWidth}%` }}
              >
                {/* Track */}
                <div className="absolute inset-0 bg-white/4" />
                {/* Fill */}
                <motion.div
                  className="absolute inset-y-0 left-0 rounded-sm"
                  style={{
                    background: wave.allCompleted
                      ? "linear-gradient(90deg, #22c55e, #16a34a)"
                      : "linear-gradient(90deg, #8b5cf6, #6366f1)",
                  }}
                  initial={{ width: 0 }}
                  animate={{ width: `${fillPct}%` }}
                  transition={{ duration: 0.8, ease: "easeOut", delay: wave.number * 0.1 }}
                />
              </div>
            ))}
          </div>
        ) : (
          // Simple bar
          <motion.div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{
              background: "linear-gradient(90deg, #8b5cf6, #6366f1, #22c55e)",
            }}
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
          />
        )}

        {/* Shimmer on active */}
        {inProgress > 0 && (
          <motion.div
            className="absolute inset-0 bg-linear-to-r from-transparent via-white/10 to-transparent"
            animate={{ x: ["-100%", "200%"] }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          />
        )}
      </div>

      {/* Wave labels */}
      {waves.length > 1 && (
        <div className="flex gap-px" style={{ marginTop: 4 }}>
          {waveSegments.map(({ wave, waveWidth, waveCompleted, waveTotal }) => (
            <div
              key={wave.number}
              className="text-[10px] text-white/30 text-center truncate"
              style={{ width: `${waveWidth}%` }}
            >
              W{wave.number} {waveCompleted}/{waveTotal}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
