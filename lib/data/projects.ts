import { Project, ProjectStatus, ConceptDeliverables } from "@/lib/types/project";

export const projects: Project[] = [
  {
    id: "project-first-light",
    title: "First Light",
    description:
      "Premier projet externe du studio. Un Idle Game où l'énergie est éphémère et doit être rapidement réinvestie dans des automatisations pour espérer progresser.",
    coverGradient: "from-slate-900 via-gray-800 to-zinc-900",
    status: "concept",
    genre: "Idle / Stratégie",
    platforms: ["Web"],
    tags: ["idle", "web", "externe"],
    team: ["Romain"],
    engine: "React / Vite",
    githubRepoUrl: null,
    githubRepoName: null,
    active: true,
    decisionsReady: false,
    conceptDeliverables: {
      gdd: false,
      techSpec: false,
      dataArch: false,
      assetList: false,
      backlog: false,
      readme: false,
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
