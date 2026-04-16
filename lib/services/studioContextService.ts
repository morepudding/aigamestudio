import { getAllProjects } from "@/lib/services/projectService";
import { getAllAgents, Agent } from "@/lib/services/agentService";
import { getConventions } from "@/lib/services/studioSettingsService";

export interface StudioContext {
  projects: string;
  team: string;
  conventions: string;
  full: string;
}

/**
 * Builds a compact studio context string for injection into AI prompts.
 * Called server-side in API routes — always fresh, never depends on client.
 */
export async function buildStudioContext(): Promise<StudioContext> {
  const [projects, agents, conventions] = await Promise.all([
    getAllProjects(),
    getAllAgents(),
    getConventions(),
  ]);

  const activeProjects = projects.filter(
    (p) => p.active || p.status === "concept" || p.status === "in-dev"
  );
  const activeAgents = agents.filter(
    (a) => a.status === "actif" || a.status === "active" || a.status === "onboarding" || a.status === "recruté"
  );

  const projectsBlock =
    activeProjects.length > 0
      ? activeProjects
          .map((p) => `- ${p.title} (${p.genre}) [${p.status}] — ${p.engine}`)
          .join("\n")
      : "Aucun projet actif.";

  const teamBlock =
    activeAgents.length > 0
      ? activeAgents
          .map((a) => `- ${a.name} : ${a.role} (${a.department})`)
          .join("\n")
      : "Aucun collaborateur actif.";

  const conventionsBlock = conventions.trim()
    ? `\nConventions studio :\n${conventions.trim()}`
    : "";

  const teamCount = activeAgents.length;
  const full = `CONTEXTE STUDIO — SOURCE DE VÉRITÉ ABSOLUE (ne jamais inventer au-delà) :

Projets en cours :
${projectsBlock}

Équipe actuelle (${teamCount} membre${teamCount > 1 ? "s" : ""} — liste exhaustive, aucune autre personne n'existe dans l'équipe) :
${teamBlock}${conventionsBlock}

⚠️ Si une information sur le studio n'est pas listée ci-dessus, tu ne la connais pas. Pose une question plutôt qu'inventer.`;

  return { projects: projectsBlock, team: teamBlock, conventions, full };
}

/**
 * Formats basic agent roster for a specific agent's perspective.
 * Excludes the agent itself.
 */
export function formatTeamForAgent(agents: Agent[], excludeSlug: string): string {
  const others = agents.filter(
    (a) => a.slug !== excludeSlug && (a.status === "actif" || a.status === "active" || a.status === "onboarding" || a.status === "recruté")
  );
  if (others.length === 0) return "Tu es le seul membre de l'équipe pour l'instant.";
  return others.map((a) => `- ${a.name} : ${a.role} (${a.department})`).join("\n");
}
