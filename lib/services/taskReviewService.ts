import { supabase } from "@/lib/supabase/client";

export interface TaskReview {
  id: string;
  task_id: string;
  project_id: string;
  agent_slug: string;
  rating: number; // 1–5
  comment: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskReviewWithTask extends TaskReview {
  task_title: string;
  task_description: string | null;
}

/**
 * Upsert une review pour une tâche (une seule par tâche).
 */
export async function upsertTaskReview(
  review: Pick<TaskReview, "task_id" | "project_id" | "agent_slug" | "rating" | "comment">
): Promise<TaskReview> {
  const { data, error } = await supabase
    .from("task_reviews")
    .upsert(review, { onConflict: "task_id" })
    .select()
    .single();

  if (error || !data) throw new Error(error?.message ?? "Failed to upsert task review");
  return data as TaskReview;
}

/**
 * Récupère toutes les reviews d'un projet.
 */
export async function getReviewsByProject(projectId: string): Promise<TaskReview[]> {
  const { data, error } = await supabase
    .from("task_reviews")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  if (error || !data) return [];
  return data as TaskReview[];
}

/**
 * Récupère toutes les reviews d'un agent (tous projets confondus).
 */
export async function getReviewsByAgent(agentSlug: string): Promise<TaskReview[]> {
  const { data, error } = await supabase
    .from("task_reviews")
    .select("*")
    .eq("agent_slug", agentSlug)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data as TaskReview[];
}

/**
 * Récupère la review d'une tâche précise.
 */
export async function getReviewByTask(taskId: string): Promise<TaskReview | null> {
  const { data, error } = await supabase
    .from("task_reviews")
    .select("*")
    .eq("task_id", taskId)
    .single();

  if (error || !data) return null;
  return data as TaskReview;
}
