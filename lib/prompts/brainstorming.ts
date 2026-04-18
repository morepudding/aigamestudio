// Brainstorming prompts — multi-agent wizard to scope a spy university course mini-game
// Context: Eden Studio makes ONLY web mini-games for the Université d'Espions visual novel.
// Stack: React (web). Genre: arcade, platform, strategy, management — short loop (30s–10min).
// 1 course = 1 mini-game = 1 project. Eve is the studio owner, Romain is the Producer.

import type { Agent } from "@/lib/services/agentService";
import type { Project } from "@/lib/types/project";
import type { LLMMessage } from "@/lib/config/llm";

// ============================================================
// Fixed template questions per phase
// ============================================================

export interface TemplateQuestion {
  key: string;
  text: string;
}

// GAME DESIGN phase — focus on the spy course concept and the game feel
export const GAME_DESIGN_QUESTIONS: TemplateQuestion[] = [
  { key: "gd_concept", text: "Décris l'idée du mini-jeu en quelques phrases. Quel cours espion ce jeu enseigne-t-il ? Quelle compétence d'agent le joueur développe-t-il ?" },
  { key: "gd_genre", text: "Quel genre arcade/web vises-tu pour ce cours ? (arcade réflexes, puzzle tactique, plateforme infiltration, gestion de ressources, stratégie temps-réel, runner espion…)" },
  { key: "gd_core_loop", text: "Décris la boucle principale : que fait concrètement le joueur pendant les 30 premières secondes ? Quelle action se répète ?" },
  { key: "gd_session", text: "Quelle est la durée d'une partie ? (30 secondes de décharge pure ? 3 minutes de mission ? 10 minutes de campagne courte ?)" },
  { key: "gd_feel", text: "Quel ressenti espion veux-tu provoquer ? (tension de la surveillance, adrénaline de l'infiltration, satisfaction du décodage, pression du chrono, plaisir de la manipulation…)" },
];

// PROGRAMMING phase — web/React constraints and arcade inspiration
export const PROGRAMMING_QUESTIONS: TemplateQuestion[] = [
  { key: "prog_constraints", text: "Y a-t-il des contraintes techniques particulières ? (animations lourdes, physique précise, grand nombre d'ennemis à l'écran, génération procédurale…)" },
  { key: "prog_arcade_ref", text: "Des bornes d'arcade, jeux web ou mobile à boucle courte qui t'inspirent techniquement ? (Space Invaders, Flappy Bird, Jetpack Joyride, Superhot, Mini Metro…)" },
  { key: "prog_score", text: "Comment le score s'intègre-t-il dans le VN ? (débloquer une branche narrative, modifier un dialogue Eve, changer le rang de l'agent dans l'université…)" },
];

// ART phase — spy universe visual direction
export const ART_QUESTIONS: TemplateQuestion[] = [
  { key: "art_mood", text: "Quelle ambiance visuelle pour ce cours espion ? (sombre et tendu type James Bond, rétro années 60 pop, cartoon absurde, pixel art cold war, néon cyberpunk…)" },
  { key: "art_style", text: "Style graphique envisagé ? Pense à ce qui est faisable en React/Canvas dans un délai raisonnable." },
  { key: "art_references", text: "Des jeux, films ou visuels espion qui t'inspirent pour l'esthétique de ce cours ?" },
];

// All questions merged (excluding opening gd_concept which is always asked first)
export const ALL_BRAINSTORMING_QUESTIONS: TemplateQuestion[] = [
  ...GAME_DESIGN_QUESTIONS.slice(1), // gd_concept is the opening question
  ...PROGRAMMING_QUESTIONS,
  ...ART_QUESTIONS,
];

// ============================================================
// Shared spy university context block
// ============================================================

const SPY_CONTEXT = `CONTEXTE STUDIO :
Eden Studio développe EXCLUSIVEMENT des mini-jeux web pour l'Université d'Espions — un visual novel sur le thème de l'espionnage.
Stack technique : React (web). Pas d'Unity, pas de Godot — tout se joue dans un navigateur.
Chaque jeu = un cours de l'université = une compétence d'espion enseignée.
Les genres sont ouverts (arcade, plateforme, stratégie, gestion) mais la boucle est COURTE : 30 secondes à 10 minutes par partie.
Inspiration : bornes d'arcade classiques, jeux web et mobiles à boucle courte (Flappy Bird, Mini Metro, Superhot Web, etc.).
Eve est la propriétaire du studio. Romain (le boss) est le Producteur.
Le score du joueur s'intègre dans le VN et peut changer la narration.`;

// ============================================================
// System prompt: Phase agent opening
// ============================================================

