export type DecisionScope = "global" | "gdd" | "tech-spec" | "data-arch" | "asset-list" | "backlog";

export interface ProjectDecision {
  id: string;
  projectId: string;
  scope: DecisionScope;
  questionKey: string;
  questionText: string;
  options: string[];
  selectedOption: string | null;
  freeText: string | null;
  answered: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface DecisionQuestion {
  questionKey: string;
  questionText: string;
  options: string[];
  scope: DecisionScope;
  sortOrder: number;
}
