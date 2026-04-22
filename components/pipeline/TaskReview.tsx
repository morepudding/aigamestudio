"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  X,
  CheckCircle2,
  XCircle,
  FileText,
  Code2,
  FileJson,
  Settings2,
  GitBranch,
  Loader2,
  ChevronRight,
  User2,
  MessageSquarePlus,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { PipelineTask } from "@/lib/types/task";
import { normalizeMarkdownDeliverable, unwrapCodeFence } from "@/lib/utils";

interface TaskReviewProps {
  task: PipelineTask | null;
  onClose: () => void;
}

const DELIVERABLE_ICONS: Record<PipelineTask["deliverableType"], React.ReactNode> = {
  markdown: <FileText className="w-4 h-4 shrink-0" />,
  code: <Code2 className="w-4 h-4 shrink-0" />,
  json: <FileJson className="w-4 h-4 shrink-0" />,
  config: <Settings2 className="w-4 h-4 shrink-0" />,
  "repo-init": <GitBranch className="w-4 h-4 shrink-0" />,
};

export default function TaskReview({ task, onClose }: TaskReviewProps) {
  const [feedback, setFeedback] = useState("");
  const [showFeedback, setShowFeedback] = useState(false);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const getErrorMessage = (err: unknown, fallback: string) =>
    err instanceof Error ? err.message : fallback;

  const handleApprove = async () => {
    if (!task) return;
    setApproving(true);
    try {
      const res = await fetch(`/api/pipeline/task/${task.id}/approve`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Approval failed");
      }
      onClose();
    } catch (err) {
      console.error("Approval error:", err);
      // Show error to user (could integrate with a toast system)
      alert(`Failed to approve task: ${getErrorMessage(err, "Approval failed")}`);
    } finally {
      setApproving(false);
    }
  };

  const handleDeleteDeliverable = async () => {
    if (!task) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/pipeline/task/${task.id}/deliverable`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Delete failed");
      }
      setConfirmDelete(false);
      onClose();
    } catch (err) {
      console.error("Delete error:", err);
      alert(`Failed to delete deliverable: ${getErrorMessage(err, "Delete failed")}`);
    } finally {
      setDeleting(false);
    }
  };

  const handleReject = async () => {
    if (!task) return;
    setRejecting(true);
    try {
      const res = await fetch(`/api/pipeline/task/${task.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedback }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Rejection failed");
      }
      setFeedback("");
      setShowFeedback(false);
      onClose();
    } catch (err) {
      console.error("Rejection error:", err);
      alert(`Failed to reject task: ${getErrorMessage(err, "Rejection failed")}`);
    } finally {
      setRejecting(false);
    }
  };

  const isCompleted = task?.status === "completed";

  // Derive a readable path from deliverablePath or fallback
  const filePath = task?.deliverablePath ?? task?.deliverableType ?? "";
  const pathParts = filePath.split("/").filter(Boolean);
  const isMarkdownDeliverable =
    task?.deliverableType === "markdown" || task?.deliverablePath?.endsWith(".md");
  const deliverableContent = task?.deliverableContent
    ? isMarkdownDeliverable
      ? normalizeMarkdownDeliverable(task.deliverableContent)
      : unwrapCodeFence(task.deliverableContent)
    : null;

  return (
    <AnimatePresence>
      {task && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Full-screen modal */}
          <motion.div
            key="modal"
            className="fixed inset-0 sm:inset-4 z-50 flex flex-col bg-[#0d0d12] sm:rounded-2xl border-0 sm:border border-white/10 shadow-2xl overflow-hidden"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 300, damping: 28, mass: 0.8 }}
          >
            {/* ── Top bar ── */}
            <div className="flex items-center justify-between gap-3 px-4 sm:px-8 py-3 sm:py-4 border-b border-white/8 shrink-0">
              {/* Left – status + breadcrumb + title */}
              <div className="flex items-center gap-4 min-w-0">
                {/* Badge */}
                {isCompleted ? (
                  <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                    <CheckCircle2 className="w-3 h-3" />
                    Terminée
                  </span>
                ) : (
                  <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-orange-500/30 bg-orange-500/10 px-2.5 py-0.5 text-xs font-semibold text-orange-400 uppercase tracking-wider">
                    En review
                  </span>
                )}

                {/* Breadcrumb path */}
                {pathParts.length > 0 && (
                  <nav className="hidden sm:flex items-center gap-1 text-xs font-mono text-white/35">
                    {pathParts.map((part, i) => (
                      <span key={i} className="flex items-center gap-1">
                        {i > 0 && <ChevronRight className="w-3 h-3 text-white/20" />}
                        <span className={i === pathParts.length - 1 ? "text-white/60" : ""}>
                          {part}
                        </span>
                      </span>
                    ))}
                  </nav>
                )}

                {/* Title */}
                <h2 className="text-xs sm:text-sm font-semibold text-white/80 truncate">
                  {task.title}
                </h2>
              </div>

              {/* Right – deliverable type + agent + close */}
              <div className="flex items-center gap-4 shrink-0">
                {/* Deliverable type pill */}
                <span className="hidden md:flex items-center gap-1.5 text-xs font-mono text-white/40 bg-white/4 rounded-lg px-2.5 py-1">
                  {DELIVERABLE_ICONS[task.deliverableType]}
                  {task.deliverableType}
                </span>

                {/* Agent */}
                {task.assignedAgentSlug && (
                  <span className="hidden md:flex items-center gap-1.5 text-xs text-white/40">
                    <User2 className="w-3.5 h-3.5" />
                    {task.assignedAgentSlug}
                  </span>
                )}

                {/* Close */}
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg text-white/35 hover:text-white/80 hover:bg-white/6 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* ── Scrollable document content ── */}
            <div className="flex-1 overflow-y-auto">
              <div className="max-w-4xl mx-auto px-4 sm:px-8 py-6 sm:py-10">
                {deliverableContent ? (
                  (isMarkdownDeliverable || !["code", "json", "config", "repo-init"].includes(task.deliverableType ?? "")) ? (
                    <div className="prose prose-invert prose-base max-w-none
                      prose-headings:font-bold prose-headings:text-white/90
                      prose-h1:text-2xl prose-h1:mb-6
                      prose-h2:text-xl prose-h2:mt-10 prose-h2:mb-4
                      prose-h3:text-base prose-h3:mt-8
                      prose-p:text-white/65 prose-p:leading-7
                      prose-li:text-white/65
                      prose-strong:text-white/85
                      prose-code:text-orange-300 prose-code:bg-white/6 prose-code:rounded prose-code:px-1 prose-code:py-0.5
                      prose-pre:bg-white/4 prose-pre:border prose-pre:border-white/8 prose-pre:rounded-xl
                      prose-blockquote:border-l-orange-500/50 prose-blockquote:text-white/50
                      prose-hr:border-white/8
                      prose-a:text-orange-400 prose-a:no-underline hover:prose-a:underline
                      prose-table:text-sm prose-thead:border-white/10 prose-tr:border-white/6">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {deliverableContent}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <pre className="text-sm font-mono text-white/70 bg-white/4 rounded-xl p-6 overflow-x-auto leading-relaxed whitespace-pre-wrap border border-white/8">
                      {deliverableContent}
                    </pre>
                  )
                ) : (
                  <div className="flex flex-col items-center justify-center h-64 gap-3 text-white/25">
                    <FileText className="w-10 h-10" />
                    <span className="text-sm">Aucun contenu disponible</span>
                  </div>
                )}
              </div>
            </div>

            {/* ── Sticky action bar ── */}
            {isCompleted ? (
              <div className="shrink-0 border-t border-white/8 bg-[#0d0d12] flex items-center justify-end px-4 sm:px-8 py-3 sm:py-4">
                <button
                  onClick={onClose}
                  className="flex items-center gap-2 rounded-xl border border-white/12 bg-white/4 px-5 py-2.5 text-sm font-semibold text-white/60 hover:bg-white/8 hover:text-white/80 transition-colors"
                >
                  <X className="w-4 h-4" />
                  Fermer
                </button>
              </div>
            ) : (
            <div className="shrink-0 border-t border-white/8 bg-[#0d0d12]">
              <AnimatePresence>
                {showFeedback && (
                  <motion.div
                    key="feedback"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden px-4 sm:px-8 pt-3 sm:pt-4"
                  >
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-white/45">
                      Feedback pour l&apos;agent
                      </label>
                      <textarea
                        value={feedback}
                        onChange={(e) => setFeedback(e.target.value)}
                        placeholder="Ex : Ajoute plus de détails sur le système de combat, développe la section économie..."
                        rows={3}
                        autoFocus
                        className="w-full rounded-xl bg-white/4 border border-white/10 px-4 py-3 text-sm text-white/80 placeholder:text-white/25 resize-none focus:outline-none focus:ring-1 focus:ring-orange-500/40 transition-colors"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 sm:px-8 py-3 sm:py-4">
                {/* Left – actions */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Delete deliverable */}
                {!confirmDelete ? (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    disabled={approving || rejecting || deleting}
                    className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/4 px-3 py-2.5 text-sm font-semibold text-white/40 hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="hidden sm:inline">Supprimer le livrable</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-red-400/80">Supprimer définitivement ?</span>
                    <button
                      onClick={handleDeleteDeliverable}
                      disabled={deleting}
                      className="flex items-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-40"
                    >
                      {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                      Confirmer
                    </button>
                    <button
                      onClick={() => setConfirmDelete(false)}
                      disabled={deleting}
                      className="rounded-xl border border-white/10 bg-white/4 px-3 py-2 text-xs text-white/50 hover:text-white/80 transition-colors"
                    >
                      Annuler
                    </button>
                  </div>
                )}

                {/* Feedback toggle */}
                <button
                  onClick={() => setShowFeedback((v) => !v)}
                  disabled={approving || rejecting || deleting}
                  className={`flex items-center gap-2 rounded-xl border px-3 sm:px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                    showFeedback
                      ? "border-orange-500/35 bg-orange-500/12 text-orange-400 hover:bg-orange-500/20"
                      : "border-white/12 bg-white/4 text-white/60 hover:bg-white/8 hover:text-white/80"
                  }`}
                >
                  <MessageSquarePlus className="w-4 h-4" />
                  <span className="hidden sm:inline">Feedback</span>
                </button>
              </div>

                {/* Right – Submit actions */}
                <div className="flex items-center gap-2 sm:gap-3 ml-auto">
                  {showFeedback && (
                    <button
                      onClick={handleReject}
                      disabled={rejecting || approving || !feedback.trim()}
                      className="flex items-center gap-2 rounded-xl border border-red-500/25 bg-red-500/10 px-3 sm:px-5 py-2.5 text-sm font-semibold text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {rejecting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <XCircle className="w-4 h-4" />
                      )}
                      <span className="hidden sm:inline">Envoyer pour modification</span>
                      <span className="sm:hidden">Rejeter</span>
                    </button>
                  )}

                  <button
                    onClick={handleApprove}
                    disabled={approving || rejecting}
                    className="flex items-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 px-4 sm:px-6 py-2.5 text-sm font-bold text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/20"
                  >
                    {approving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    Approuver
                  </button>
                </div>
              </div>
            </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
