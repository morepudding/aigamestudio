"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Star,
  Loader2,
  Sparkles,
  Check,
  ChevronDown,
  ChevronUp,
  User,
  AlertCircle,
} from "lucide-react";
import type { TaskReview } from "@/lib/services/taskReviewService";
import type { AgentSkillPrompt } from "@/lib/services/agentSkillPromptService";

interface PipelineTaskSummary {
  id: string;
  title: string;
  description: string | null;
  assigned_agent_slug: string | null;
  agent_name?: string;
  agent_department?: string;
}

interface AgentGroup {
  slug: string;
  name: string;
  department: string;
  tasks: PipelineTaskSummary[];
  reviews: Record<string, TaskReview>; // taskId → review
  skillPromptDraft: AgentSkillPrompt | null;
  activeSkillPrompt: AgentSkillPrompt | null;
}

interface PostMortemViewProps {
  projectId: string;
  projectTitle: string;
}

function StarRating({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <button
          key={s}
          type="button"
          disabled={disabled}
          onClick={() => onChange(s)}
          onMouseEnter={() => setHovered(s)}
          onMouseLeave={() => setHovered(0)}
          className="disabled:cursor-not-allowed"
        >
          <Star
            className={`w-5 h-5 transition-colors ${
              s <= (hovered || value)
                ? "fill-amber-400 text-amber-400"
                : "text-white/20"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

export default function PostMortemView({ projectId, projectTitle }: PostMortemViewProps) {
  const [groups, setGroups] = useState<AgentGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const [savingTask, setSavingTask] = useState<string | null>(null);
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);
  const [activatingFor, setActivatingFor] = useState<string | null>(null);
  const [editingPrompt, setEditingPrompt] = useState<Record<string, string>>({});
  const [savingPrompt, setSavingPrompt] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Charger tâches + reviews en parallèle
      const [tasksRes, reviewsRes] = await Promise.all([
        fetch(`/api/pipeline/${projectId}/tasks-summary`),
        fetch(`/api/post-mortem/${projectId}/reviews`),
      ]);

      if (!tasksRes.ok || !reviewsRes.ok) return;

      const tasks: PipelineTaskSummary[] = await tasksRes.json();
      const reviews: TaskReview[] = await reviewsRes.json();

      // Grouper par agent
      const agentMap = new Map<string, AgentGroup>();
      for (const task of tasks) {
        if (!task.assigned_agent_slug) continue;
        const slug = task.assigned_agent_slug;
        if (!agentMap.has(slug)) {
          agentMap.set(slug, {
            slug,
            name: task.agent_name ?? slug,
            department: task.agent_department ?? "",
            tasks: [],
            reviews: {},
            skillPromptDraft: null,
            activeSkillPrompt: null,
          });
        }
        agentMap.get(slug)!.tasks.push(task);
      }

      // Injecter les reviews
      for (const review of reviews) {
        const group = agentMap.get(review.agent_slug);
        if (group) group.reviews[review.task_id] = review;
      }

      // Charger les skill prompts pour chaque agent
      await Promise.all(
        Array.from(agentMap.values()).map(async (group) => {
          const res = await fetch(
            `/api/post-mortem/${projectId}/skill-prompts?agent_slug=${group.slug}`
          );
          if (!res.ok) return;
          const prompts: AgentSkillPrompt[] = await res.json();
          group.activeSkillPrompt = prompts.find((p) => p.status === "active") ?? null;
          group.skillPromptDraft =
            prompts.find((p) => p.status === "draft" && p.project_id === projectId) ?? null;
        })
      );

      const result = Array.from(agentMap.values()).filter((g) => g.tasks.length > 0);
      setGroups(result);

      // Auto-expand first agent
      if (result.length > 0 && !expandedAgent) {
        setExpandedAgent(result[0].slug);
      }
    } finally {
      setLoading(false);
    }
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSaveReview = async (
    taskId: string,
    agentSlug: string,
    rating: number,
    comment: string
  ) => {
    setSavingTask(taskId);
    try {
      await fetch(`/api/post-mortem/${projectId}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_id: taskId, agent_slug: agentSlug, rating, comment }),
      });
      setGroups((prev) =>
        prev.map((g) =>
          g.slug === agentSlug
            ? {
                ...g,
                reviews: {
                  ...g.reviews,
                  [taskId]: {
                    ...g.reviews[taskId],
                    task_id: taskId,
                    project_id: projectId,
                    agent_slug: agentSlug,
                    rating,
                    comment,
                    id: g.reviews[taskId]?.id ?? "",
                    created_at: g.reviews[taskId]?.created_at ?? new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  },
                },
              }
            : g
        )
      );
    } finally {
      setSavingTask(null);
    }
  };

  const handleGeneratePrompt = async (agentSlug: string) => {
    setGeneratingFor(agentSlug);
    try {
      const res = await fetch(`/api/post-mortem/${projectId}/generate-skill-prompt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent_slug: agentSlug }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error ?? "Génération échouée");
        return;
      }
      const { prompt } = await res.json();
      setGroups((prev) =>
        prev.map((g) =>
          g.slug === agentSlug ? { ...g, skillPromptDraft: prompt } : g
        )
      );
      setEditingPrompt((prev) => ({ ...prev, [agentSlug]: prompt.content }));
    } finally {
      setGeneratingFor(null);
    }
  };

  const handleSavePromptEdit = async (agentSlug: string, promptId: string) => {
    const content = editingPrompt[agentSlug];
    if (!content) return;
    setSavingPrompt(agentSlug);
    try {
      await fetch(`/api/post-mortem/${projectId}/skill-prompts`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt_id: promptId, action: "update-content", content }),
      });
      setGroups((prev) =>
        prev.map((g) =>
          g.slug === agentSlug && g.skillPromptDraft
            ? { ...g, skillPromptDraft: { ...g.skillPromptDraft, content } }
            : g
        )
      );
    } finally {
      setSavingPrompt(null);
    }
  };

  const handleActivatePrompt = async (agentSlug: string, promptId: string) => {
    setActivatingFor(agentSlug);
    try {
      const res = await fetch(`/api/post-mortem/${projectId}/skill-prompts`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt_id: promptId, action: "activate" }),
      });
      if (!res.ok) return;
      const activated: AgentSkillPrompt = await res.json();
      setGroups((prev) =>
        prev.map((g) =>
          g.slug === agentSlug
            ? { ...g, activeSkillPrompt: activated, skillPromptDraft: null }
            : g
        )
      );
    } finally {
      setActivatingFor(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Chargement du post-mortem…
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="bg-white/5 border border-dashed border-white/10 rounded-2xl p-8 text-center space-y-2">
        <AlertCircle className="w-8 h-8 text-muted-foreground/40 mx-auto" />
        <p className="text-sm text-muted-foreground">
          Aucune tâche assignée trouvée pour ce projet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
          <Star className="w-4 h-4 text-amber-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Post-Mortem</h2>
          <p className="text-xs text-muted-foreground">
            Note les tâches de chaque agent, puis génère son prompt compétence avec Eve.
          </p>
        </div>
      </div>

      {groups.map((group) => {
        const isExpanded = expandedAgent === group.slug;
        const reviewedCount = Object.keys(group.reviews).length;
        const totalCount = group.tasks.length;
        const allReviewed = reviewedCount === totalCount && totalCount > 0;

        return (
          <div
            key={group.slug}
            className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden"
          >
            {/* Agent header */}
            <button
              type="button"
              onClick={() => setExpandedAgent(isExpanded ? null : group.slug)}
              className="w-full flex items-center gap-3 p-4 hover:bg-white/5 transition-colors text-left"
            >
              <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                <User className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white text-sm">{group.name}</p>
                <p className="text-xs text-muted-foreground capitalize">
                  {group.department} · {reviewedCount}/{totalCount} tâches notées
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {group.activeSkillPrompt && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-medium">
                    Prompt v{group.activeSkillPrompt.version} actif
                  </span>
                )}
                {group.skillPromptDraft && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 font-medium">
                    Draft en attente
                  </span>
                )}
                {allReviewed && !group.skillPromptDraft && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/15 border border-violet-500/30 text-violet-400 font-medium">
                    Prêt pour Eve
                  </span>
                )}
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                )}
              </div>
            </button>

            {/* Expanded content */}
            {isExpanded && (
              <div className="border-t border-white/10 p-4 space-y-6">
                {/* Task reviews */}
                <div className="space-y-3">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground/60">
                    Évaluation des tâches
                  </p>
                  {group.tasks.map((task) => {
                    const review = group.reviews[task.id];
                    const [localRating, setLocalRating] = useState(review?.rating ?? 0);
                    const [localComment, setLocalComment] = useState(review?.comment ?? "");
                    const isSaving = savingTask === task.id;
                    const isDirty =
                      localRating !== (review?.rating ?? 0) ||
                      localComment !== (review?.comment ?? "");

                    return (
                      <div
                        key={task.id}
                        className="bg-white/5 rounded-xl p-4 space-y-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium text-white leading-snug">
                            {task.title}
                          </p>
                          {review && !isDirty && (
                            <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                          )}
                        </div>
                        <StarRating
                          value={localRating}
                          onChange={setLocalRating}
                          disabled={isSaving}
                        />
                        <textarea
                          value={localComment}
                          onChange={(e) => setLocalComment(e.target.value)}
                          placeholder="Commentaire optionnel — forces, faiblesses, points à améliorer…"
                          rows={2}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-muted-foreground placeholder:text-white/20 resize-none focus:outline-none focus:border-white/20"
                        />
                        {localRating > 0 && isDirty && (
                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={() =>
                              handleSaveReview(task.id, group.slug, localRating, localComment)
                            }
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/20 border border-primary/30 text-xs font-medium text-primary hover:bg-primary/30 transition-colors disabled:opacity-50"
                          >
                            {isSaving ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Check className="w-3 h-3" />
                            )}
                            Enregistrer
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Eve skill prompt section */}
                <div className="space-y-3 border-t border-white/10 pt-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs uppercase tracking-widest text-muted-foreground/60">
                      Prompt compétence
                    </p>
                    {group.activeSkillPrompt && (
                      <Link
                        href={`/collaborateur/${group.slug}`}
                        className="text-xs text-primary hover:underline"
                      >
                        Voir le profil →
                      </Link>
                    )}
                  </div>

                  {/* Draft en attente de validation */}
                  {group.skillPromptDraft && (
                    <div className="space-y-3 bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-amber-400" />
                        <p className="text-xs font-semibold text-amber-300">
                          Proposal Eve — v{group.skillPromptDraft.version} (draft)
                        </p>
                      </div>
                      <textarea
                        value={editingPrompt[group.slug] ?? group.skillPromptDraft.content}
                        onChange={(e) =>
                          setEditingPrompt((prev) => ({ ...prev, [group.slug]: e.target.value }))
                        }
                        rows={12}
                        className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2.5 text-xs text-muted-foreground font-mono resize-y focus:outline-none focus:border-white/20"
                      />
                      <div className="flex gap-2">
                        {editingPrompt[group.slug] !== group.skillPromptDraft.content && (
                          <button
                            type="button"
                            disabled={savingPrompt === group.slug}
                            onClick={() =>
                              handleSavePromptEdit(group.slug, group.skillPromptDraft!.id)
                            }
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 border border-white/10 text-xs font-medium text-white hover:bg-white/15 transition-colors disabled:opacity-50"
                          >
                            {savingPrompt === group.slug ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Check className="w-3 h-3" />
                            )}
                            Sauvegarder les modifications
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={activatingFor === group.slug}
                          onClick={() =>
                            handleActivatePrompt(group.slug, group.skillPromptDraft!.id)
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/30 transition-colors disabled:opacity-50"
                        >
                          {activatingFor === group.slug ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Check className="w-3 h-3" />
                          )}
                          Activer ce prompt
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Prompt actif existant (si pas de draft) */}
                  {group.activeSkillPrompt && !group.skillPromptDraft && (
                    <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-400" />
                        <p className="text-xs font-semibold text-emerald-300">
                          Prompt actif — v{group.activeSkillPrompt.version}
                        </p>
                      </div>
                      <pre className="text-[10px] text-muted-foreground/70 whitespace-pre-wrap font-mono leading-relaxed line-clamp-6">
                        {group.activeSkillPrompt.content}
                      </pre>
                    </div>
                  )}

                  {/* Bouton génération Eve */}
                  {!group.skillPromptDraft && (
                    <button
                      type="button"
                      disabled={generatingFor === group.slug || reviewedCount === 0}
                      onClick={() => handleGeneratePrompt(group.slug)}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-violet-500/15 border border-violet-500/30 text-sm font-medium text-violet-300 hover:bg-violet-500/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {generatingFor === group.slug ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Eve analyse…
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          {group.activeSkillPrompt
                            ? "Générer une nouvelle version"
                            : "Générer le prompt compétence avec Eve"}
                        </>
                      )}
                    </button>
                  )}

                  {reviewedCount === 0 && (
                    <p className="text-xs text-muted-foreground/50 text-center">
                      Note au moins une tâche pour déverrouiller la génération.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
