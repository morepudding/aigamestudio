"use client";

import { useState } from "react";
import {
  Camera,
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
  AlertTriangle,
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import type { WaveReview } from "@/lib/services/waveReviewService";

interface WaveReviewPanelProps {
  projectId: string;
  waveNumber: number;
  review: WaveReview | null;
  onReviewCreated: (review: WaveReview) => void;
  onDecision: (review: WaveReview) => void;
}

export default function WaveReviewPanel({
  projectId,
  waveNumber,
  review,
  onReviewCreated,
  onDecision,
}: WaveReviewPanelProps) {
  const [generating, setGenerating] = useState(false);
  const [deciding, setDeciding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejectionPrompt, setRejectionPrompt] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);

  // ── Générer le checkpoint ───────────────────────────────────────────────────

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/pipeline/${projectId}/wave-review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ waveNumber }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Erreur lors de la génération du checkpoint");
      }
      onReviewCreated(data.review);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setGenerating(false);
    }
  }

  // ── Approuver ───────────────────────────────────────────────────────────────

  async function handleApprove() {
    setDeciding(true);
    setError(null);
    try {
      const res = await fetch(`/api/pipeline/${projectId}/wave-review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ waveNumber, action: "approve" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erreur");
      onDecision(data.review);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setDeciding(false);
    }
  }

  // ── Rejeter ─────────────────────────────────────────────────────────────────

  async function handleReject() {
    if (!rejectionPrompt.trim()) return;
    setDeciding(true);
    setError(null);
    try {
      const res = await fetch(`/api/pipeline/${projectId}/wave-review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ waveNumber, action: "reject", rejectionPrompt: rejectionPrompt.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erreur");
      setShowRejectForm(false);
      setRejectionPrompt("");
      onDecision(data.review);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setDeciding(false);
    }
  }

  // ── Cas : pas encore de review ──────────────────────────────────────────────

  if (!review) {
    return (
      <div className="my-4 rounded-2xl border border-dashed border-amber-500/25 bg-amber-500/4 p-5 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center">
            <Camera className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-amber-300">Checkpoint Wave {waveNumber}</p>
            <p className="text-xs text-amber-300/60">
              Génère un screenshot + rapport avant de déverrouiller la wave suivante
            </p>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-red-500/25 bg-red-500/8 px-3 py-2 text-xs text-red-300">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        <button
          onClick={handleGenerate}
          disabled={generating}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/15 border border-amber-500/25 text-amber-300 text-sm font-semibold hover:bg-amber-500/25 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
          {generating ? "Déploiement & screenshot en cours…" : "Lancer le checkpoint"}
        </button>
      </div>
    );
  }

  // ── Cas : review existante ──────────────────────────────────────────────────

  const isApproved = review.status === "approved";
  const isRejected = review.status === "rejected";
  const isPending = review.status === "pending";

  const borderClass = isApproved
    ? "border-emerald-500/25 bg-emerald-500/4"
    : isRejected
    ? "border-red-500/25 bg-red-500/4"
    : "border-amber-500/25 bg-amber-500/4";

  const headerIcon = isApproved ? (
    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
  ) : isRejected ? (
    <XCircle className="w-4 h-4 text-red-400" />
  ) : (
    <Camera className="w-4 h-4 text-amber-400" />
  );

  const headerColor = isApproved
    ? "text-emerald-300"
    : isRejected
    ? "text-red-300"
    : "text-amber-300";

  const headerBg = isApproved
    ? "bg-emerald-500/15"
    : isRejected
    ? "bg-red-500/15"
    : "bg-amber-500/15";

  const statusLabel = isApproved ? "Approuvée" : isRejected ? "Rejetée" : "En attente de décision";

  return (
    <div className={`my-4 rounded-2xl border p-5 space-y-4 ${borderClass}`}>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${headerBg}`}>
            {headerIcon}
          </div>
          <div>
            <p className={`text-sm font-bold ${headerColor}`}>
              Checkpoint Wave {waveNumber} — {statusLabel}
            </p>
            {review.pagesUrl && (
              <a
                href={review.pagesUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-white/40 hover:text-white/70 flex items-center gap-1 transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                {review.pagesUrl}
              </a>
            )}
          </div>
        </div>

        {/* Regénérer si pending sans screenshot */}
        {isPending && !review.screenshotUrl && (
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white/40 hover:text-white/70 hover:bg-white/6 transition-colors disabled:opacity-30"
          >
            {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Relancer
          </button>
        )}
      </div>

      {/* Screenshot */}
      {review.screenshotUrl && (
        <div className="rounded-xl overflow-hidden border border-white/8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={review.screenshotUrl}
            alt={`Screenshot wave ${waveNumber}`}
            className="w-full object-cover max-h-80"
          />
        </div>
      )}

      {/* Rapport */}
      {review.reportMarkdown && (
        <div className="rounded-xl border border-white/8 bg-white/2 p-4">
          <pre className="text-xs text-white/60 whitespace-pre-wrap leading-relaxed font-mono">
            {review.reportMarkdown}
          </pre>
        </div>
      )}

      {/* Prompt de rejet affiché si rejeté */}
      {isRejected && review.rejectionPrompt && (
        <div className="rounded-xl border border-red-500/15 bg-red-500/5 p-3">
          <p className="text-xs text-red-400/70 font-medium mb-1">Corrections demandées :</p>
          <p className="text-xs text-red-300/80 whitespace-pre-wrap">{review.rejectionPrompt}</p>
        </div>
      )}

      {/* Erreur */}
      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-500/25 bg-red-500/8 px-3 py-2 text-xs text-red-300">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {/* Actions — uniquement si pending */}
      {isPending && review.screenshotUrl && (
        <div className="space-y-3">
          {/* Formulaire de rejet */}
          {showRejectForm && (
            <div className="space-y-2">
              <textarea
                value={rejectionPrompt}
                onChange={(e) => setRejectionPrompt(e.target.value)}
                placeholder="Décris ce qui ne va pas et ce que tu veux corriger dans la prochaine wave…"
                rows={3}
                className="w-full rounded-xl border border-red-500/25 bg-red-500/5 text-sm text-white/80 placeholder-white/25 px-4 py-3 resize-none focus:outline-none focus:border-red-500/50 transition-colors"
              />
              <div className="flex items-center gap-2 justify-end">
                <button
                  onClick={() => { setShowRejectForm(false); setRejectionPrompt(""); }}
                  className="px-3 py-1.5 rounded-lg text-xs text-white/40 hover:text-white/70 hover:bg-white/6 transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={handleReject}
                  disabled={deciding || !rejectionPrompt.trim()}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-red-500/15 border border-red-500/25 text-red-300 hover:bg-red-500/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {deciding ? <Loader2 className="w-3 h-3 animate-spin" /> : <ThumbsDown className="w-3 h-3" />}
                  Confirmer le rejet
                </button>
              </div>
            </div>
          )}

          {/* Boutons principaux */}
          {!showRejectForm && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleApprove}
                disabled={deciding}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 text-sm font-semibold hover:bg-emerald-500/25 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deciding ? <Loader2 className="w-4 h-4 animate-spin" /> : <ThumbsUp className="w-4 h-4" />}
                Approuver — Déverrouiller la suite
              </button>
              <button
                onClick={() => setShowRejectForm(true)}
                disabled={deciding}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-semibold hover:bg-red-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ThumbsDown className="w-4 h-4" />
                Rejeter
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
