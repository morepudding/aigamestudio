import { supabase } from "@/lib/supabase/client";

export interface AgentTask {
  task_name: string;
  description: string;
  expected_output: string;
}

export type AgentMood =
  | "neutre"
  | "enthousiaste"
  | "frustré"
  | "curieux"
  | "fier"
  | "inquiet"
  | "joueur"
  | "nostalgique"
  | "inspiré"
  | "agacé";

export const MOOD_LABELS: Record<AgentMood, { emoji: string; label: string }> = {
  neutre: { emoji: "😐", label: "Neutre" },
  enthousiaste: { emoji: "🤩", label: "Enthousiaste" },
  "frustré": { emoji: "😤", label: "Frustré" },
  curieux: { emoji: "🤔", label: "Curieux" },
  fier: { emoji: "😎", label: "Fier" },
  inquiet: { emoji: "😟", label: "Inquiet" },
  joueur: { emoji: "😏", label: "Joueur" },
  nostalgique: { emoji: "🥹", label: "Nostalgique" },
  "inspiré": { emoji: "✨", label: "Inspiré" },
  "agacé": { emoji: "😒", label: "Agacé" },
};

/** Confidence level thresholds for unlocking behaviors */
export const CONFIDENCE_THRESHOLDS = {
  NICKNAME: 15,       // Agent starts using a nickname
  CALLBACKS: 25,      // Agent references past moments
  JOKES: 40,          // Agent makes personal jokes
  CONFIDENCES: 60,    // Agent shares personal backstory details
  DEEP_BOND: 80,      // Agent shares fears, dreams, vulnerabilities
} as const;

export interface Agent {
  slug: string;
  name: string;
  role: string;
  goal: string;
  backstory: string;
  appearance_prompt: string;
  personality_primary: string;
  personality_nuance: string;
  gender: string;
  department: string;
  status: string;
  assigned_project: string;
  portrait_url: string | null;
  icon_url: string | null;
  mood: AgentMood;
  mood_cause: string | null;
  mood_updated_at: string | null;
  confidence_level: number;
  recruited_at: string | null;
  tasks: AgentTask[];
}

export async function getAllAgents(): Promise<Agent[]> {
  const { data, error } = await supabase
    .from("agents")
    .select("*, agent_tasks(*)")
    .order("created_at", { ascending: true });

  if (error || !data) return [];

  return data.map((row) => ({
    ...row,
    tasks: ((row.agent_tasks as AgentTask[]) ?? []).sort(
      (a: AgentTask & { position?: number }, b: AgentTask & { position?: number }) =>
        (a.position ?? 0) - (b.position ?? 0)
    ),
  }));
}

export async function getAgentBySlug(slug: string): Promise<Agent | null> {
  const { data, error } = await supabase
    .from("agents")
    .select("*, agent_tasks(*)")
    .eq("slug", slug)
    .single();

  if (error || !data) return null;

  return {
    ...data,
    tasks: ((data.agent_tasks as AgentTask[]) ?? []).sort(
      (a: AgentTask & { position?: number }, b: AgentTask & { position?: number }) =>
        (a.position ?? 0) - (b.position ?? 0)
    ),
  };
}

export async function createAgent(
  agent: Omit<Agent, "tasks">,
  tasks: AgentTask[]
): Promise<void> {
  const { error: agentErr } = await supabase.from("agents").insert({
    slug: agent.slug,
    name: agent.name,
    role: agent.role,
    goal: agent.goal,
    backstory: agent.backstory,
    appearance_prompt: agent.appearance_prompt,
    personality_primary: agent.personality_primary,
    personality_nuance: agent.personality_nuance,
    gender: agent.gender,
    department: agent.department,
    status: agent.status,
    assigned_project: agent.assigned_project,
    portrait_url: agent.portrait_url ?? null,
    icon_url: agent.icon_url ?? null,
  });

  if (agentErr) throw new Error(agentErr.message);

  if (tasks.length > 0) {
    const { error: tasksErr } = await supabase.from("agent_tasks").insert(
      tasks.map((t, i) => ({
        agent_slug: agent.slug,
        task_name: t.task_name,
        description: t.description,
        expected_output: t.expected_output,
        position: i,
      }))
    );
    if (tasksErr) throw new Error(tasksErr.message);
  }
}

export async function updateAgentFields(
  slug: string,
  updates: Partial<Pick<Agent, "status" | "assigned_project" | "portrait_url" | "icon_url" | "mood" | "mood_cause" | "mood_updated_at" | "confidence_level">>
): Promise<void> {
  const { error } = await supabase.from("agents").update(updates).eq("slug", slug);
  if (error) throw new Error(error.message);
}

/**
 * Increase an agent's confidence level by a given amount (capped at 100).
 */
export async function increaseConfidence(slug: string, amount: number): Promise<number> {
  const agent = await getAgentBySlug(slug);
  if (!agent) return 0;
  const newLevel = Math.min(100, (agent.confidence_level ?? 0) + amount);
  await updateAgentFields(slug, { confidence_level: newLevel });
  return newLevel;
}

/**
 * Update an agent's mood with a cause.
 */
export async function updateAgentMood(
  slug: string,
  mood: AgentMood,
  cause: string
): Promise<void> {
  await updateAgentFields(slug, {
    mood,
    mood_cause: cause,
    mood_updated_at: new Date().toISOString(),
  });
}

export async function deleteAgent(slug: string): Promise<void> {
  const { error } = await supabase.from("agents").delete().eq("slug", slug);
  if (error) throw new Error(error.message);
}
