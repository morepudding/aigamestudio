import type { TaskReview } from "@/lib/services/taskReviewService";
import type { AgentSkillPrompt } from "@/lib/services/agentSkillPromptService";
import { PROGRAMMER_SPECIALIZATIONS } from "@/lib/types/agent";

interface AgentContext {
  name: string;
  slug: string;
  department: string;
  position: string | null;
  specialization: string | null;
}

/**
 * Construit le system prompt d'Eve pour la génération d'un prompt compétence LEAN.
 *
 * Principes LEAN issus du doc agentic-claude :
 * - Chaque règle doit changer un comportement concret — sinon on la supprime
 * - Pas de généralisations, pas de "essaie de", pas de conseils évidents
 * - Précis, ciblé, court — les prompts trop longs sont ignorés
 * - Ancré dans les faits observés (les reviews), pas dans des suppositions
 */
export function buildEveSkillPromptSystem(): string {
  return `Tu es Eve, Producer senior chez Eden Studio. Tu as une expertise en amélioration continue des agents IA.

Ton rôle ici est de générer un **prompt compétence** pour un agent, basé sur un post-mortem de projet.

## Ce qu'est un prompt compétence

C'est un texte injecté dans le system prompt d'un agent UNIQUEMENT lors de l'exécution de tâches pipeline.
Il ne concerne PAS sa personnalité, son ton, ses mémoires, ou sa relation avec l'utilisateur.
Il concerne UNIQUEMENT comment l'agent travaille : ses règles métier, ses contraintes, ses points de vigilance.

## Principes LEAN stricts que tu dois suivre

**1. Chaque ligne doit changer un comportement.**
Si supprimer une ligne ne changerait rien à la façon dont l'agent travaille, supprime-la.
Pas de "essaie de faire X", pas de "pense à Y", pas de "en général Z".
Uniquement des règles actionnables et vérifiables.

**2. Ancré dans les faits, pas dans des suppositions.**
Tu te bases EXCLUSIVEMENT sur les reviews fournies. Tu n'inventes pas de problèmes.
Si une review dit "bien fait", c'est une force à renforcer, pas à corriger.

**3. Court et dense.**
Maximum 20 lignes de règles. Un prompt trop long est ignoré.
Préfère 5 règles précises à 15 vagues.

**4. Distingue forces et points de vigilance.**
Les forces validées (bonnes notes) → à renforcer explicitement.
Les faiblesses observées (mauvaises notes + commentaire) → règles correctives précises.

**5. Versioning explicite.**
Mentionne toujours le numéro de version et le projet source pour traçabilité.

## Format de sortie

Réponds UNIQUEMENT avec le prompt compétence en markdown, sans JSON, sans balises autour.
Structure :

\`\`\`
# [Nom] — [Département] [Position] (v[N] — post-mortem: [Projet])

## Forces validées
- [force concrète observée]

## Règles actives
- [règle précise et actionnables]
- TOUJOURS [contrainte non-négociable]
- NE JAMAIS [interdit observé]

## Points de vigilance
- [pattern problématique observé + contexte]
\`\`\``;
}

export function buildEveSkillPromptUser(
  agent: AgentContext,
  projectTitle: string,
  reviews: TaskReview[],
  previousPrompt: AgentSkillPrompt | null,
  taskTitles: Record<string, string>
): string {
  const specializationLabel = agent.specialization
    ? PROGRAMMER_SPECIALIZATIONS.find((s) => s.id === agent.specialization)?.label ?? agent.specialization
    : null;

  const agentProfile = [
    `Nom: ${agent.name}`,
    `Département: ${agent.department}`,
    agent.position ? `Position: ${agent.position}` : null,
    specializationLabel ? `Spécialisation: ${specializationLabel}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const reviewsText = reviews
    .map((r) => {
      const taskTitle = taskTitles[r.task_id] ?? r.task_id;
      const stars = "★".repeat(r.rating) + "☆".repeat(5 - r.rating);
      const comment = r.comment?.trim() ? `\n   Commentaire: "${r.comment.trim()}"` : "";
      return `- Tâche: ${taskTitle}\n  Note: ${stars} (${r.rating}/5)${comment}`;
    })
    .join("\n\n");

  const previousSection = previousPrompt
    ? `\n## Prompt compétence précédent (v${previousPrompt.version})\n\n${previousPrompt.content}\n\n---\n`
    : "";

  return `## Profil de l'agent

${agentProfile}

## Projet post-mortem: ${projectTitle}

## Reviews des tâches assignées à cet agent

${reviewsText || "Aucune review disponible pour ce projet."}
${previousSection}
---

Génère le prompt compétence mis à jour pour cet agent.
${previousPrompt ? "Prends en compte le prompt précédent : conserve ce qui est toujours valide, remplace ce que les nouvelles reviews contredisent ou améliorent." : "C'est la première version : base-toi uniquement sur les reviews de ce projet."}`;
}
