import { ProjectsPageClient } from "@/components/projects/ProjectsPageClient";
import { getAllProjects } from "@/lib/services/projectService";
import { getAllAgents } from "@/lib/services/agentService";
import { startTimer } from "@/lib/utils/perf";

export const revalidate = 30;

export default async function ProjectsPage() {
  const stop = startTimer("ProjectsPage/load");
  const [projects, agents] = await Promise.all([getAllProjects(), getAllAgents()]);
  stop({ projects: projects.length, agents: agents.length });

  return <ProjectsPageClient initialProjects={projects} initialAgents={agents} />;
}
