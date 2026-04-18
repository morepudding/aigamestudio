import type { GDDOriginal, GDDVivant } from "@/lib/types/contracts";

export type ProjectStatus = "concept" | "in-dev" | "released";

export type WebEngine = "phaser" | "react" | "vanilla" | "other";

/** Semestre et matière dans l'Université d'Espions */
export interface CourseInfo {
  /** Nom du cours ex: "Cours d'Infiltration" */
  courseName: string;
  /** Module du visual novel ex: "Semestre 1 — Recrutement" */
  vnModule: string;
  /** Mécaniques de gameplay ex: ["puzzle", "furtivité", "temps limité"] */
  mechanics: string[];
  /** Engine web utilisé pour ce mini-jeu */
  webEngine: WebEngine | null;
  /** URL d'intégration dans le visual novel une fois le jeu terminé */
  targetIntegrationUrl: string | null;
}

export interface ConceptDeliverables {
  gdd: boolean;
  techSpec: boolean;
  dataArch: boolean;
  assetList: boolean;
  backlog: boolean;
  readme: boolean;
  /** Spec d'objectif pédagogique espion du cours */
  courseDesign: boolean;
  /** Spec d'intégration avec le visual novel (score, events, completion) */
  integrationSpec: boolean;
}

export interface Project {
  id: string;
  title: string;
  description: string;
  coverGradient: string;
  status: ProjectStatus;
  genre: string;
  platforms: string[];
  tags: string[];
  team: string[];
  engine: string;
  githubRepoUrl: string | null;
  githubRepoName: string | null;
  active: boolean;
  decisionsReady: boolean;
  conceptDeliverables?: ConceptDeliverables;
  /** Informations du cours dans l'Université d'Espions */
  courseInfo: CourseInfo | null;
  /** Snapshot immuable du GDD V2 finalisé. Null tant que le brainstorming n'est pas terminé. */
  gddOriginal: GDDOriginal | null;
  /** État évolutif du design, mis à jour par la pipeline. Null jusqu'à la première décision. */
  gddVivant: GDDVivant | null;
}

export type { GDDOriginal, GDDVivant };
