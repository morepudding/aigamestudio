import type { DecisionQuestion, DecisionScope } from "@/lib/types/decision";

/**
 * Static question templates asked by Eve (Producer) before document generation.
 * Global questions are asked once for the whole project.
 * Scoped questions are asked before the specific document.
 */

export const GLOBAL_QUESTIONS: DecisionQuestion[] = [
  {
    questionKey: "monetization",
    questionText: "Quel modèle économique pour ce jeu ?",
    options: [
      "Gratuit (pas de monétisation)",
      "Premium (prix fixe)",
      "Free-to-play avec cosmétiques",
      "Free-to-play avec achats in-app",
      "Donation / tip jar",
    ],
    scope: "global",
    sortOrder: 1,
  },
  {
    questionKey: "target_audience",
    questionText: "Quel est le public cible principal ?",
    options: [
      "Casual / Grand public",
      "Core gamers",
      "Hardcore / Niche",
      "Enfants (< 12 ans)",
      "Famille / Tous âges",
    ],
    scope: "global",
    sortOrder: 2,
  },
  {
    questionKey: "scope_ambition",
    questionText: "Quelle est l'ambition en termes de scope ?",
    options: [
      "Prototype / Game jam (1-2 semaines)",
      "Petit projet (1-3 mois)",
      "Projet moyen (3-6 mois)",
      "Projet ambitieux (6-12 mois)",
    ],
    scope: "global",
    sortOrder: 3,
  },
  {
    questionKey: "art_direction",
    questionText: "Quelle direction artistique ?",
    options: [
      "Pixel art",
      "Low poly 3D",
      "Hand-drawn / Illustré",
      "Réaliste",
      "Minimaliste / Abstract",
      "Voxel",
    ],
    scope: "global",
    sortOrder: 4,
  },
  {
    questionKey: "multiplayer",
    questionText: "Le jeu aura-t-il un mode multijoueur ?",
    options: [
      "Solo uniquement",
      "Coop locale",
      "Coop en ligne",
      "PvP en ligne",
      "MMO / Persistant",
    ],
    scope: "global",
    sortOrder: 5,
  },
  {
    questionKey: "priority_pillar",
    questionText: "Quel est le pilier prioritaire du jeu ?",
    options: [
      "Gameplay / Mécaniques",
      "Narration / Histoire",
      "Exploration / Monde ouvert",
      "Compétition / Classement",
      "Créativité / Construction",
      "Ambiance / Atmosphère",
    ],
    scope: "global",
    sortOrder: 6,
  },
];

export const GDD_QUESTIONS: DecisionQuestion[] = [
  {
    questionKey: "progression_system",
    questionText: "Quel système de progression ?",
    options: [
      "Niveaux / XP classique",
      "Arbre de compétences",
      "Loot / Items",
      "Déblocage par exploration",
      "Pas de progression (arcade)",
      "Roguelike (méta-progression)",
    ],
    scope: "gdd",
    sortOrder: 1,
  },
  {
    questionKey: "game_length",
    questionText: "Durée de vie visée ?",
    options: [
      "Courte (< 2h)",
      "Moyenne (5-10h)",
      "Longue (20-40h)",
      "Infinie (procédural / sandbox)",
      "Sessions courtes répétées (< 30min/session)",
    ],
    scope: "gdd",
    sortOrder: 2,
  },
  {
    questionKey: "difficulty",
    questionText: "Approche de la difficulté ?",
    options: [
      "Facile et accessible",
      "Difficulté progressive",
      "Difficile dès le début (souls-like)",
      "Difficulté adaptative",
      "Choix du joueur (niveaux de difficulté)",
    ],
    scope: "gdd",
    sortOrder: 3,
  },
];

export const TECH_SPEC_QUESTIONS: DecisionQuestion[] = [
  {
    questionKey: "deployment_target",
    questionText: "Où distribuer le jeu en priorité ?",
    options: [
      "Web (itch.io / navigateur)",
      "Steam",
      "Mobile (App Store / Play Store)",
      "Console (Switch / PlayStation / Xbox)",
      "Epic Games Store",
    ],
    scope: "tech-spec",
    sortOrder: 1,
  },
  {
    questionKey: "save_system",
    questionText: "Système de sauvegarde ?",
    options: [
      "Pas de sauvegarde (arcade / roguelike)",
      "Sauvegarde automatique",
      "Sauvegarde manuelle",
      "Cloud save",
      "Checkpoints",
    ],
    scope: "tech-spec",
    sortOrder: 2,
  },
];

export const BACKLOG_QUESTIONS: DecisionQuestion[] = [
  {
    questionKey: "mvp_focus",
    questionText: "Que doit contenir le MVP en priorité ?",
    options: [
      "Core loop jouable uniquement",
      "Core loop + 1 niveau complet",
      "Core loop + méta-progression",
      "Démo verticale (1 tranche complète)",
    ],
    scope: "backlog",
    sortOrder: 1,
  },
  {
    questionKey: "iteration_style",
    questionText: "Comment veux-tu itérer ?",
    options: [
      "Prototype rapide → playtest → itérer",
      "Spécification complète → dev linéaire",
      "Feature par feature, testées individuellement",
      "Sprint de 2 semaines avec review",
    ],
    scope: "backlog",
    sortOrder: 2,
  },
];

/**
 * Get all static questions for a given scope.
 */
export function getQuestionsForScope(scope: DecisionScope): DecisionQuestion[] {
  switch (scope) {
    case "global": return GLOBAL_QUESTIONS;
    case "gdd": return GDD_QUESTIONS;
    case "tech-spec": return TECH_SPEC_QUESTIONS;
    case "backlog": return BACKLOG_QUESTIONS;
    default: return [];
  }
}

/**
 * Get all questions (global + all doc-specific).
 */
export function getAllQuestions(): DecisionQuestion[] {
  return [
    ...GLOBAL_QUESTIONS,
    ...GDD_QUESTIONS,
    ...TECH_SPEC_QUESTIONS,
    ...BACKLOG_QUESTIONS,
  ];
}
