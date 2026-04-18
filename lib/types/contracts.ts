/**
 * contracts.ts [D]
 *
 * Source de vérité structurelle entre le game design (GDD) et le code.
 * Tout type qui touche simultanément au design d'un jeu et à son implémentation
 * doit être défini ici — pas dans project.ts, pas dans task.ts.
 *
 * Deux documents vivent côte à côte :
 *   GDDOriginal  — snapshot immuable du GDD V2 finalisé (ne change jamais)
 *   GDDVivant    — état évolutif du design (mis à jour à chaque décision pipeline)
 *
 * La pipeline lit GDDOriginal comme contexte d'intention,
 * et écrit dans GDDVivant pour refléter ce qui a réellement été implémenté.
 */

// ─── Vocabulaire de base ────────────────────────────────────────────────────

export type GameGenre =
  | "rpg"
  | "platformer"
  | "puzzle"
  | "strategy"
  | "simulation"
  | "action"
  | "adventure"
  | "visual-novel"
  | "roguelike"
  | "horror"
  | "sports"
  | "other";

export type GamePlatform = "pc" | "mobile" | "console" | "web" | "vr";

export type GameEngine =
  | "unity"
  | "unreal"
  | "godot"
  | "pygame"
  | "phaser"
  | "custom"
  | "other";

export type ArtStyle =
  | "pixel"
  | "low-poly"
  | "realistic"
  | "cartoon"
  | "hand-drawn"
  | "minimalist"
  | "other";

export type ProjectScope = "jam" | "small" | "medium" | "large" | "ambitious";

// ─── Blocs structurels du GDD ───────────────────────────────────────────────

/** Boucle de gameplay centrale */
export interface CoreLoop {
  /** Action principale du joueur (verbe : "explorer", "construire", "survivre"…) */
  primaryAction: string;
  /** Récompense immédiate qui motive la répétition */
  immediateReward: string;
  /** Progression à long terme (meta-game) */
  longTermGoal: string | null;
}

/** Cible joueur */
export interface TargetAudience {
  ageRange: string | null;        // ex: "12-25"
  playerProfile: string;          // ex: "casual", "hardcore", "puzzle lover"
  sessionLength: string | null;   // ex: "5-10 min", "30+ min"
}

/** Contraintes techniques décidées en brainstorming */
export interface TechConstraints {
  engine: GameEngine | null;
  platforms: GamePlatform[];
  teamSize: number | null;
  targetFPS: number | null;
  networkMultiplayer: boolean;
  moddingSupport: boolean;
}

/** Style artistique décidé en brainstorming */
export interface ArtDirection {
  style: ArtStyle | null;
  colorPalette: string | null;    // ex: "dark & neon", "pastel"
  visualReferences: string[];     // ex: ["Hades", "Celeste"]
  audioMood: string | null;       // ex: "atmospheric lo-fi", "epic orchestra"
}

/** Fonctionnalité ou mécanique concrète */
export interface GameFeature {
  id: string;                     // slug unique, ex: "inventory-system"
  name: string;
  description: string;
  priority: "core" | "secondary" | "cut";
  status: FeatureStatus;
}

export type FeatureStatus =
  | "designed"     // dans le GDD, pas encore implémenté
  | "in-progress"  // tâche pipeline active
  | "implemented"  // livrable pipeline completed
  | "cut"          // retiré du scope
  | "deferred";    // reporté post-lancement

// ─── GDD Original (immuable) ────────────────────────────────────────────────

/**
 * Snapshot structuré du GDD V2 produit en fin de brainstorming.
 * Ce document NE CHANGE PAS après finalisation.
 * Il est la "constitution" du projet.
 *
 * Stocké en JSONB dans projects.gdd_original.
 */
export interface GDDOriginal {
  /** Version du schéma (pour migrations futures) */
  schemaVersion: 1;

  /** Markdown brut du GDD V2 (texte complet pour contexte LLM) */
  rawMarkdown: string;

  /** Métadonnées extraites du GDD pour accès rapide */
  meta: {
    title: string;
    logline: string;           // une phrase : "X rencontre Y dans Z"
    genre: GameGenre[];
    scope: ProjectScope;
    targetAudience: TargetAudience;
  };

  /** Design décisionnel */
  design: {
    coreLoop: CoreLoop;
    features: GameFeature[];
    artDirection: ArtDirection;
    techConstraints: TechConstraints;
  };

