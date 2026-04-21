import type { Agent } from "@/lib/services/agentService";
import type { Project } from "@/lib/types/project";
import type { GameBrief, OnePageComments } from "@/lib/types/brainstorming";
import { buildSimpleGameConstraintsPrompt } from "@/lib/config/gameConstraints";

const GENRE_LABELS: Record<string, string> = {
  action: "Action",
  puzzle: "Puzzle / Réflexion",
  stealth: "Stealth / Infiltration",
  arcade: "Arcade",
  rpg: "RPG",
  autre: "Autre",
};

const DURATION_LABELS: Record<string, string> = {
  "2min": "moins de 2 minutes",
  "5min": "5 minutes",
  "15min": "10 à 15 minutes",
};

const ONE_PAGE_TEMPLATE = `# [Titre du jeu]

## Elevator Pitch
[2 phrases max. Thème + mécanique + ce qui le rend unique. Pas de jargon.]

## Player Fantasy
[Ce que le joueur ressent, pas ce qu'il fait. Ex: "Tu te sens maître de la manipulation."]

## Core Loop
1. [Action principale — le verbe du gameplay]
2. [Feedback immédiat — ce qui se passe après l'action]
3. [Progression / récompense]

## Univers
[3-4 lignes. Contexte narratif dans Academia Vespana, époque, ton. Cohérent avec le thème espion Renaissance italienne.]

## Périmètre V1
**IN** :
- [Feature 1 — essentielle au gameplay]
- [Feature 2]
- [Feature 3 max]

**OUT** :
- [Feature écartée pour V1 et pourquoi]
- [Feature écartée]

## Risques identifiés
- [Risque 1 — incohérence, ambition excessive, ou problème de faisabilité]
- [Risque 2 si pertinent]

## Intégration VN
[Comment ce jeu s'intègre dans Academia Vespana via postMessage. Score envoyé, event de fin, conditions de succès/échec.]`;

export function buildOnePageGeneratePrompt(
  agent: Agent,
  project: Project,
  brief: GameBrief,
  studioContext: string,
  comments?: OnePageComments | null,
  previousOnePage?: string | null
): string {
  const isRegeneration = !!previousOnePage && !!comments && Object.keys(comments).length > 0;

  const briefBlock = `
**Titre du jeu :** ${project.title}
**Description :** ${project.description || "Aucune"}
**Genre mécanique :** ${GENRE_LABELS[brief.genre] ?? brief.genre}
**Durée de session :** ${DURATION_LABELS[brief.sessionDuration] ?? brief.sessionDuration}
**Jeu de référence :** ${brief.referenceGame || "Aucun"}
**Univers / Thème :** ${brief.theme}`.trim();

  const agentProPrompt = agent.prompt_pro
    ? `\n\n${agent.prompt_pro}`
    : "";

  if (!isRegeneration) {
    const constraintsPrompt = buildSimpleGameConstraintsPrompt();
    
    return `Tu es ${agent.name}, ${agent.role} chez Eden Studio.${agentProPrompt}

${studioContext}

${constraintsPrompt}

Le directeur vient de remplir le brief suivant :
${briefBlock}

Génère le One Page Design Document complet pour ce jeu. Suis EXACTEMENT le template ci-dessous — ne modifie pas les titres de sections, ne rajoute pas de sections.

Sois direct, professionnel, sans fioritures. Chaque ligne doit avoir un vrai contenu design, pas du remplissage.
Si tu détectes une incohérence (ex: genre trop long pour la durée, mécanique incompatible avec l'univers), note-le dans "Risques identifiés" — n'invente pas pour masquer le problème.
Respecte les contraintes absolues du studio listées dans le contexte ci-dessus.

**IMPORTANT** : Vérifie que ton design respecte TOUTES les contraintes pour jeux simples ci-dessus. Si une section du template suggère plus de complexité, adapte-la pour rester simple.

Template à remplir :
${ONE_PAGE_TEMPLATE}`;
  }

  const commentsBlock = Object.entries(comments!)
    .map(([section, comment]) => `- **${section}** : ${comment}`)
    .join("\n");

  const constraintsPrompt = buildSimpleGameConstraintsPrompt();

  return `Tu es ${agent.name}, ${agent.role} chez Eden Studio.${agentProPrompt}

${studioContext}

${constraintsPrompt}

Le directeur a relu le One Page suivant et a laissé des commentaires par section. Régénère le document en tenant compte de TOUS les commentaires. Ne change que ce qui est commenté — le reste reste intact.

**IMPORTANT** : Assure-toi que la version mise à jour respecte TOUTES les contraintes pour jeux simples ci-dessus.

Brief original :
${briefBlock}

One Page V précédente :
${previousOnePage}

Commentaires du directeur (par section) :
${commentsBlock}

Génère le One Page mis à jour. Même template, mêmes titres de sections, même format.`;
}
