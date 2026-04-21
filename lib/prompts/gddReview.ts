// GDD Review prompts
// 1. buildGddV1Prompt     — Generate first draft from brainstorming scope
// 2. buildGddCritiquePrompt — AI self-critique → structured questions
// 3. buildGddV2Prompt     — Generate improved V2 from answers

import type { Project } from "@/lib/types/project";
import { GDD_TEMPLATE } from "@/lib/prompts/templates/docs";
import type { CritiqueQuestion } from "@/lib/types/brainstorming";
import { buildSimpleGameConstraintsPrompt } from "@/lib/config/gameConstraints";

const TRIPLE_BACKTICK = "```";

// ============================================================
// 1. Generate GDD V1 from brainstorming scope summary
// ============================================================

export function buildGddV1Prompt(
  project: Project,
  scopeInput: string,
  studioContext: string,
  onePage?: string | null
): string {
  const sourceBlock = onePage
    ? `One Page validé par le directeur :\n---\n${onePage}\n---\n\nComplément de description :\n---\n${scopeInput}\n---`
    : `Concept du projet :\n---\n${scopeInput}\n---`;

  const constraintsPrompt = buildSimpleGameConstraintsPrompt();

  return `Tu es un Game Designer senior chez Eden Studio.

${studioContext}

${constraintsPrompt}

Tu travailles sur le jeu "${project.title}".

${sourceBlock}

En te basant STRICTEMENT sur ce concept, rédige le Game Design Document complet en suivant cette structure :

${GDD_TEMPLATE.replace(/{titre}/g, project.title)}

RÈGLES IMPÉRATIVES :
1. Respecte TOUTES les contraintes pour jeux simples ci-dessus
2. Sois 100% fidèle au scope — ne rajoute rien qui n'a pas été mentionné ou qui en découle logiquement
3. Limite la complexité : MAX 3 mécaniques principales, MAX 2 secondaires
4. Sois spécifique et actionnable pour chaque section
5. Utilise des exemples de jeux simples (Tetris, Pong, 2048) comme référence
6. Format : Markdown propre, sans bloc ${TRIPLE_BACKTICK}markdown, sans backticks d'encapsulation
7. N'échappe jamais le document en JSON ou avec des \\n
8. Langue : Français
9. MAX 1500 mots (pas 3500 ! Garde-le court et simple)
10. Ne réponds QUE avec le contenu du GDD, sans introduction ni commentaire`;
}

// ============================================================
// 2. Self-critique → generate structured questions
// ============================================================

export function buildGddCritiquePrompt(
  project: Project,
  gddV1: string,
  studioContext: string,
  onePage?: string | null
): string {
  const onePageBlock = onePage
    ? `\nOne Page validé (référence) :\n---\n${onePage}\n---\n`
    : "";

  const constraintsPrompt = buildSimpleGameConstraintsPrompt();

  return `Tu es un Game Designer senior chez Eden Studio qui vient de rédiger un premier jet de GDD pour "${project.title}".

${studioContext}
${constraintsPrompt}
${onePageBlock}
Voici le GDD V1 :
---
${gddV1}
---

Relis ce document de façon critique. Identifie les points qui nécessitent une clarification du directeur de studio avant de pouvoir finaliser le GDD.

Cherche spécifiquement :
1. Les violations des contraintes pour jeux simples (trop de mécaniques, trop complexe, etc.)
2. Les ambiguïtés qui pourraient bloquer le développement (mécanique floue, scope incertain)
3. Les choix importants que le GDD a tranché sans confirmation du directeur
4. Les sections incomplètes ou trop vagues pour être actionnables
5. Les contradictions internes éventuelles${onePage ? "\n6. Les contradictions entre le GDD V1 et la One Page validée" : ""}
6. Les violations des contraintes studio (monétisation inventée, plateforme non-web, équipe humaine, etc.)

**VÉRIFICATION DE SIMPLICITÉ** :
- Compte le nombre de mécaniques principales (doit être ≤ 3)
- Compte le nombre de mécaniques secondaires (doit être ≤ 2)
- Vérifie la durée de session (doit être ≤ 15 minutes)
- Vérifie la complexité technique (doit être adaptée au web simple)

Génère entre 3 et 6 questions ciblées. Pour chaque question :
- Si la réponse peut être choisie parmi des options prédéfinies, fournis 3-4 options courtes
- Si c'est une question ouverte qui nécessite une réponse libre, laisse options à null

Réponds en JSON pur, sans markdown, sans commentaire, avec ce format exact :
[
  {
    "id": "q1",
    "question": "...",
    "options": ["option A", "option B", "option C"]
  },
  {
    "id": "q2",
    "question": "...",
    "options": null
  }
]`;
}

// ============================================================
// 3. Generate GDD V2 from V1 + answers
// ============================================================

export function buildGddV2Prompt(
  project: Project,
  gddV1: string,
  questions: CritiqueQuestion[],
  answers: Record<string, string>,
  studioContext: string
): string {
  const qaBlock = questions
    .map((q) => {
      const answer = answers[q.id] ?? "(sans réponse)";
      return `Q: ${q.question}\nR: ${answer}`;
    })
    .join("\n\n");

  return `Tu es un Game Designer senior chez Eden Studio. Tu as rédigé un premier jet de GDD pour "${project.title}" et posé des questions de clarification au directeur de studio. Tu vas maintenant produire la version finale améliorée.

${studioContext}

GDD V1 :
---
${gddV1}
---

Réponses du directeur aux questions de clarification :
---
${qaBlock}
---

Rédige le GDD V2 en intégrant TOUTES les réponses du directeur. Le V2 doit :
- Reprendre l'intégralité du GDD V1 comme base
- Mettre à jour, préciser ou corriger chaque section concernée par les réponses
- Être plus précis et actionnable que le V1
- Rester fidèle au scope global — pas de nouvelles features non mentionnées
- Respecter les contraintes absolues du studio listées dans le contexte ci-dessus

RÈGLES IMPÉRATIVES :
- Format : Markdown propre, sans bloc ${TRIPLE_BACKTICK}markdown, sans backticks d'encapsulation
- Langue : Français
- MAX 4000 mots
- Ne réponds QUE avec le contenu du GDD V2, sans introduction ni commentaire`;
}

// ============================================================
// 4. Audit prompt: verify secondary doc follows GDD
// ============================================================

export function buildAuditPrompt(
  docTitle: string,
  docContent: string,
  gddContent: string
): string {
  return `Tu es un producteur de jeux vidéo expérimenté. Tu dois vérifier qu'un document de production est 100% cohérent avec le GDD.

GDD de référence :
---
${gddContent}
---

Document à auditer (${docTitle}) :
---
${docContent}
---

Vérifie :
1. Aucune feature ou système mentionné dans ce document n'est absent du GDD (invention hors scope)
2. Aucune contradiction avec les choix du GDD (genre, mécaniques, contraintes)
3. Pas de suppositions non fondées sur l'univers ou le gameplay

Réponds en JSON pur, sans markdown :
{
  "compliant": true | false,
  "issues": [
    {
      "severity": "critical" | "minor",
      "description": "Description du problème",
      "location": "Section ou ligne approximative dans le document"
    }
  ],
  "summary": "Résumé en 1 phrase"
}

Si le document est conforme, renvoie compliant: true et issues: [].`;
}