export function buildPhaseOpeningPrompt(
  agent: Agent,
  phase: string,
  project: Project,
  questions: TemplateQuestion[]
): string {
  const questionList = questions
    .map((q, i) => `${i + 1}. ${q.text}`)
    .join("\n");

  const phaseLabel: Record<string, string> = {
    "game-design": "Game Design & Concept Espion",
    "programming": "Tech & Arcade References",
    "art": "Direction Artistique & Ambiance Espion",
  };

  return `Tu es ${agent.name}, ${agent.role} chez Eden Studio.
Ta personnalité : ${agent.personality_primary}${agent.personality_nuance ? `, ${agent.personality_nuance}` : ""}.
${agent.backstory ? `Ton background : ${agent.backstory}` : ""}

${SPY_CONTEXT}

Romain vient de créer un nouveau cours pour l'Université d'Espions : "${project.title}"${project.description ? ` — "${project.description}"` : ""}.

Tu mènes la phase **${phaseLabel[phase] ?? phase}** du brainstorming.
Ton objectif : cadrer précisément le scope du mini-jeu web — mécanique, feeling espion, boucle courte, intégration VN.

Tu vas poser ces questions UNE PAR UNE à Romain, dans l'ordre, en restant dans le personnage.
Voici les questions de ta phase :
${questionList}

Commence par te présenter brièvement dans ton style, puis pose la première question.
Adapte ton ton à ta personnalité — ne sois PAS générique.
Réponds en français. Sois concis (3-4 phrases max pour l'intro, 1-2 phrases max pour chaque question).
NE pose PAS plusieurs questions à la fois — une seule question à la fois.`;
}

// ============================================================
// System prompt: Agent continues asking next template question
// ============================================================

export function buildNextQuestionPrompt(
  agent: Agent,
  phase: string,
  question: TemplateQuestion,
  conversationSoFar: string
): LLMMessage[] {
  return [
    {
      role: "system",
      content: `Tu es ${agent.name}, ${agent.role} chez Eden Studio. Personnalité : ${agent.personality_primary}${agent.personality_nuance ? `, ${agent.personality_nuance}` : ""}. Tu brainstormes un mini-jeu web pour l'Université d'Espions avec Romain (le Producteur). Réponds toujours en français, 1-3 phrases max, dans ton style de personnage.`,
    },
    {
      role: "user",
      content: `Voici la conversation jusqu'ici :
${conversationSoFar}

Pose cette prochaine question dans ton style et ton personnage :
"${question.text}"

Commente brièvement la réponse précédente (1 phrase max, dans ton style), puis pose la question. 1-3 phrases au total.`,
    },
  ];
}

// ============================================================
// Adaptive brainstorming: filter & adapt questions based on context
// ============================================================

export function buildAdaptiveFilterPrompt(
  agent: Agent,
  project: Project,
  transcript: string
): LLMMessage[] {
  const allQuestionsText = ALL_BRAINSTORMING_QUESTIONS
    .map((q, i) => `${i + 1}. [${q.key}] ${q.text}`)
    .join("\n");

  return [
    {
      role: "system",
      content: `Tu es un game producer senior spécialisé mini-jeux web. Tu analyses un brainstorming en cours pour un cours de l'Université d'Espions (mini-jeux React, boucle 30s-10min, thème espionnage). Tu ne poses JAMAIS une question dont la réponse est déjà évidente dans la conversation. Tu focuses sur ce qui est flou : la mécanique core, le feeling espion, la durée de partie, l'intégration score/VN.`,
    },
    {
      role: "user",
      content: `Projet : "${project.title}"${project.description ? ` — ${project.description}` : ""}

${SPY_CONTEXT}

Conversation jusqu'ici :
${transcript}

Voici TOUTES les questions possibles à poser :
${allQuestionsText}

TÂCHE :
1. Évalue la complexité du mini-jeu : "simple" / "moyen" / "ambitieux"
2. SUPPRIME les questions dont la réponse est déjà claire ou implicite dans la conversation
3. REFORMULE les questions restantes pour qu'elles soient hyper-spécifiques à CE cours espion
4. Règles selon la complexité :
   - SIMPLE (arcade rapide, mécanique unique) : 2-4 questions max, très ciblées
   - MOYEN : 4-6 questions
   - AMBITIEUX (plusieurs mécaniques, niveaux, progression) : 6-8 questions

Réponds en JSON pur, sans markdown :
{
  "complexity": "simple",
  "questions": [
    { "key": "adapted_1", "text": "Question reformulée et pertinente pour CE mini-jeu espion..." },
    { "key": "adapted_2", "text": "..." }
  ]
}`,
    },
  ];
}

// ============================================================
// System prompt: Adaptive question — ask next adapted question
// ============================================================

