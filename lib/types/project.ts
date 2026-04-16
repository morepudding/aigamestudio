export type ProjectStatus = "concept" | "in-dev" | "released";

export interface ConceptDeliverables {
  gdd: boolean;
  techSpec: boolean;
  dataArch: boolean;
  assetList: boolean;
  backlog: boolean;
  readme: boolean;
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
}
