import { ProjectsPageClient } from "@/components/projects/ProjectsPageClient";
import { getAllProjects } from "@/lib/services/projectService";
import { getAllAgents } from "@/lib/services/agentService";
import { startTimer } from "@/lib/utils/perf";
import type { Project } from "@/lib/types/project";
import type { Agent } from "@/lib/services/agentService";

export const revalidate = 30;

function toPlain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export default async function ProjectsPage() {
  const stop = startTimer("ProjectsPage/load");
  const [projects, agents] = await Promise.all([getAllProjects(), getAllAgents()]);
  stop({ projects: projects.length, agents: agents.length });

  return (
    <ProjectsPageClient
      initialProjects={toPlain<Project[]>(projects)}
      initialAgents={toPlain<Agent[]>(agents)}
    />
  );
}
