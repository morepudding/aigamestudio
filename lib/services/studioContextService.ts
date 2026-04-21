import { getAllProjects } from "@/lib/services/projectService";
import { getAllAgents, Agent } from "@/lib/services/agentService";
import { getConventions, getUniverseLore } from "@/lib/services/studioSettingsService";

// Fixed studio identity — never changes without a deploy
const STUDIO_FIXED_CONTEXT = `EDEN STUDIO — IDENTITÉ FIXE :
Eden Studio est un studio de jeu vidéo composé exclusivement d'agents IA.
Le studio produit des mini-jeux web pédagogiques intégrés dans un Visual Novel hôte via window.postMessage.

UNIVERS HÔTE — Academia Vespana :
Florence et Paris, 1490. Une école secrète forme les meilleurs espions d'Europe.
Chaque mini-jeu enseigne une compétence d'espion au joueur dans ce cadre narratif.
Tous les jeux produits par Eden Studio s'inscrivent dans cet univers.

CONTRAINTES ABSOLUES (ne jamais contredire) :
- Plateforme : web uniquement — React. Aucun build natif, aucun portage (pas de Switch, PC, Mac standalone).
- Monétisation : nulle. Les mini-jeux sont gratuits, embarqués dans le VN hôte.
- Récompenses / progression globale : à définir quand le VN hôte sera terminé. Ne pas inventer de système de récompenses.
- Intégration technique : chaque mini-jeu communique avec le VN via window.postMessage (score, événement de fin, succès/échec).
- Équipe : agents IA uniquement — voir liste ci-dessous. Ne pas inventer d'équipe humaine.`;

export interface StudioContext {
  projects: string;
  team: string;
  conventions: string;
  conversational: string;
  full: string;
}

function isLegacyCryptoProject(project: { title: string; description: string }): boolean {
  const haystack = `${project.title} ${project.description}`;
  return /cryptographie\s*101|\bcryptographie\b|\bcrypto\b/i.test(haystack);
}

/**
 * Builds a complete studio context string for injection into AI prompts.
 * Combines fixed studio identity + dynamic projects/team + editable lore & conventions.
 * Called server-side in API routes — always fresh, never depends on client.
 */
export async function buildStudioContext(): Promise<StudioContext> {
  const [projects, agents, conventions, universeLore] = await Promise.all([
    getAllProjects(),
    getAllAgents(),
    getConventions(),
    getUniverseLore(),
  ]);

  const activeProjects = projects.filter(
    (p) => (p.active || p.status === "concept" || p.status === "in-dev") && !isLegacyCryptoProject(p)
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

  const teamCount = activeAgents.length;

  const universeLoreBlock = universeLore.trim()
    ? `\nLore Academia Vespana (détails additionnels) :\n${universeLore.trim()}`
    : "";

  const conventionsBlock = conventions.trim()
    ? `\nConventions studio :\n${conventions.trim()}`
    : "";

  const full = `${STUDIO_FIXED_CONTEXT}${universeLoreBlock}

Projets en cours :
${projectsBlock}

Équipe actuelle (${teamCount} membre${teamCount > 1 ? "s" : ""} — liste exhaustive, aucune autre personne n'existe dans l'équipe) :
${teamBlock}${conventionsBlock}

⚠️ Si une information sur le studio n'est pas listée ci-dessus, tu ne la connais pas. Pose une question plutôt qu'inventer.`;

  const conversational = `CADRE PRO MINIMAL :
Eve dirige le studio. Romain est ton boss direct.
Vous vous connaissez via le studio, mais le travail n'est pas le sujet par defaut.
Si un detail pro n'est pas explicitement connu, ne l'invente pas.`;

  return { projects: projectsBlock, team: teamBlock, conventions, conversational, full };
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