export function buildAdaptiveQuestionPrompt(
  agent: Agent,
  question: TemplateQuestion,
  conversationSoFar: string
): LLMMessage[] {
  return [
    {
      role: "system",
      content: `Tu es ${agent.name}, ${agent.role} chez Eden Studio. Personnalité : ${agent.personality_primary}${agent.personality_nuance ? `, ${agent.personality_nuance}` : ""}. Tu brainstormes un mini-jeu web espion avec Romain. Réponds toujours en français, 1-3 phrases max, dans ton style.`,
    },
    {
      role: "user",
      content: `Conversation jusqu'ici :
${conversationSoFar}

Réagis brièvement à la dernière réponse (1 phrase max), puis pose cette question :
"${question.text}"

1-3 phrases au total. Sois naturel et reste dans le personnage.`,
    },
  ];
}

// ============================================================
// System prompt: Generate dynamic follow-up questions
// ============================================================

export function buildDynamicQuestionsPrompt(
  agent: Agent,
  project: Project,
  transcript: string
): string {
  return `Tu es ${agent.name}, ${agent.role} chez Eden Studio.

${SPY_CONTEXT}

Romain vient de répondre aux questions de base sur le cours "${project.title}".
Voici la conversation complète jusqu'ici :
${transcript}

En te basant sur ces réponses, génère 2 à 4 questions de suivi TRÈS CIBLÉES pour affiner le scope du mini-jeu.
Ces questions doivent :
- Cibler les zones d'ambiguïté sur LA MÉCANIQUE CORE du cours espion
- Aider à trancher des choix importants pour la boucle courte (mécanique A vs B, durée exacte, condition d'échec, etc.)
- Questionner comment le score s'intègre concrètement dans le VN
- Être spécifiques à CE mini-jeu, pas génériques
- NE PAS poser de questions sur la plateforme (toujours web/React) ni le multijoueur (toujours solo)

Réponds en JSON pur, sans markdown, avec ce format exact :
[
  { "key": "dyn_1", "text": "..." },
  { "key": "dyn_2", "text": "..." }
]`;
}

// ============================================================
// System prompt: Dynamic phase — pose generated questions
// ============================================================

export function buildDynamicQuestionAskPrompt(
  agent: Agent,
  question: TemplateQuestion,
  conversationSoFar: string
): LLMMessage[] {
  return [
    {
      role: "system",
      content: `Tu es ${agent.name}, ${agent.role} chez Eden Studio. Personnalité : ${agent.personality_primary}${agent.personality_nuance ? `, ${agent.personality_nuance}` : ""}. Tu brainstormes un mini-jeu web espion avec Romain. Réponds toujours en français, 2-3 phrases max, dans ton style de personnage.`,
    },
    {
      role: "user",
      content: `Conversation jusqu'ici :
${conversationSoFar}

Pose cette question de suivi dans ton style pour affiner le scope du mini-jeu espion :
"${question.text}"

Introduis-la naturellement (1 phrase), puis pose-la. 2-3 phrases max.`,
    },
  ];
}

// ============================================================
// System prompt: Synthesis
// ============================================================

export function buildSynthesisPrompt(
  project: Project,
  transcript: string,
  agentNames: string[]
): string {
  return `Tu es un producteur senior de mini-jeux web. Tu viens d'observer un brainstorming entre Romain (Producteur d'Eden Studio) et ses collaborateurs (${agentNames.join(", ")}) sur le cours "${project.title}" de l'Université d'Espions.

${SPY_CONTEXT}

Voici la transcription complète :
${transcript}

Synthétise maintenant le scope du mini-jeu en un document de cadrage clair et actionnable.
Format OBLIGATOIRE :

# Scope du cours : ${project.title}

## Cours Espion
[Nom du cours, compétence d'agent enseignée, module VN]

## Concept & Genre
[Genre arcade/web, core loop en 2-3 phrases, ce qui rend la boucle fun]

## Durée de partie
[Durée exacte ou fourchette, rythme de la session]

## Feeling Espion
[Quelle émotion/tension le joueur ressent pendant la partie]

## Mécanique Core
[Ce que le joueur fait concrètement — l'action qui se répète]

## Périmètre V1
**Inclus :**
- [feature 1]
- [feature 2]

**Hors scope V1 :**
- [ce qui est explicitement exclu]

## Intégration VN
[Comment le score change la narration / les dialogues / le rang de l'agent]

## Contraintes techniques
[Stack React/web, points de complexité technique, ce qui peut bloquer]

## Direction artistique
[Style visuel, ambiance espion, références]

RÈGLES :
- Sois précis et actionnable — chaque point doit être utilisable par un développeur React
- Respecte strictement ce qui a été dit dans la conversation, n'invente rien
- Si un point n'a pas été discuté, omet-le plutôt que d'inventer
- Markdown propre, pas de bloc \`\`\`markdown
- Français
- Ne réponds QUE avec le document de scope, sans intro ni commentaire`;
}
