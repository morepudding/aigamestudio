import { supabase } from "@/lib/supabase/client";

export interface AgentSkillPrompt {
  id: string;
  agent_slug: string;
  project_id: string;
  version: number;
  content: string;
  status: "draft" | "active" | "archived";
  created_at: string;
  updated_at: string;
}

/**
 * Crée un nouveau prompt compétence en statut draft.
 * Le trigger Supabase archive automatiquement l'ancien actif à l'activation.
 */
export async function createSkillPromptDraft(
  agentSlug: string,
  projectId: string,
  content: string
): Promise<AgentSkillPrompt> {
  // Calculer la prochaine version pour cet agent
  const { count } = await supabase
    .from("agent_skill_prompts")
    .select("*", { count: "exact", head: true })
    .eq("agent_slug", agentSlug);

  const version = (count ?? 0) + 1;

  const { data, error } = await supabase
    .from("agent_skill_prompts")
    .insert({ agent_slug: agentSlug, project_id: projectId, content, version, status: "draft" })
    .select()
    .single();

  if (error || !data) throw new Error(error?.message ?? "Failed to create skill prompt draft");
  return data as AgentSkillPrompt;
}

/**
 * Active un prompt draft (archive l'ancien actif via trigger Supabase).
 */
export async function activateSkillPrompt(promptId: string): Promise<AgentSkillPrompt> {
  const { data, error } = await supabase
    .from("agent_skill_prompts")
    .update({ status: "active" })
    .eq("id", promptId)
    .select()
    .single();

  if (error || !data) throw new Error(error?.message ?? "Failed to activate skill prompt");
  return data as AgentSkillPrompt;
}

/**
 * Met à jour le contenu d'un prompt draft (édition manuelle avant validation).
 */
export async function updateSkillPromptContent(
  promptId: string,
  content: string
): Promise<AgentSkillPrompt> {
  const { data, error } = await supabase
    .from("agent_skill_prompts")
    .update({ content })
    .eq("id", promptId)
    .eq("status", "draft") // on ne modifie que les drafts
    .select()
    .single();

  if (error || !data) throw new Error(error?.message ?? "Failed to update skill prompt");
  return data as AgentSkillPrompt;
}

/**
 * Récupère le prompt compétence actif d'un agent.
 * Retourne null si aucun prompt n'a encore été activé.
 */
export async function getActiveSkillPrompt(agentSlug: string): Promise<AgentSkillPrompt | null> {
  const { data, error } = await supabase
    .from("agent_skill_prompts")
    .select("*")
    .eq("agent_slug", agentSlug)
    .eq("status", "active")
    .single();

  if (error || !data) return null;
  return data as AgentSkillPrompt;
}

/**
 * Récupère tous les prompts d'un agent (toutes versions, tous statuts).
 */
export async function getAllSkillPrompts(agentSlug: string): Promise<AgentSkillPrompt[]> {
  const { data, error } = await supabase
    .from("agent_skill_prompts")
    .select("*")
    .eq("agent_slug", agentSlug)
    .order("version", { ascending: false });

  if (error || !data) return [];
  return data as AgentSkillPrompt[];
}

/**
 * Récupère le dernier draft d'un agent pour un projet donné.
 */
export async function getLatestDraft(
  agentSlug: string,
  projectId: string
): Promise<AgentSkillPrompt | null> {
  const { data, error } = await supabase
    .from("agent_skill_prompts")
    .select("*")
    .eq("agent_slug", agentSlug)
    .eq("project_id", projectId)
    .eq("status", "draft")
    .order("version", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;
  return data as AgentSkillPrompt;
}
