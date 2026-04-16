// Brainstorming prompts — multi-agent wizard to scope a game concept
// Each phase is led by one agent (game-design, programming, art)
// followed by AI-generated dynamic follow-ups, then synthesis.

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

export const GAME_DESIGN_QUESTIONS: TemplateQuestion[] = [
  { key: "gd_concept", text: "Décris ton idée de jeu en quelques phrases. Qu'est-ce qui rend ce jeu unique ?" },
  { key: "gd_genre", text: "Quel genre de jeu vises-tu ? (plateforme, RPG, puzzle, idle, stratégie, simulation…)" },
  { key: "gd_core_loop", text: "Décris le core loop : que fait le joueur pendant les 3 premières minutes ?" },
  { key: "gd_audience", text: "À qui s'adresse ce jeu ? Quel profil de joueur ? Quel niveau d'expérience gaming ?" },
  { key: "gd_session", text: "Quelle est la durée d'une session de jeu typique ? (< 10 min, 30 min, 1h+)" },
  { key: "gd_scope", text: "C'est un projet solo, une démo, un MVP ou un jeu complet ? Quelle ambition pour la V1 ?" },
];

export const PROGRAMMING_QUESTIONS: TemplateQuestion[] = [
  { key: "prog_platform", text: "Sur quelles plateformes veux-tu sortir le jeu ? (Web, PC, Mobile, Console)" },
  { key: "prog_engine", text: "Quel moteur ou framework technique envisages-tu ? (Unity, Godot, Phaser, React, custom…)" },
  { key: "prog_constraints", text: "Y a-t-il des contraintes techniques fortes ? (performances, budget serveur, temps de dev, équipe size)" },
  { key: "prog_multiplayer", text: "Solo uniquement, ou y a-t-il un aspect multijoueur / social / leaderboard ?" },
];

export const ART_QUESTIONS: TemplateQuestion[] = [
  { key: "art_mood", text: "Quelle ambiance ou émotion principale veux-tu que le joueur ressente ?" },
  { key: "art_style", text: "Quel style visuel imaginais-tu ? (pixel art, low-poly, cartoon, réaliste, abstrait…)" },
  { key: "art_references", text: "Des jeux ou œuvres qui t'inspirent visuellement / artistiquement pour ce projet ?" },
];

// All questions merged (excluding opening gd_concept which is always asked first)
export const ALL_BRAINSTORMING_QUESTIONS: TemplateQuestion[] = [
  ...GAME_DESIGN_QUESTIONS.slice(1), // gd_concept is the opening question
  ...PROGRAMMING_QUESTIONS,
  ...ART_QUESTIONS,
];

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
    "game-design": "Game Design & Concept",
    "programming": "Technique & Contraintes",
    "art": "Direction Artistique & Ambiance",
  };

  return `Tu es ${agent.name}, ${agent.role} dans un studio de jeux vidéo indépendant.
Ta personnalité : ${agent.personality_primary}${agent.personality_nuance ? `, ${agent.personality_nuance}` : ""}.
${agent.backstory ? `Ton background : ${agent.backstory}` : ""}

Le directeur de studio vient de créer un nouveau projet : "${project.title}"${project.description ? ` — "${project.description}"` : ""}.

Tu mènes la phase **${phaseLabel[phase] ?? phase}** du brainstorming.
Ton objectif : explorer ce thème avec le directeur pour cadrer le scope du jeu.

Tu vas poser ces questions UNE PAR UNE au directeur, dans l'ordre, en restant dans le personnage.
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
      content: `Tu es ${agent.name}, ${agent.role}. Personnalité : ${agent.personality_primary}${agent.personality_nuance ? `, ${agent.personality_nuance}` : ""}. Tu mènes un brainstorming de jeu vidéo. Réponds toujours en français, 1-3 phrases max, dans ton style de personnage.`,
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
      content: `Tu es un game producer senior. Tu analyses un brainstorming en cours et tu crées un plan de questions adapté à la complexité du projet. Tu ne poses JAMAIS une question dont la réponse est déjà évidente dans la conversation.`,
    },
    {
      role: "user",
      content: `Projet : "${project.title}"${project.description ? ` — ${project.description}` : ""}

