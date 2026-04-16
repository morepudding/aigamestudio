import { supabase } from "@/lib/supabase/client";
import type { ProjectDecision, DecisionScope } from "@/lib/types/decision";

interface DbDecision {
  id: string;
  project_id: string;
  scope: DecisionScope;
  question_key: string;
  question_text: string;
  options: string[];
  selected_option: string | null;
  free_text: string | null;
  answered: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

function toDecision(row: DbDecision): ProjectDecision {
  return {
    id: row.id,
    projectId: row.project_id,
    scope: row.scope,
    questionKey: row.question_key,
    questionText: row.question_text,
    options: row.options ?? [],
    selectedOption: row.selected_option,
    freeText: row.free_text,
    answered: row.answered,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getDecisions(projectId: string): Promise<ProjectDecision[]> {
  const { data, error } = await supabase
    .from("project_decisions")
    .select("*")
    .eq("project_id", projectId)
    .order("scope")
    .order("sort_order");

  if (error || !data) return [];
  return (data as DbDecision[]).map(toDecision);
}

export async function getDecisionsByScope(
  projectId: string,
  scope: DecisionScope
): Promise<ProjectDecision[]> {
  const { data, error } = await supabase
    .from("project_decisions")
    .select("*")
    .eq("project_id", projectId)
    .eq("scope", scope)
    .order("sort_order");

  if (error || !data) return [];
  return (data as DbDecision[]).map(toDecision);
}

export async function getAnsweredDecisions(projectId: string): Promise<ProjectDecision[]> {
  const { data, error } = await supabase
    .from("project_decisions")
    .select("*")
    .eq("project_id", projectId)
    .eq("answered", true)
    .order("scope")
    .order("sort_order");

  if (error || !data) return [];
  return (data as DbDecision[]).map(toDecision);
}

export async function upsertDecisions(
  projectId: string,
  decisions: {
    scope: DecisionScope;
    questionKey: string;
    questionText: string;
    options: string[];
    sortOrder: number;
  }[]
): Promise<ProjectDecision[]> {
  const rows = decisions.map((d) => ({
    project_id: projectId,
    scope: d.scope,
    question_key: d.questionKey,
    question_text: d.questionText,
    options: d.options,
    sort_order: d.sortOrder,
    answered: false,
  }));

  const { data, error } = await supabase
    .from("project_decisions")
    .upsert(rows, { onConflict: "project_id,scope,question_key" })
    .select();

  if (error || !data) return [];
  return (data as DbDecision[]).map(toDecision);
}

export async function answerDecision(
  decisionId: string,
  selectedOption: string | null,
  freeText: string | null
): Promise<ProjectDecision | null> {
  const { data, error } = await supabase
    .from("project_decisions")
    .update({
      selected_option: selectedOption,
      free_text: freeText,
      answered: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", decisionId)
    .select()
    .single();

  if (error || !data) return null;
  return toDecision(data as DbDecision);
}

export async function markDecisionsReady(projectId: string): Promise<void> {
  await supabase
    .from("projects")
    .update({ decisions_ready: true })
    .eq("id", projectId);
}

export async function areDecisionsReady(projectId: string): Promise<boolean> {
  const { data } = await supabase
    .from("projects")
    .select("decisions_ready")
    .eq("id", projectId)
    .single();

  return data?.decisions_ready === true;
}

export async function canMarkDecisionsReady(projectId: string): Promise<{
  ok: boolean;
  total: number;
  answered: number;
}> {
  const decisions = await getDecisions(projectId);
  const total = decisions.length;
  const answered = decisions.filter((decision) => decision.answered).length;

  return {
    ok: total > 0 && answered === total,
    total,
    answered,
  };
}

/**
 * Build a formatted context block from answered decisions for prompt injection.
 * Groups decisions by scope and formats them as directive statements.
 */
export function buildDecisionsContext(decisions: ProjectDecision[]): string {
  if (decisions.length === 0) return "";

  const grouped = new Map<string, ProjectDecision[]>();
  for (const d of decisions) {
    const list = grouped.get(d.scope) ?? [];
    list.push(d);
    grouped.set(d.scope, list);
  }

  const sections: string[] = [];

  for (const [scope, items] of grouped) {
    const label = scope === "global" ? "Décisions stratégiques globales" : `Décisions pour ${scope}`;
    const lines = items.map((d) => {
      const answer = d.freeText
        ? `${d.selectedOption ?? ""} — ${d.freeText}`.trim()
        : d.selectedOption ?? "(non répondu)";
      return `- ${d.questionText} → **${answer}**`;
    });
    sections.push(`### ${label}\n${lines.join("\n")}`);
  }

  return `## DÉCISIONS DU DIRECTEUR (PRIORITÉ ABSOLUE)\nCes décisions ont été prises par le directeur du studio. Tu DOIS les respecter intégralement. Ne les contredis JAMAIS.\n\n${sections.join("\n\n")}`;
}

/**
 * Derive explicit "NE PAS faire" constraints from answered decisions.
 * Returns an empty string if no exclusion constraints apply.
 */
export function buildDecisionConstraints(decisions: ProjectDecision[]): string {
  const constraints: string[] = [];

  for (const d of decisions) {
    const option = d.selectedOption;
    if (!option) continue;

    switch (d.questionKey) {
      case "monetization":
        if (option === "Gratuit (pas de monétisation)") {
          constraints.push(
            "NE PAS inclure de section, contenu ou mécanique liés à la monétisation, aux achats in-app, aux cosmétiques payants, aux DLC payants ou à tout modèle économique — ce jeu est entièrement gratuit sans monétisation"
          );
        }
        break;

      case "multiplayer":
        if (option === "Solo uniquement") {
          constraints.push(
            "NE PAS inclure de fonctionnalités multijoueur, serveurs en ligne, netcode, leaderboards en ligne ou synchronisation réseau — ce jeu est solo uniquement"
          );
        }
        break;

      case "save_system":
        if (option === "Pas de sauvegarde (arcade / roguelike)") {
          constraints.push(
            "NE PAS inclure de système de sauvegarde ou de persistance de progression entre sessions — ce jeu n'en a pas (arcade / roguelike)"
          );
        }
        break;

      case "scope_ambition":
        if (option === "Prototype / Game jam (1-2 semaines)") {
          constraints.push(
            "NE PAS proposer de systèmes complexes, de contenu étendu ou de fonctionnalités avancées — le scope est celui d'un prototype ou d'une game jam (1-2 semaines max)"
          );
        }
        break;
    }
  }

  if (constraints.length === 0) return "";

  return `## GARDE-FOUS DÉCISIONS (INTERDICTIONS ABSOLUES)\nLes points suivants sont HORS SCOPE selon les décisions du directeur. Ne les mentionne JAMAIS, ne les suggère pas, ne les inclus pas même implicitement :\n${constraints.map((c) => `- ${c}`).join("\n")}`;
}