  /** Date de finalisation ISO */
  finalizedAt: string;

  /** Slugs des agents qui ont participé au brainstorming */
  brainstormingAgents: string[];
}

// ─── GDD Vivant (évolutif) ───────────────────────────────────────────────────

/**
 * État réel et actuel du projet, mis à jour à chaque livrable pipeline.
 * Diverge progressivement du GDD original — c'est normal et attendu.
 *
 * Stocké en JSONB dans projects.gdd_vivant.
 */
export interface GDDVivant {
  /** Version du schéma */
  schemaVersion: 1;

  /** Dernière mise à jour ISO */
  lastUpdatedAt: string;

  /** Dernière tâche pipeline qui a modifié ce document */
  lastUpdatedByTaskId: string | null;

  /**
   * Features avec leur statut courant.
   * Clone les features du GDD original, enrichies au fil de la pipeline.
   */
  features: GameFeature[];

  /**
   * Décisions prises pendant la pipeline qui divergent du GDD original.
   * Traçabilité des écarts de design.
   */
  designDivergences: DesignDivergence[];

  /**
   * Contraintes techniques réelles (peuvent différer du brainstorming).
   * Null = pas encore confirmées par la pipeline.
   */
  techConstraints: TechConstraints | null;

  /**
   * Livrables produits par la pipeline, indexés par taskId.
   * Permet de retrouver quel artefact implémente quelle feature.
   */
  deliverables: Record<string, PipelineDeliverable>;

  /**
   * Scope actuel du projet après coupures/ajouts décidés en pipeline.
   * Peut différer du scope original.
   */
  currentScope: ProjectScope | null;
}

/** Écart entre ce qui était prévu dans le GDD et ce qui a été implémenté */
export interface DesignDivergence {
  id: string;
  /** ID de la feature concernée (ou null si divergence globale) */
  featureId: string | null;
  /** Description de l'intention originale */
  originalIntent: string;
  /** Ce qui a été fait à la place */
  actualImplementation: string;
  /** Raison du changement */
  reason: string;
  /** ID de la tâche pipeline qui a créé cette divergence */
  taskId: string;
  createdAt: string;
}

/** Référence à un livrable concret produit par la pipeline */
export interface PipelineDeliverable {
  taskId: string;
  taskTitle: string;
  /** IDs des features que ce livrable implémente */
  featureIds: string[];
  deliverableType: "markdown" | "code" | "json" | "config" | "repo-init";
  deliverablePath: string | null;
  completedAt: string;
}

// ─── Utilitaires ────────────────────────────────────────────────────────────

/**
 * Produit un GDD vivant initial à partir du GDD original.
 * Appelé lors de la finalisation du brainstorming.
 */
export function initGDDVivant(original: GDDOriginal): GDDVivant {
  return {
    schemaVersion: 1,
    lastUpdatedAt: new Date().toISOString(),
    lastUpdatedByTaskId: null,
    features: original.design.features.map((f) => ({ ...f })),
    designDivergences: [],
    techConstraints: { ...original.design.techConstraints },
    deliverables: {},
    currentScope: original.meta.scope,
  };
}

/**
 * Retourne les features qui sont dans le GDD original mais absentes du GDD vivant.
 * Utile pour détecter des oublis ou identifier les features non encore attaquées.
 */
export function getMissingFeatures(
  original: GDDOriginal,
  vivant: GDDVivant
): GameFeature[] {
  const vivantIds = new Set(vivant.features.map((f) => f.id));
  return original.design.features.filter((f) => !vivantIds.has(f.id));
}

/**
 * Retourne les features implemented ou in-progress dans le GDD vivant.
 */
export function getActiveFeatures(vivant: GDDVivant): GameFeature[] {
  return vivant.features.filter(
    (f) => f.status === "implemented" || f.status === "in-progress"
  );
}

/**
 * Vérifie si une feature core du GDD original a été coupée dans le GDD vivant.
 * Signal d'alerte pour le Producer.
 */
export function getCutCoreFeatures(
  original: GDDOriginal,
  vivant: GDDVivant
): GameFeature[] {
  const coreOriginals = original.design.features.filter(
    (f) => f.priority === "core"
  );
  const vivantMap = new Map(vivant.features.map((f) => [f.id, f]));
  return coreOriginals.filter((f) => vivantMap.get(f.id)?.status === "cut");
}