Conversation jusqu'ici :
${transcript}

Voici TOUTES les questions possibles à poser :
${allQuestionsText}

TÂCHE :
1. Évalue la complexité du projet : "simple" / "moyen" / "ambitieux"
2. SUPPRIME les questions dont la réponse est déjà claire ou implicite dans la conversation
3. REFORMULE les questions restantes pour qu'elles soient adaptées au contexte spécifique
4. Règles selon la complexité :
   - SIMPLE (prototype, MVP, test) : 2-4 questions max, très ciblées
   - MOYEN : 4-6 questions
   - AMBITIEUX : 6-8 questions

Réponds en JSON pur, sans markdown :
{
  "complexity": "simple",
  "questions": [
    { "key": "adapted_1", "text": "Question reformulée et pertinente..." },
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
      content: `Tu es ${agent.name}, ${agent.role}. Personnalité : ${agent.personality_primary}${agent.personality_nuance ? `, ${agent.personality_nuance}` : ""}. Tu mènes un brainstorming de jeu vidéo. Réponds toujours en français, 1-3 phrases max, dans ton style.`,
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
  return `Tu es ${agent.name}, ${agent.role} dans un studio de jeux vidéo.

Le directeur vient de répondre aux questions de base sur le projet "${project.title}".
Voici la conversation complète jusqu'ici :
${transcript}

En te basant sur ces réponses, génère 2 à 4 questions de suivi pertinentes pour affiner et réduire le scope.
Ces questions doivent :
- Cibler les zones d'ambiguïté ou les points qui pourraient gonfler le scope
- Aider à trancher des choix importants (mécanique A vs B, inclure X ou pas, etc.)
- Être spécifiques à CE projet, pas génériques

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
      content: `Tu es ${agent.name}, ${agent.role}. Personnalité : ${agent.personality_primary}${agent.personality_nuance ? `, ${agent.personality_nuance}` : ""}. Tu mènes un brainstorming de jeu vidéo. Réponds toujours en français, 2-3 phrases max, dans ton style de personnage.`,
    },
    {
      role: "user",
      content: `Conversation jusqu'ici :
${conversationSoFar}

Pose cette question de suivi dans ton style pour mieux cerner le scope du projet :
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
  return `Tu es un producteur de jeux vidéo indépendants. Tu viens d'observer un brainstorming entre le directeur de studio et ses collaborateurs (${agentNames.join(", ")}) sur le projet "${project.title}".

Voici la transcription complète :
${transcript}

Synthétise maintenant le scope du jeu en un document de cadrage clair et précis.
Format OBLIGATOIRE :

# Scope du projet : ${project.title}

## Vision
[1-2 phrases sur l'essence du jeu]

## Concept & Genre
[Genre, core loop en 2-3 phrases]

## Public cible
[Profil joueur, plateformes]

## Périmètre V1
**Inclus :**
- [feature 1]
- [feature 2]
...

**Hors scope V1 :**
- [ce qui est explicitement exclu]
...

## Contraintes techniques
[Moteur, plateforme, team size, budget temps]

## Direction artistique
[Style visuel, ambiance, références]

## Durée & session
[Durée de jeu, type de session]

RÈGLES :
- Sois précis et actionnable — chaque point doit être utilisable par un développeur
- Respecte strictement ce qui a été dit dans la conversation, n'invente rien
- Si un point n'a pas été discuté, omet-le plutôt que d'inventer
- Markdown propre, pas de bloc \`\`\`markdown
- Français
- Ne réponds QUE avec le document de scope, sans intro ni commentaire`;
}
