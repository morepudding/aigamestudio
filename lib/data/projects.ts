import { Project, ProjectStatus, ConceptDeliverables } from "@/lib/types/project";

export const projects: Project[] = [
  {
    id: "project-infiltration-101",
    title: "Infiltration 101",
    description:
      "Premier cours de l'Université d'Espions. Un mini-jeu de furtivité web où l'agent-étudiant doit traverser des zones surveillées sans se faire repérer. Mécanique de timing et de lecture des patterns ennemis.",
    coverGradient: "from-slate-900 via-emerald-950 to-zinc-900",
    status: "concept",
    genre: "Furtivité / Puzzle",
    platforms: ["Web"],
    tags: ["furtivité", "puzzle", "université-espions", "mini-jeu"],
    team: ["Romain"],
    engine: "Phaser",
    githubRepoUrl: null,
    githubRepoName: null,
    active: true,
    decisionsReady: false,
    courseInfo: {
      courseName: "Cours d'Infiltration",
      vnModule: "Semestre 1 — Recrutement",
      mechanics: ["furtivité", "timing", "lecture de patterns"],
      webEngine: "phaser",
      targetIntegrationUrl: null,
    },
    gddOriginal: null,
    gddVivant: null,
    conceptDeliverables: {
      gdd: false,
      techSpec: false,
      dataArch: false,
      assetList: false,
      backlog: false,
      readme: false,
      courseDesign: false,
      integrationSpec: false,
    },
  },
];

export const statusLabels: Record<string, string> = {
  concept: "Concept",
  "in-dev": "En développement",
  released: "Sorti",
};

function allDeliverablesComplete(deliverables: ConceptDeliverables): boolean {
  return Object.values(deliverables).every(Boolean);
}

export function getProjectStatus(project: Project): ProjectStatus {
  if (project.status === "released") return "released";
  if (project.status === "concept" || project.status === "in-dev") {
    if (
      project.conceptDeliverables &&
      allDeliverablesComplete(project.conceptDeliverables) &&
      project.githubRepoUrl !== null
    ) {
      return "in-dev";
    }
    return "concept";
  }
  return project.status;
}
